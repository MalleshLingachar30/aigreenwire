import { NextRequest, NextResponse } from "next/server";
import { setArchiveAccessCookie } from "@/lib/archive-access";
import { sql } from "@/lib/db";
import { sendEmail } from "@/lib/resend";
import { buildAppUrl, buildWelcomeEmailHtml, isUuidToken } from "@/lib/subscription";

type SubscriberRow = {
  id: string;
  email: string;
  name: string | null;
  confirmed_at: string | null;
  unsubscribed_at: string | null;
  unsubscribe_token: string;
};

type UpdatedSubscriberRow = {
  unsubscribe_token: string;
};

function redirectToUnsubscribe(
  status: string,
  options: { token?: string; archiveAccessToken?: string } = {}
): NextResponse {
  const target = new URL("/unsubscribe", buildAppUrl("/"));
  target.searchParams.set("status", status);

  if (options.token) {
    target.searchParams.set("token", options.token);
  }

  const response = NextResponse.redirect(target);

  if (options.archiveAccessToken) {
    setArchiveAccessCookie(response, options.archiveAccessToken);
  }

  return response;
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!isUuidToken(token)) {
    return redirectToUnsubscribe("invalid-token");
  }

  try {
    const rows = (await sql`
      SELECT
        id::text AS id,
        email,
        name,
        confirmed_at::text AS confirmed_at,
        unsubscribed_at::text AS unsubscribed_at,
        unsubscribe_token::text AS unsubscribe_token
      FROM subscribers
      WHERE confirm_token = ${token}
      LIMIT 1
    `) as SubscriberRow[];

    const subscriber = rows[0];
    if (!subscriber) {
      return redirectToUnsubscribe("invalid-token");
    }

    if (subscriber.confirmed_at && !subscriber.unsubscribed_at) {
      return redirectToUnsubscribe("already-confirmed", {
        token: subscriber.unsubscribe_token,
        archiveAccessToken: subscriber.unsubscribe_token,
      });
    }

    const updatedRows = (await sql`
      UPDATE subscribers
      SET
        confirmed_at = COALESCE(confirmed_at, NOW()),
        unsubscribed_at = NULL,
        unsubscribe_token = COALESCE(unsubscribe_token, gen_random_uuid())
      WHERE id = ${subscriber.id}
      RETURNING unsubscribe_token::text AS unsubscribe_token
    `) as UpdatedSubscriberRow[];

    const unsubscribeToken =
      updatedRows[0]?.unsubscribe_token ?? subscriber.unsubscribe_token;

    // Send welcome email (fire-and-forget — don't block confirmation).
    const archiveUrl = buildAppUrl("/issues", { token: unsubscribeToken });
    const unsubscribeUrl = buildAppUrl("/api/unsubscribe", {
      token: unsubscribeToken,
    });

    sendEmail({
      to: subscriber.email,
      subject: "Welcome to The AI Green Wire",
      html: buildWelcomeEmailHtml(archiveUrl, unsubscribeUrl, subscriber.name),
      tags: [
        { name: "flow", value: "double-opt-in" },
        { name: "action", value: "welcome" },
      ],
    }).catch(() => {
      // Swallow — confirmation itself already succeeded.
    });

    return redirectToUnsubscribe("confirmed", {
      token: unsubscribeToken,
      archiveAccessToken: unsubscribeToken,
    });
  } catch {
    return redirectToUnsubscribe("error");
  }
}

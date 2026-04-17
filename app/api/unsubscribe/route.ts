import { NextRequest, NextResponse } from "next/server";
import { clearArchiveAccessCookie } from "@/lib/archive-access";
import { sql } from "@/lib/db";
import { sendEmail } from "@/lib/resend";
import {
  buildAppUrl,
  buildUnsubscribeFarewellEmailHtml,
  isUuidToken,
  isValidEmail,
  normalizeEmail,
} from "@/lib/subscription";

type SubscriberRow = {
  id: string;
  email: string;
  name: string | null;
  unsubscribed_at: string | null;
};

function redirectToUnsubscribe(
  status: string,
  options: { clearArchiveCookie?: boolean } = {}
): NextResponse {
  const target = new URL("/unsubscribe", buildAppUrl("/"));
  target.searchParams.set("status", status);
  const response = NextResponse.redirect(target);

  if (options.clearArchiveCookie) {
    clearArchiveAccessCookie(response);
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
        unsubscribed_at::text AS unsubscribed_at
      FROM subscribers
      WHERE unsubscribe_token = ${token}
      LIMIT 1
    `) as SubscriberRow[];

    const subscriber = rows[0];
    if (!subscriber) {
      return redirectToUnsubscribe("invalid-token");
    }

    if (subscriber.unsubscribed_at) {
      return redirectToUnsubscribe("already-unsubscribed", {
        clearArchiveCookie: true,
      });
    }

    await sql`
      UPDATE subscribers
      SET unsubscribed_at = NOW()
      WHERE id = ${subscriber.id}
    `;

    const email = normalizeEmail(subscriber.email);
    if (isValidEmail(email)) {
      const resubscribeUrl = buildAppUrl("/");
      void sendEmail({
        to: email,
        subject: "You are unsubscribed from The AI Green Wire",
        html: buildUnsubscribeFarewellEmailHtml(resubscribeUrl, subscriber.name),
        tags: [
          { name: "flow", value: "subscriber-lifecycle" },
          { name: "action", value: "unsubscribe-farewell" },
        ],
      }).catch((error) => {
        console.error("Failed to send unsubscribe farewell email", error);
      });
    }

    return redirectToUnsubscribe("unsubscribed", { clearArchiveCookie: true });
  } catch {
    return redirectToUnsubscribe("error");
  }
}

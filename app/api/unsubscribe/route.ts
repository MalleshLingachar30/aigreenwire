import { NextRequest, NextResponse } from "next/server";
import { clearArchiveAccessCookie } from "@/lib/archive-access";
import { sql } from "@/lib/db";
import { buildAppUrl, isUuidToken } from "@/lib/subscription";

type SubscriberRow = {
  id: string;
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

    return redirectToUnsubscribe("unsubscribed", { clearArchiveCookie: true });
  } catch {
    return redirectToUnsubscribe("error");
  }
}

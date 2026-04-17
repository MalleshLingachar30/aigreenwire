import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { buildAppUrl, isUuidToken } from "@/lib/subscription";

type SubscriberRow = {
  id: string;
  confirmed_at: string | null;
  unsubscribed_at: string | null;
  unsubscribe_token: string;
};

type UpdatedSubscriberRow = {
  unsubscribe_token: string;
};

function redirectToUnsubscribe(
  status: string,
  token?: string,
  grantArchiveAccess = false
): NextResponse {
  const target = new URL("/unsubscribe", buildAppUrl("/"));
  target.searchParams.set("status", status);

  if (token) {
    target.searchParams.set("token", token);
  }

  const response = NextResponse.redirect(target);

  if (grantArchiveAccess) {
    response.cookies.set({
      name: "archive_access",
      value: "granted",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      sameSite: "lax",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    });
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
      return redirectToUnsubscribe("already-confirmed", subscriber.unsubscribe_token);
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

    return redirectToUnsubscribe("confirmed", unsubscribeToken, true);
  } catch {
    return redirectToUnsubscribe("error");
  }
}

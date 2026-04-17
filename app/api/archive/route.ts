import { NextRequest, NextResponse } from "next/server";
import { setArchiveAccessCookie } from "@/lib/archive-access";
import { sql } from "@/lib/db";
import { buildAppUrl, isUuidToken } from "@/lib/subscription";

type SubscriberRow = {
  id: string;
};

function redirectToSubscribePrompt(): NextResponse {
  const target = new URL("/", buildAppUrl("/"));
  target.searchParams.set("archive", "subscribe");
  return NextResponse.redirect(target);
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!isUuidToken(token)) {
    return redirectToSubscribePrompt();
  }

  try {
    const rows = (await sql`
      SELECT id::text AS id
      FROM subscribers
      WHERE unsubscribe_token = ${token}
        AND confirmed_at IS NOT NULL
        AND unsubscribed_at IS NULL
      LIMIT 1
    `) as SubscriberRow[];

    if (rows.length === 0) {
      return redirectToSubscribePrompt();
    }

    const target = new URL("/issues", buildAppUrl("/"));
    const response = NextResponse.redirect(target);
    setArchiveAccessCookie(response, token);
    return response;
  } catch {
    return redirectToSubscribePrompt();
  }
}

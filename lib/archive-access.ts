import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { isUuidToken } from "@/lib/subscription";

export const ARCHIVE_ACCESS_COOKIE = "aigw_archive_access";

const ARCHIVE_ACCESS_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;
const ARCHIVE_ACCESS_REQUIRED_REDIRECT = "/?archive=subscribe";

type ArchiveAccessRow = {
  id: string;
};

export async function requireArchiveAccess(): Promise<void> {
  const cookieStore = await cookies();
  const archiveAccessToken =
    cookieStore.get(ARCHIVE_ACCESS_COOKIE)?.value?.trim() ?? null;

  if (!isUuidToken(archiveAccessToken)) {
    redirect(ARCHIVE_ACCESS_REQUIRED_REDIRECT);
  }

  const rows = (await sql`
    SELECT id::text AS id
    FROM subscribers
    WHERE unsubscribe_token = ${archiveAccessToken}
      AND confirmed_at IS NOT NULL
      AND unsubscribed_at IS NULL
    LIMIT 1
  `) as ArchiveAccessRow[];

  if (rows.length === 0) {
    redirect(ARCHIVE_ACCESS_REQUIRED_REDIRECT);
  }
}

export function setArchiveAccessCookie(
  response: NextResponse,
  unsubscribeToken: string
): void {
  if (!isUuidToken(unsubscribeToken)) {
    return;
  }

  response.cookies.set({
    name: ARCHIVE_ACCESS_COOKIE,
    value: unsubscribeToken,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ARCHIVE_ACCESS_MAX_AGE_SECONDS,
  });
}

export function clearArchiveAccessCookie(response: NextResponse): void {
  response.cookies.set({
    name: ARCHIVE_ACCESS_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

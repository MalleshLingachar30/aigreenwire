import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { getArchiveAccessLookupAttempts } from "@/lib/archive-access-retry";
import { resolveArchiveAccessToken } from "@/lib/archive-token";
import { sql } from "@/lib/db";
import { isUuidToken } from "@/lib/subscription";

export const ARCHIVE_ACCESS_COOKIE = "aigw_archive_access";

const ARCHIVE_ACCESS_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;
const ARCHIVE_ACCESS_REQUIRED_REDIRECT = "/?archive=subscribe";
const ARCHIVE_ACCESS_LOOKUP_RETRY_DELAY_MS = 250;

type ArchiveAccessRow = {
  id: string;
};

async function resolveToken(
  queryToken: string | null | undefined
): Promise<string | null> {
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(ARCHIVE_ACCESS_COOKIE)?.value ?? null;
  return resolveArchiveAccessToken(queryToken, cookieToken);
}

async function lookupActiveSubscriberByToken(
  archiveAccessToken: string
): Promise<ArchiveAccessRow[]> {
  return (await sql`
    SELECT id::text AS id
    FROM subscribers
    WHERE unsubscribe_token = ${archiveAccessToken}
      AND confirmed_at IS NOT NULL
      AND unsubscribed_at IS NULL
    LIMIT 1
  `) as ArchiveAccessRow[];
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function requireArchiveAccess(
  queryToken: string | null | undefined = null
): Promise<void> {
  const archiveAccessToken = await resolveToken(queryToken);

  if (!archiveAccessToken) {
    redirect(ARCHIVE_ACCESS_REQUIRED_REDIRECT);
  }

  const lookupAttempts = getArchiveAccessLookupAttempts(queryToken);

  for (let attempt = 1; attempt <= lookupAttempts; attempt += 1) {
    const rows = await lookupActiveSubscriberByToken(archiveAccessToken);
    if (rows.length > 0) {
      return;
    }

    if (attempt < lookupAttempts) {
      // Handle read-after-write lag right after confirmation redirects.
      await delay(ARCHIVE_ACCESS_LOOKUP_RETRY_DELAY_MS);
    }
  }

  redirect(ARCHIVE_ACCESS_REQUIRED_REDIRECT);
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

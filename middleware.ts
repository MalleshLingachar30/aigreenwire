import { NextRequest, NextResponse } from "next/server";

const ARCHIVE_ACCESS_COOKIE = "aigw_archive_access";
const ARCHIVE_ACCESS_MAX_AGE_SECONDS = 60 * 60 * 24 * 180; // 180 days

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Middleware that handles archive access via query-string token.
 *
 * In-app browsers (email clients, WhatsApp) often discard cookies set on
 * redirect responses. When the confirmation page links to `/issues?token=X`,
 * this middleware sets the archive-access cookie from the token and then
 * redirects to `/issues` (without the token in the URL) so the layout's
 * cookie-based check succeeds.
 */
export function middleware(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")?.trim() ?? "";

  if (!UUID_PATTERN.test(token)) {
    return NextResponse.next();
  }

  const cleanUrl = request.nextUrl.clone();
  cleanUrl.searchParams.delete("token");

  const response = NextResponse.redirect(cleanUrl);

  // Always (re-)set the cookie from the token to keep it fresh.
  response.cookies.set({
    name: ARCHIVE_ACCESS_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ARCHIVE_ACCESS_MAX_AGE_SECONDS,
  });

  return response;
}

export const config = {
  matcher: ["/issues/:path*"],
};

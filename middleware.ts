import { NextRequest, NextResponse } from "next/server";

const ARCHIVE_ACCESS_COOKIE = "aigw_archive_access";
const ARCHIVE_ACCESS_MAX_AGE_SECONDS = 60 * 60 * 24 * 180; // 180 days

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Middleware that handles archive access via query-string token.
 *
 * In-app browsers (email clients, WhatsApp) often discard cookies set on
 * redirect responses. Instead of redirecting, this middleware:
 *  1. Forwards the token as a request header (`x-archive-token`) so the
 *     server-side layout can read it without depending on cookies.
 *  2. Sets the archive-access cookie on the response for future visits.
 *
 * This means archive access works on the very first request, even when
 * cookies from earlier redirects were lost.
 */
export function middleware(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")?.trim() ?? "";

  // If a valid token is in the query string, forward it as a header and
  // persist it as a cookie for future visits.
  if (UUID_PATTERN.test(token)) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-archive-token", token);

    const response = NextResponse.next({
      request: { headers: requestHeaders },
    });

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

  return NextResponse.next();
}

export const config = {
  matcher: ["/issues", "/issues/:path*"],
};

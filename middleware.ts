import { NextRequest, NextResponse } from "next/server";

const ARCHIVE_ACCESS_COOKIE = "aigw_archive_access";
const ARCHIVE_ACCESS_MAX_AGE_SECONDS = 60 * 60 * 24 * 180; // 180 days

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Middleware that handles archive access via query-string token.
 *
 * On a valid `?token=`, the middleware forwards the token via request header
 * and persists it as a cookie for subsequent archive navigations.
 */
export function middleware(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")?.trim() ?? "";
  const requestHeaders = new Headers(request.headers);
  const hasValidToken = UUID_PATTERN.test(token);

  if (hasValidToken) {
    requestHeaders.set("x-archive-token", token);
  }

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // Persist a valid token for later archive navigations that do not include
  // a query token.
  if (hasValidToken) {
    response.cookies.set({
      name: ARCHIVE_ACCESS_COOKIE,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: ARCHIVE_ACCESS_MAX_AGE_SECONDS,
    });
  }

  return response;
}

export const config = {
  matcher: ["/issues", "/issues/:path*"],
};

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const hasArchiveAccess =
    request.cookies.get("archive_access")?.value === "granted";

  if (hasArchiveAccess) {
    return NextResponse.next();
  }

  const redirectUrl = new URL("/", request.url);
  redirectUrl.searchParams.set("archive", "locked");
  redirectUrl.searchParams.set(
    "next",
    `${request.nextUrl.pathname}${request.nextUrl.search}`
  );

  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: ["/issues/:path*"],
};

import { NextRequest } from "next/server";

function getBearerToken(request: NextRequest): string | null {
  const authorization = request.headers.get("authorization");
  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.trim().split(/\s+/, 2);
  if (!scheme || !token || scheme.toLowerCase() !== "bearer") {
    return null;
  }

  return token.trim();
}

function getRequiredSecret(envName: "CRON_SECRET"): string | null {
  const value = process.env[envName]?.trim();
  return value ? value : null;
}

function getAdminPassword(): string | null {
  const value = process.env.ADMIN_PASSWORD;
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function isCronRequestAuthorized(request: NextRequest): boolean {
  const secret = getRequiredSecret("CRON_SECRET");
  if (!secret) {
    return false;
  }

  const bearer = getBearerToken(request);
  const headerSecret = request.headers.get("x-cron-secret")?.trim() ?? null;
  const querySecret = request.nextUrl.searchParams.get("secret")?.trim() ?? null;

  return bearer === secret || headerSecret === secret || querySecret === secret;
}

export function isAdminRequestAuthorized(request: NextRequest): boolean {
  const password = getAdminPassword();
  if (!password) {
    return false;
  }

  const bearer = getBearerToken(request);
  const headerPassword = request.headers.get("x-admin-password")?.trim() ?? null;
  const queryPassword = request.nextUrl.searchParams.get("password");

  return bearer === password || headerPassword === password || queryPassword === password;
}

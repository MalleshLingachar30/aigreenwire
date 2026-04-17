import { isUuidToken } from "@/lib/subscription";

export function resolveArchiveAccessToken(
  queryToken: string | null | undefined,
  cookieToken: string | null | undefined
): string | null {
  const normalizedQueryToken = queryToken?.trim() ?? null;
  if (isUuidToken(normalizedQueryToken)) {
    return normalizedQueryToken;
  }

  const normalizedCookieToken = cookieToken?.trim() ?? null;
  if (isUuidToken(normalizedCookieToken)) {
    return normalizedCookieToken;
  }

  return null;
}

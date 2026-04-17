import { isUuidToken } from "@/lib/subscription";

type ArchiveAccessTokenSources = {
  headerToken?: string | null;
  queryToken?: string | null;
  cookieToken?: string | null;
};

export function resolveArchiveAccessToken(
  sources: ArchiveAccessTokenSources
): string | null {
  const normalizedHeaderToken = sources.headerToken?.trim() ?? null;
  if (isUuidToken(normalizedHeaderToken)) {
    return normalizedHeaderToken;
  }

  const normalizedQueryToken = sources.queryToken?.trim() ?? null;
  if (isUuidToken(normalizedQueryToken)) {
    return normalizedQueryToken;
  }

  const normalizedCookieToken = sources.cookieToken?.trim() ?? null;
  if (isUuidToken(normalizedCookieToken)) {
    return normalizedCookieToken;
  }

  return null;
}

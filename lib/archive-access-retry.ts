import { isUuidToken } from "@/lib/subscription";

const LOOKUP_ATTEMPTS_WITH_QUERY_TOKEN = 2;
const LOOKUP_ATTEMPTS_DEFAULT = 1;

export function getArchiveAccessLookupAttempts(
  queryToken: string | null | undefined
): number {
  const normalizedQueryToken = queryToken?.trim() ?? null;

  if (isUuidToken(normalizedQueryToken)) {
    return LOOKUP_ATTEMPTS_WITH_QUERY_TOKEN;
  }

  return LOOKUP_ATTEMPTS_DEFAULT;
}

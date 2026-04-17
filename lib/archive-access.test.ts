import test from "node:test";
import assert from "node:assert/strict";
import { resolveArchiveAccessToken } from "@/lib/archive-token";

const QUERY_TOKEN = "11111111-1111-4111-8111-111111111111";
const COOKIE_TOKEN = "22222222-2222-4222-8222-222222222222";

test("resolveArchiveAccessToken prefers valid query token over cookie token", () => {
  assert.equal(resolveArchiveAccessToken(QUERY_TOKEN, COOKIE_TOKEN), QUERY_TOKEN);
});

test("resolveArchiveAccessToken falls back to cookie token when query token is invalid", () => {
  assert.equal(
    resolveArchiveAccessToken("not-a-token", COOKIE_TOKEN),
    COOKIE_TOKEN
  );
});

test("resolveArchiveAccessToken trims query token input", () => {
  assert.equal(
    resolveArchiveAccessToken(`  ${QUERY_TOKEN}  `, null),
    QUERY_TOKEN
  );
});

test("resolveArchiveAccessToken returns null when no valid token is present", () => {
  assert.equal(resolveArchiveAccessToken(null, undefined), null);
  assert.equal(resolveArchiveAccessToken("invalid", "also-invalid"), null);
});

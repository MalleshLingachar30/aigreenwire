import test from "node:test";
import assert from "node:assert/strict";
import { resolveArchiveAccessToken } from "@/lib/archive-token";

const HEADER_TOKEN = "99999999-9999-4999-8999-999999999999";
const QUERY_TOKEN = "11111111-1111-4111-8111-111111111111";
const COOKIE_TOKEN = "22222222-2222-4222-8222-222222222222";

test("resolveArchiveAccessToken prefers valid header token over query and cookie", () => {
  assert.equal(
    resolveArchiveAccessToken({
      headerToken: HEADER_TOKEN,
      queryToken: QUERY_TOKEN,
      cookieToken: COOKIE_TOKEN,
    }),
    HEADER_TOKEN
  );
});

test("resolveArchiveAccessToken prefers valid query token over cookie token", () => {
  assert.equal(
    resolveArchiveAccessToken({
      queryToken: QUERY_TOKEN,
      cookieToken: COOKIE_TOKEN,
    }),
    QUERY_TOKEN
  );
});

test("resolveArchiveAccessToken falls back to cookie token when higher-priority tokens are invalid", () => {
  assert.equal(
    resolveArchiveAccessToken({
      headerToken: "not-a-token",
      queryToken: "also-not-a-token",
      cookieToken: COOKIE_TOKEN,
    }),
    COOKIE_TOKEN
  );
});

test("resolveArchiveAccessToken trims query token input", () => {
  assert.equal(
    resolveArchiveAccessToken({
      queryToken: `  ${QUERY_TOKEN}  `,
    }),
    QUERY_TOKEN
  );
});

test("resolveArchiveAccessToken returns null when no valid token is present", () => {
  assert.equal(resolveArchiveAccessToken({}), null);
  assert.equal(
    resolveArchiveAccessToken({
      headerToken: "invalid",
      queryToken: "also-invalid",
      cookieToken: "still-invalid",
    }),
    null
  );
});

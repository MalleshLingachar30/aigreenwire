import test from "node:test";
import assert from "node:assert/strict";
import { getArchiveAccessLookupAttempts } from "@/lib/archive-access-retry";

const QUERY_TOKEN = "11111111-1111-4111-8111-111111111111";

test("getArchiveAccessLookupAttempts returns retry window for valid query tokens", () => {
  assert.equal(getArchiveAccessLookupAttempts(QUERY_TOKEN), 2);
  assert.equal(getArchiveAccessLookupAttempts(`  ${QUERY_TOKEN}  `), 2);
});

test("getArchiveAccessLookupAttempts returns single attempt without valid query token", () => {
  assert.equal(getArchiveAccessLookupAttempts(null), 1);
  assert.equal(getArchiveAccessLookupAttempts(undefined), 1);
  assert.equal(getArchiveAccessLookupAttempts("not-a-token"), 1);
});

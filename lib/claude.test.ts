import test from "node:test";
import assert from "node:assert/strict";
import {
  extractIssuePayloadFromClaudeResponse,
  parseClaudeJsonLikeText,
} from "@/lib/claude";

test("extracts issue payload from store_issue tool block", () => {
  const payload = {
    issue_number: 6,
    subject_line: "Subject",
    greeting_blurb: "Namaste. Greeting.",
    stories: [],
    stats: [],
    field_note: [],
  };

  const response = {
    content: [
      { type: "text", text: "Working..." },
      { type: "tool_use", name: "store_issue", input: payload },
    ],
  };

  assert.deepEqual(extractIssuePayloadFromClaudeResponse(response), payload);
});

test("parses JSON object when Claude prefixes prose before the payload", () => {
  const parsed = parseClaudeJsonLikeText(
    `I now have enough material to compile the issue.\n\n{"issue_number":6,"subject_line":"Subject"}`
  );

  assert.deepEqual(parsed, {
    issue_number: 6,
    subject_line: "Subject",
  });
});

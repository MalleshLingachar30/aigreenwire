import test from "node:test";
import assert from "node:assert/strict";
import {
  extractIssuePayloadFromClaudeResponse,
  parseClaudeJsonLikeText,
  generateIssue,
  anthropic,
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

test("normalizes greeting_blurb when Claude omits the required Namaste period", async () => {
  const savedCreate = anthropic.messages.create as any;

  (anthropic.messages.create as any) = async () => ({
    content: [
      {
        type: "tool_use",
        name: "store_issue",
        input: {
          issue_number: 6,
          subject_line: "The AI Green Wire · Issue 06 · Fresh field signals",
          greeting_blurb:
            "Namaste farmers are using field sensors to time irrigation more precisely this week. That matters because water stress decisions are becoming more data-driven. Watch whether cooperatives adopt the workflow before monsoon planting.",
          stories: [
            {
              section: "india",
              tag: "POLICY",
              headline: "India story 1",
              paragraphs: ["One.", "Two."],
              sources: [{ name: "PIB", url: "https://example.com/1" }],
            },
            {
              section: "india",
              tag: "FIELD",
              headline: "India story 2",
              paragraphs: ["One.", "Two."],
              sources: [{ name: "PIB", url: "https://example.com/2" }],
            },
            {
              section: "india",
              tag: "MARKET",
              headline: "India story 3",
              paragraphs: ["One.", "Two."],
              sources: [{ name: "PIB", url: "https://example.com/3" }],
            },
            {
              section: "forestry",
              tag: "FOREST",
              headline: "Forestry story 1",
              paragraphs: ["One.", "Two."],
              sources: [{ name: "FAO", url: "https://example.com/4" }],
            },
            {
              section: "forestry",
              tag: "FOREST",
              headline: "Forestry story 2",
              paragraphs: ["One.", "Two."],
              sources: [{ name: "FAO", url: "https://example.com/5" }],
            },
            {
              section: "forestry",
              tag: "FOREST",
              headline: "Forestry story 3",
              paragraphs: ["One.", "Two."],
              sources: [{ name: "FAO", url: "https://example.com/6" }],
            },
            {
              section: "forestry",
              tag: "FOREST",
              headline: "Forestry story 4",
              paragraphs: ["One.", "Two."],
              sources: [{ name: "FAO", url: "https://example.com/7" }],
            },
            {
              section: "students",
              tag: "PHD",
              headline: "Student story 1",
              paragraphs: ["One.", "Two."],
              sources: [{ name: "Uni", url: "https://example.com/8" }],
            },
            {
              section: "students",
              tag: "LAB",
              headline: "Student story 2",
              paragraphs: ["One.", "Two."],
              sources: [{ name: "Uni", url: "https://example.com/9" }],
            },
          ],
          stats: [
            {
              value: "10%",
              label: "Yield gain",
              source_name: "PIB",
              source_url: "https://example.com/a",
            },
            {
              value: "20%",
              label: "Water saving",
              source_name: "PIB",
              source_url: "https://example.com/b",
            },
            {
              value: "30%",
              label: "Coverage",
              source_name: "FAO",
              source_url: "https://example.com/c",
            },
            {
              value: "40%",
              label: "Accuracy",
              source_name: "Uni",
              source_url: "https://example.com/d",
            },
          ],
          field_note: ["Paragraph one.", "Paragraph two."],
        },
      },
    ],
  });

  try {
    const issue = await generateIssue(6);
    assert.equal(issue.greeting_blurb.startsWith("Namaste."), true);
  } finally {
    (anthropic.messages.create as any) = savedCreate;
  }
});

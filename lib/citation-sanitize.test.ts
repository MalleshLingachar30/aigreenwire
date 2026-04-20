import test from "node:test";
import assert from "node:assert/strict";
import { parseStoredIssueData } from "@/lib/citation-sanitize";

test("parseStoredIssueData strips citation markup from persisted issue content", () => {
  const parsed = parseStoredIssueData(
    JSON.stringify({
      issue_number: 1,
      subject_line: "Subject <cite index=\"1\"></cite>",
      greeting_blurb: "Greeting &lt;cite index=\"2\"&gt;&lt;/cite&gt;",
      stories: [
        {
          section: "india",
          tag: "Policy <cite index=\"3\"></cite>",
          headline: "Headline <cite index=\"4\"></cite>",
          paragraphs: [
            "Paragraph one <cite index=\"5\"></cite>",
            "Paragraph two &lt;cite index=\"6\"&gt;&lt;/cite&gt;",
          ],
          action: "Act <cite index=\"7\"></cite>",
          sources: [{ name: "Source <cite index=\"8\"></cite>", url: "https://example.com/1" }],
        },
      ],
      stats: [
        {
          value: "10 <cite index=\"9\"></cite>",
          label: "Stat <cite index=\"10\"></cite>",
          source_name: "Desk <cite index=\"11\"></cite>",
          source_url: "https://example.com/stat",
        },
      ],
      field_note: ["Field note <cite index=\"12\"></cite>"],
    }),
    3
  );

  assert.equal(parsed.issue_number, 3);
  assert.equal(parsed.subject_line, "Subject");
  assert.equal(parsed.greeting_blurb, "Greeting");
  assert.equal(parsed.stories[0]?.tag, "Policy");
  assert.equal(parsed.stories[0]?.headline, "Headline");
  assert.deepEqual(parsed.stories[0]?.paragraphs, ["Paragraph one", "Paragraph two"]);
  assert.equal(parsed.stories[0]?.action, "Act");
  assert.equal(parsed.stories[0]?.sources[0]?.name, "Source");
  assert.equal(parsed.stats[0]?.value, "10");
  assert.equal(parsed.stats[0]?.label, "Stat");
  assert.equal(parsed.stats[0]?.source_name, "Desk");
  assert.deepEqual(parsed.field_note, ["Field note"]);
});

test("parseStoredIssueData rejects payloads without stories", () => {
  assert.throws(() => parseStoredIssueData("{}", 3), /stories array/);
});

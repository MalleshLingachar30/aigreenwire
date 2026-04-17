import test from "node:test";
import assert from "node:assert/strict";
import { buildIssueDeliveryLinks, renderIssueForSubscriber } from "@/lib/issue-email";
import type { IssueData } from "@/lib/claude";

const ISSUE_SLUG = "07-archive-entry-fix";
const UNSUBSCRIBE_TOKEN = "11111111-1111-4111-8111-111111111111";

const issueData: IssueData = {
  issue_number: 7,
  subject_line: "The AI Green Wire · Issue 07 · Archive Entry Fix",
  greeting_blurb: "Namaste. Weekly briefing.",
  stories: [
    {
      section: "india",
      tag: "POLICY",
      headline: "India story",
      paragraphs: ["Paragraph one.", "Paragraph two."],
      sources: [{ name: "Source 1", url: "https://example.com/1" }],
    },
    {
      section: "forestry",
      tag: "FORESTRY",
      headline: "Forestry story",
      paragraphs: ["Paragraph one.", "Paragraph two."],
      sources: [{ name: "Source 2", url: "https://example.com/2" }],
    },
    {
      section: "students",
      tag: "RESEARCH",
      headline: "Student story",
      paragraphs: ["Paragraph one.", "Paragraph two."],
      sources: [{ name: "Source 3", url: "https://example.com/3" }],
    },
  ],
  stats: [
    {
      value: "1",
      label: "Stat",
      source_name: "Source",
      source_url: "https://example.com/stat",
    },
  ],
  field_note: ["Note one.", "Note two."],
};

test("buildIssueDeliveryLinks returns tokenized archive and unsubscribe URLs", () => {
  const links = buildIssueDeliveryLinks(ISSUE_SLUG, UNSUBSCRIBE_TOKEN);

  assert.equal(
    links.unsubscribeUrl,
    "https://aigreenwire.com/api/unsubscribe?token=11111111-1111-4111-8111-111111111111"
  );
  assert.equal(
    links.viewInBrowserUrl,
    "https://aigreenwire.com/issues/07-archive-entry-fix?token=11111111-1111-4111-8111-111111111111"
  );
});

test("buildIssueDeliveryLinks rejects invalid tokens", () => {
  assert.throws(
    () => buildIssueDeliveryLinks(ISSUE_SLUG, "not-a-token"),
    /valid UUID/
  );
});

test("renderIssueForSubscriber includes tokenized browser-view and unsubscribe links", () => {
  const html = renderIssueForSubscriber(issueData, ISSUE_SLUG, UNSUBSCRIBE_TOKEN);

  assert.match(
    html,
    /https:\/\/aigreenwire\.com\/issues\/07-archive-entry-fix\?token=11111111-1111-4111-8111-111111111111/
  );
  assert.match(
    html,
    /https:\/\/aigreenwire\.com\/api\/unsubscribe\?token=11111111-1111-4111-8111-111111111111/
  );
});

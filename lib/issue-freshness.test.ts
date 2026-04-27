import test from "node:test";
import assert from "node:assert/strict";
import {
  checkIssueFreshness,
  isIssueFreshEnough,
  type PreviousIssueContext,
} from "@/lib/issue-freshness";
import type { IssueData } from "@/lib/claude";

test("flags overlapping headlines and repeated source URLs against previous issue", () => {
  const previousIssue: PreviousIssueContext = {
    issueNumber: 4,
    subjectLine: "The AI Green Wire · Issue 04 · India's AI Farm Revolution Shifts from Promise to Policy",
    greetingBlurb:
      "Namaste. This week marks a watershed policy moment as Dr Jitendra Singh positioned Bharat-VISTAAR at the centre of India's farm advisory push. That policy framing matters because growers are being asked to treat AI-backed advisories as near-term operating tools. Watch whether states move from announcements to implementation.",
    fieldNote: ["Watch the policy lane.", "Adjust your planning to fresh developments."],
    stories: [
      {
        section: "india",
        headline:
          "Budget 2026–27 Unveils Bharat-VISTAAR: India's National Multilingual AI Advisory for All Farmers",
        sourceUrls: ["https://example.com/bharat-vistaar"],
      },
      {
        section: "forestry",
        headline:
          "FAO & Purdue's MATRIX Model Harnesses 1.8 Million Forest Plots to Sharpen Carbon Accounting",
        sourceUrls: ["https://example.com/fao-purdue"],
      },
    ],
  };

  const currentIssue: IssueData = {
    issue_number: 5,
    subject_line: "The AI Green Wire · Issue 05 · India announces ₹10,372cr AI revolution for farms",
    greeting_blurb:
      "Namaste. This week marks a bigger policy push as Dr Jitendra Singh ties Bharat-VISTAAR to the India AI Mission. That matters because growers may soon see advisory tools backed by national rollout budgets. Watch whether state extension systems integrate the new stack before kharif planning.",
    stories: [
      {
        section: "india",
        tag: "POLICY",
        headline: "India launches multilingual AI farming assistant in Budget 2026-27",
        paragraphs: ["p1", "p2"],
        sources: [{ name: "PIB", url: "https://example.com/bharat-vistaar" }],
      },
      {
        section: "india",
        tag: "STATE AI",
        headline: "New growers platform debuts in Karnataka",
        paragraphs: ["p1", "p2"],
        sources: [{ name: "State", url: "https://example.com/karnataka" }],
      },
      {
        section: "india",
        tag: "MISSION",
        headline: "India AI mission names agriculture as strategic sector",
        paragraphs: ["p1", "p2"],
        sources: [{ name: "IndiaAI", url: "https://example.com/india-ai" }],
      },
      {
        section: "forestry",
        tag: "FORESTRY",
        headline: "Fresh biodiversity mapping update",
        paragraphs: ["p1", "p2"],
        sources: [{ name: "Nature", url: "https://example.com/bio" }],
      },
      {
        section: "forestry",
        tag: "FORESTRY",
        headline: "Another forestry update",
        paragraphs: ["p1", "p2"],
        sources: [{ name: "Nature", url: "https://example.com/bio-2" }],
      },
      {
        section: "forestry",
        tag: "FORESTRY",
        headline: "Third forestry update",
        paragraphs: ["p1", "p2"],
        sources: [{ name: "Nature", url: "https://example.com/bio-3" }],
      },
      {
        section: "forestry",
        tag: "FORESTRY",
        headline: "Fourth forestry update",
        paragraphs: ["p1", "p2"],
        sources: [{ name: "Nature", url: "https://example.com/bio-4" }],
      },
      {
        section: "students",
        tag: "FELLOWSHIP",
        headline: "New fellowship opens",
        paragraphs: ["p1", "p2"],
        sources: [{ name: "Adobe", url: "https://example.com/adobe" }],
      },
      {
        section: "students",
        tag: "PHD",
        headline: "Doctoral training call opens",
        paragraphs: ["p1", "p2"],
        sources: [{ name: "UKRI", url: "https://example.com/ukri" }],
      },
    ],
    stats: [
      { value: "1", label: "a", source_name: "x", source_url: "https://example.com/1" },
      { value: "2", label: "b", source_name: "x", source_url: "https://example.com/2" },
      { value: "3", label: "c", source_name: "x", source_url: "https://example.com/3" },
      { value: "4", label: "d", source_name: "x", source_url: "https://example.com/4" },
    ],
    field_note: ["one", "two"],
  };

  const result = checkIssueFreshness(currentIssue, previousIssue);

  assert.equal(result.duplicateSourceUrlMatches.length, 1);
  assert.ok(
    result.similarHeadlineMatches.length >= 1 || result.similarSubjectLine !== null
  );
  assert.deepEqual(result.repeatedOpeningEntity?.entity, "jitendra singh");
  assert.equal(result.repeatedOpeningLens?.lens, "policy");
  assert.equal(result.repeatedOpeningStructure?.structure, "this week marks");
  assert.equal(isIssueFreshEnough(result), false);
});

test("allows clearly different issue content", () => {
  const previousIssue: PreviousIssueContext = {
    issueNumber: 4,
    subjectLine: "Previous issue",
    greetingBlurb:
      "Namaste. This week marks a policy shift as the agriculture ministry moved multilingual advisories into the national spotlight. That policy turn matters because growers may soon see central guidance shape local extension practice. Watch whether implementation funding follows the announcement.",
    fieldNote: ["Old note one.", "Old note two."],
    stories: [
      {
        section: "india",
        headline: "National multilingual farming advisory launches",
        sourceUrls: ["https://example.com/old-1"],
      },
    ],
  };

  const currentIssue: IssueData = {
    issue_number: 5,
    subject_line: "Current issue",
    greeting_blurb:
      "Namaste. Farmers in drought districts are now using satellite irrigation audits to decide which canal repairs matter first. That field impact matters because growers can act on water constraints before the next planting window. Watch whether more cooperatives adopt the audit workflow before monsoon stress deepens.",
    stories: [
      {
        section: "india",
        tag: "WATER",
        headline: "Satellite irrigation audit helps drought districts prioritize repairs",
        paragraphs: ["p1", "p2"],
        sources: [{ name: "Gov", url: "https://example.com/new-1" }],
      },
      {
        section: "india",
        tag: "SOIL",
        headline: "Soil sensor network expands into cooperative sugarcane clusters",
        paragraphs: ["p1", "p2"],
        sources: [{ name: "Gov", url: "https://example.com/new-2" }],
      },
      {
        section: "india",
        tag: "MARKETS",
        headline: "Farmer producer groups test pricing copilots for mandi timing",
        paragraphs: ["p1", "p2"],
        sources: [{ name: "Gov", url: "https://example.com/new-3" }],
      },
      {
        section: "forestry",
        tag: "FORESTRY",
        headline: "Remote canopy audit reduces wildfire blind spots in dry forests",
        paragraphs: ["p1", "p2"],
        sources: [{ name: "Gov", url: "https://example.com/new-4" }],
      },
      {
        section: "forestry",
        tag: "FORESTRY",
        headline: "LiDAR restoration pilot maps erosion corridors in degraded hills",
        paragraphs: ["p1", "p2"],
        sources: [{ name: "Gov", url: "https://example.com/new-5" }],
      },
      {
        section: "forestry",
        tag: "FORESTRY",
        headline: "Agroforestry traceability trial links timber plots to verified ledgers",
        paragraphs: ["p1", "p2"],
        sources: [{ name: "Gov", url: "https://example.com/new-6" }],
      },
      {
        section: "forestry",
        tag: "FORESTRY",
        headline: "Mangrove monitoring tool spots salinity stress weeks earlier",
        paragraphs: ["p1", "p2"],
        sources: [{ name: "Gov", url: "https://example.com/new-7" }],
      },
      {
        section: "students",
        tag: "FELLOWSHIP",
        headline: "Applied ecology AI studio opens cohort for field robotics projects",
        paragraphs: ["p1", "p2"],
        sources: [{ name: "Gov", url: "https://example.com/new-8" }],
      },
      {
        section: "students",
        tag: "PHD",
        headline: "New remote sensing challenge funds masters teams in watershed mapping",
        paragraphs: ["p1", "p2"],
        sources: [{ name: "Gov", url: "https://example.com/new-9" }],
      },
    ],
    stats: [
      { value: "1", label: "a", source_name: "x", source_url: "https://example.com/1" },
      { value: "2", label: "b", source_name: "x", source_url: "https://example.com/2" },
      { value: "3", label: "c", source_name: "x", source_url: "https://example.com/3" },
      { value: "4", label: "d", source_name: "x", source_url: "https://example.com/4" },
    ],
    field_note: ["one", "two"],
  };

  const result = checkIssueFreshness(currentIssue, previousIssue);

  assert.equal(result.duplicateSourceUrlMatches.length, 0);
  assert.equal(result.similarHeadlineMatches.length, 0);
  assert.equal(result.similarSubjectLine, null);
  assert.equal(result.repeatedOpeningEntity, null);
  assert.equal(result.repeatedOpeningLens, null);
  assert.equal(result.repeatedOpeningStructure, null);
  assert.equal(isIssueFreshEnough(result), true);
});

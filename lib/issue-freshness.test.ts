import test from "node:test";
import assert from "node:assert/strict";
import {
  checkIssueFreshness,
  isIssueFreshEnough,
  normalizeStatValue,
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
    stats: [
      { value: "$8.9B", label: "AI in agriculture market", sourceUrl: "https://example.com/stat-old-1" },
      { value: "1.8M", label: "forest plots mapped", sourceUrl: "https://example.com/stat-old-2" },
      { value: "42%", label: "yield improvement", sourceUrl: "https://example.com/stat-old-3" },
      { value: "₹10,372cr", label: "budget allocation", sourceUrl: "https://example.com/stat-old-4" },
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
  assert.ok(result.repeatedTopicLaneMatches.length >= 1);
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
        sourceUrls: ["https://policywire.in/old-1"],
      },
    ],
    stats: [
      { value: "$8.9B", label: "AI in agriculture market", sourceUrl: "https://example.com/stat-old-1" },
      { value: "1.8M", label: "forest plots mapped", sourceUrl: "https://example.com/stat-old-2" },
      { value: "42%", label: "yield improvement", sourceUrl: "https://example.com/stat-old-3" },
      { value: "₹10,372cr", label: "budget allocation", sourceUrl: "https://example.com/stat-old-4" },
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
        sources: [{ name: "Gov", url: "https://waterwatch.in/new-1" }],
      },
      {
        section: "india",
        tag: "SOIL",
        headline: "Soil sensor network expands into cooperative sugarcane clusters",
        paragraphs: ["p1", "p2"],
        sources: [{ name: "Gov", url: "https://soilmesh.org/new-2" }],
      },
      {
        section: "india",
        tag: "MARKETS",
        headline: "Farmer producer groups test pricing copilots for mandi timing",
        paragraphs: ["p1", "p2"],
        sources: [{ name: "Gov", url: "https://mandiintel.ai/new-3" }],
      },
      {
        section: "forestry",
        tag: "FORESTRY",
        headline: "Remote canopy audit reduces wildfire blind spots in dry forests",
        paragraphs: ["p1", "p2"],
        sources: [{ name: "Gov", url: "https://forestscan.org/new-4" }],
      },
      {
        section: "forestry",
        tag: "FORESTRY",
        headline: "LiDAR restoration pilot maps erosion corridors in degraded hills",
        paragraphs: ["p1", "p2"],
        sources: [{ name: "Gov", url: "https://lidarrestoration.net/new-5" }],
      },
      {
        section: "forestry",
        tag: "FORESTRY",
        headline: "Agroforestry traceability trial links timber plots to verified ledgers",
        paragraphs: ["p1", "p2"],
        sources: [{ name: "Gov", url: "https://timberledger.io/new-6" }],
      },
      {
        section: "forestry",
        tag: "FORESTRY",
        headline: "Mangrove monitoring tool spots salinity stress weeks earlier",
        paragraphs: ["p1", "p2"],
        sources: [{ name: "Gov", url: "https://mangrovelab.org/new-7" }],
      },
      {
        section: "students",
        tag: "FELLOWSHIP",
        headline: "Applied ecology AI studio opens cohort for field robotics projects",
        paragraphs: ["p1", "p2"],
        sources: [{ name: "Gov", url: "https://ecoaistudio.org/new-8" }],
      },
      {
        section: "students",
        tag: "PHD",
        headline: "New remote sensing challenge funds masters teams in watershed mapping",
        paragraphs: ["p1", "p2"],
        sources: [{ name: "Gov", url: "https://watershedchallenge.edu/new-9" }],
      },
    ],
    stats: [
      { value: "550K", label: "tonnes carbon sequestered", source_name: "x", source_url: "https://example.com/new-stat-1" },
      { value: "12", label: "new AI startups funded", source_name: "x", source_url: "https://example.com/new-stat-2" },
      { value: "78%", label: "detection accuracy", source_name: "x", source_url: "https://example.com/new-stat-3" },
      { value: "3.2M", label: "hectares under monitoring", source_name: "x", source_url: "https://example.com/new-stat-4" },
    ],
    field_note: ["Brand new advice about pest management.", "Specific seasonal guidance for monsoon prep."],
  };

  const result = checkIssueFreshness(currentIssue, previousIssue);

  assert.equal(result.duplicateSourceUrlMatches.length, 0);
  assert.equal(result.similarHeadlineMatches.length, 0);
  assert.equal(result.similarSubjectLine, null);
  assert.equal(result.repeatedOpeningEntity, null);
  assert.equal(result.repeatedOpeningLens, null);
  assert.equal(result.repeatedOpeningStructure, null);
  assert.equal(result.repeatedTopicLaneMatches.length, 0);
  assert.equal(result.duplicateStatMatches.length, 0);
  assert.equal(result.similarFieldNote, null);
  assert.equal(result.similarGreetingBlurb, null);
  assert.equal(isIssueFreshEnough(result), true);
});

test("flags semantic reruns of recent India policy lanes even when wording changes", () => {
  const previousIssue: PreviousIssueContext = {
    issueNumber: 4,
    subjectLine: "The AI Green Wire · Issue 04 · India's AI Farm Revolution Shifts from Promise to Policy",
    greetingBlurb:
      "Namaste. This week marked a watershed moment for Indian agriculture as Bharat-VISTAAR moved multilingual farm advisory into the national policy stack. That policy turn matters because growers may soon receive centralised AI-backed guidance through extension systems. Watch whether Maharashtra and other states move from pilot talk to implementation.",
    fieldNote: ["Old note."],
    stories: [
      {
        section: "india",
        headline: "Budget 2026–27 Unveils Bharat-VISTAAR for Nationwide Farm Advisory",
        sourceUrls: ["https://example.com/bharat-vistaar"],
      },
      {
        section: "india",
        headline: "Maharashtra Positions AI Agriculture Conference as State Rollout Signal",
        sourceUrls: ["https://example.com/maharashtra-ai"],
      },
    ],
    stats: [
      { value: "1", label: "a", sourceUrl: "https://example.com/s1" },
      { value: "2", label: "b", sourceUrl: "https://example.com/s2" },
      { value: "3", label: "c", sourceUrl: "https://example.com/s3" },
      { value: "4", label: "d", sourceUrl: "https://example.com/s4" },
    ],
  };

  const currentIssue: IssueData = {
    issue_number: 5,
    subject_line: "The AI Green Wire · Issue 05 · New AI rollout promises customised farm guidance",
    greeting_blurb:
      "Namaste. India is preparing a national AI rollout for farmers through a multilingual advisory stack tied to mission funding. That policy push matters because states are being asked to convert central announcements into real extension workflows. Watch whether Maharashtra turns its AI agriculture push into district-level implementation before kharif.",
    stories: [
      {
        section: "india",
        tag: "ADVISORY",
        headline: "Multilingual farm advisory stack moves closer to national rollout",
        paragraphs: ["p1", "p2"],
        sources: [{ name: "PIB", url: "https://example.com/new-1" }],
      },
      {
        section: "india",
        tag: "MISSION",
        headline: "India AI Mission ties fresh funding to agriculture deployment",
        paragraphs: ["p1", "p2"],
        sources: [{ name: "IndiaAI", url: "https://example.com/new-2" }],
      },
      {
        section: "india",
        tag: "STATE",
        headline: "Maharashtra renews AI agriculture push with another state conference",
        paragraphs: ["p1", "p2"],
        sources: [{ name: "State", url: "https://example.com/new-3" }],
      },
      {
        section: "forestry",
        tag: "FORESTRY",
        headline: "Forest restoration benchmark expands",
        paragraphs: ["p1", "p2"],
        sources: [{ name: "Nature", url: "https://example.com/new-4" }],
      },
      {
        section: "forestry",
        tag: "FORESTRY",
        headline: "Agroforestry market signal changes",
        paragraphs: ["p1", "p2"],
        sources: [{ name: "Nature", url: "https://example.com/new-5" }],
      },
      {
        section: "forestry",
        tag: "FORESTRY",
        headline: "Canopy monitoring update",
        paragraphs: ["p1", "p2"],
        sources: [{ name: "Nature", url: "https://example.com/new-6" }],
      },
      {
        section: "forestry",
        tag: "FORESTRY",
        headline: "Carbon audit study lands",
        paragraphs: ["p1", "p2"],
        sources: [{ name: "Nature", url: "https://example.com/new-7" }],
      },
      {
        section: "students",
        tag: "FELLOWSHIP",
        headline: "New student call opens",
        paragraphs: ["p1", "p2"],
        sources: [{ name: "Adobe", url: "https://example.com/new-8" }],
      },
      {
        section: "students",
        tag: "PHD",
        headline: "Doctoral cohort expands",
        paragraphs: ["p1", "p2"],
        sources: [{ name: "UKRI", url: "https://example.com/new-9" }],
      },
    ],
    stats: [
      { value: "10", label: "x", source_name: "x", source_url: "https://example.com/ns1" },
      { value: "20", label: "y", source_name: "x", source_url: "https://example.com/ns2" },
      { value: "30", label: "z", source_name: "x", source_url: "https://example.com/ns3" },
      { value: "40", label: "w", source_name: "x", source_url: "https://example.com/ns4" },
    ],
    field_note: ["New note one.", "New note two."],
  };

  const result = checkIssueFreshness(currentIssue, previousIssue);

  assert.ok(
    result.repeatedTopicLaneMatches.some((match) => match.laneId === "national-ai-farm-policy-push")
  );
  assert.ok(
    result.repeatedTopicLaneMatches.some((match) => match.laneId === "maharashtra-ai-agriculture-push")
  );
  assert.equal(isIssueFreshEnough(result), false);
});

test("flags duplicate stats when value+label or source URL matches", () => {
  const previousIssue: PreviousIssueContext = {
    issueNumber: 4,
    subjectLine: "Previous issue",
    greetingBlurb: "Namaste. Different content about market movements this week.",
    fieldNote: ["Old advice."],
    stories: [],
    stats: [
      { value: "$8.9B", label: "AI in agriculture market size", sourceUrl: "https://example.com/stat-1" },
      { value: "1.8M", label: "forest plots", sourceUrl: "https://example.com/stat-2" },
      { value: "42%", label: "yield gain", sourceUrl: "https://example.com/stat-3" },
      { value: "₹500cr", label: "funding round", sourceUrl: "https://example.com/stat-4" },
    ],
  };

  const currentIssue: IssueData = {
    issue_number: 5,
    subject_line: "Completely new subject",
    greeting_blurb: "Namaste. A research breakthrough in remote sensing changes how canopy health is measured across tropical forests.",
    stories: [],
    stats: [
      // Exact value+label match
      { value: "$8.9B", label: "AI in agriculture market size", source_name: "x", source_url: "https://example.com/different-url" },
      // Same source URL
      { value: "999", label: "new label", source_name: "x", source_url: "https://example.com/stat-2" },
      // Completely new
      { value: "15%", label: "efficiency gain", source_name: "x", source_url: "https://example.com/new-stat" },
      { value: "200K", label: "sensors deployed", source_name: "x", source_url: "https://example.com/new-stat-2" },
    ],
    field_note: ["Completely different advice."],
  };

  const result = checkIssueFreshness(currentIssue, previousIssue);

  assert.equal(result.duplicateStatMatches.length, 2);
  assert.equal(isIssueFreshEnough(result), false);
});

test("flags similar field note content", () => {
  const previousIssue: PreviousIssueContext = {
    issueNumber: 4,
    subjectLine: "Previous issue",
    greetingBlurb: "Namaste. Market movements in carbon credits are reshaping investor expectations across Southeast Asia.",
    fieldNote: [
      "Sandalwood growers should watch for heartwood borers during the warm dry spell ahead of monsoon.",
      "Apply neem oil preventively and inspect host trees for gall formation before June rains begin.",
    ],
    stories: [],
    stats: [
      { value: "1", label: "a", sourceUrl: "https://example.com/s1" },
      { value: "2", label: "b", sourceUrl: "https://example.com/s2" },
      { value: "3", label: "c", sourceUrl: "https://example.com/s3" },
      { value: "4", label: "d", sourceUrl: "https://example.com/s4" },
    ],
  };

  const currentIssue: IssueData = {
    issue_number: 5,
    subject_line: "Completely different subject",
    greeting_blurb: "Namaste. A startup in Hyderabad demonstrates real-time soil moisture prediction from satellite imagery.",
    stories: [],
    stats: [
      { value: "10", label: "x", source_name: "x", source_url: "https://example.com/ns1" },
      { value: "20", label: "y", source_name: "x", source_url: "https://example.com/ns2" },
      { value: "30", label: "z", source_name: "x", source_url: "https://example.com/ns3" },
      { value: "40", label: "w", source_name: "x", source_url: "https://example.com/ns4" },
    ],
    // Near-identical field note — just slightly rephrased
    field_note: [
      "Sandalwood growers should watch for heartwood borers during the warm dry spell before monsoon arrives.",
      "Apply neem oil as a preventive measure and inspect host trees for gall formation before June.",
    ],
  };

  const result = checkIssueFreshness(currentIssue, previousIssue);

  assert.ok(result.similarFieldNote !== null, "should flag similar field note");
  assert.ok(result.similarFieldNote!.similarity >= 0.30);
  assert.equal(isIssueFreshEnough(result), false);
});

test("flags similar greeting blurb content", () => {
  const previousIssue: PreviousIssueContext = {
    issueNumber: 4,
    subjectLine: "Previous issue",
    greetingBlurb:
      "Namaste. Satellite irrigation audits are helping drought district farmers prioritize canal repair work this season. That field impact matters because growers need real-time water data before planting windows close. Watch whether cooperative adoption picks up before monsoon.",
    fieldNote: ["Old note."],
    stories: [],
    stats: [
      { value: "1", label: "a", sourceUrl: "https://example.com/s1" },
      { value: "2", label: "b", sourceUrl: "https://example.com/s2" },
      { value: "3", label: "c", sourceUrl: "https://example.com/s3" },
      { value: "4", label: "d", sourceUrl: "https://example.com/s4" },
    ],
  };

  const currentIssue: IssueData = {
    issue_number: 5,
    subject_line: "Completely different subject",
    // Same meaning, slightly reworded — should still trigger similarity
    greeting_blurb:
      "Namaste. Satellite irrigation audit tools are helping drought district farmers decide which canal repairs matter most this season. That field impact matters because growers need water data before planting windows close. Watch whether cooperatives adopt these audits before monsoon stress deepens.",
    stories: [],
    stats: [
      { value: "10", label: "x", source_name: "x", source_url: "https://example.com/ns1" },
      { value: "20", label: "y", source_name: "x", source_url: "https://example.com/ns2" },
      { value: "30", label: "z", source_name: "x", source_url: "https://example.com/ns3" },
      { value: "40", label: "w", source_name: "x", source_url: "https://example.com/ns4" },
    ],
    field_note: ["Completely new field advice."],
  };

  const result = checkIssueFreshness(currentIssue, previousIssue);

  assert.ok(result.similarGreetingBlurb !== null, "should flag similar greeting blurb");
  assert.ok(result.similarGreetingBlurb!.similarity >= 0.35);
  assert.equal(isIssueFreshEnough(result), false);
});

test("detects source URL recycling across multiple previous issues", () => {
  const issue2: PreviousIssueContext = {
    issueNumber: 2,
    subjectLine: "Issue 2",
    greetingBlurb: "Namaste. Market update for soil sensor companies.",
    fieldNote: ["Issue 2 note."],
    stories: [
      {
        section: "india",
        headline: "Soil sensor pilot launches in Telangana",
        sourceUrls: ["https://example.com/recycled-url"],
      },
    ],
    stats: [
      { value: "A", label: "old-a", sourceUrl: "https://example.com/old-stat-a" },
      { value: "B", label: "old-b", sourceUrl: "https://example.com/old-stat-b" },
      { value: "C", label: "old-c", sourceUrl: "https://example.com/old-stat-c" },
      { value: "D", label: "old-d", sourceUrl: "https://example.com/old-stat-d" },
    ],
  };

  const issue3: PreviousIssueContext = {
    issueNumber: 3,
    subjectLine: "Issue 3",
    greetingBlurb: "Namaste. Research breakthroughs in canopy analysis tools.",
    fieldNote: ["Issue 3 note."],
    stories: [
      {
        section: "forestry",
        headline: "Different headline about canopy",
        sourceUrls: ["https://example.com/issue-3-url"],
      },
    ],
    stats: [
      { value: "E", label: "newer-e", sourceUrl: "https://example.com/newer-stat-e" },
      { value: "F", label: "newer-f", sourceUrl: "https://example.com/newer-stat-f" },
      { value: "G", label: "newer-g", sourceUrl: "https://example.com/newer-stat-g" },
      { value: "H", label: "newer-h", sourceUrl: "https://example.com/newer-stat-h" },
    ],
  };

  const currentIssue: IssueData = {
    issue_number: 4,
    subject_line: "New subject line for issue 4",
    greeting_blurb: "Namaste. Student fellowships in precision agriculture are seeing record applications this spring.",
    stories: [
      {
        section: "india",
        tag: "SENSORS",
        headline: "Completely new headline about drone mapping",
        paragraphs: ["p1", "p2"],
        // This URL appeared in issue 2, not issue 3 — multi-issue check should catch it
        sources: [{ name: "Gov", url: "https://example.com/recycled-url" }],
      },
    ],
    stats: [
      { value: "100", label: "z", source_name: "x", source_url: "https://example.com/ns1" },
      { value: "200", label: "y", source_name: "x", source_url: "https://example.com/ns2" },
      { value: "300", label: "x", source_name: "x", source_url: "https://example.com/ns3" },
      { value: "400", label: "w", source_name: "x", source_url: "https://example.com/ns4" },
    ],
    field_note: ["Different field note."],
  };

  // Pass array: most recent first (issue 3 then issue 2)
  const result = checkIssueFreshness(currentIssue, [issue3, issue2]);

  assert.equal(result.duplicateSourceUrlMatches.length, 1, "should catch recycled URL from issue 2");
  assert.equal(result.duplicateSourceUrlMatches[0]!.sourceUrl, "https://example.com/recycled-url");
  assert.equal(isIssueFreshEnough(result), false);
});

test("handles null previous issues gracefully", () => {
  const currentIssue: IssueData = {
    issue_number: 1,
    subject_line: "First issue ever",
    greeting_blurb: "Namaste. Welcome to the very first AI Green Wire.",
    stories: [],
    stats: [
      { value: "1", label: "a", source_name: "x", source_url: "https://example.com/1" },
    ],
    field_note: ["First note."],
  };

  const result = checkIssueFreshness(currentIssue, null);

  assert.equal(result.duplicateSourceUrlMatches.length, 0);
  assert.equal(result.duplicateStatMatches.length, 0);
  assert.equal(result.repeatedTopicLaneMatches.length, 0);
  assert.equal(result.similarFieldNote, null);
  assert.equal(result.similarGreetingBlurb, null);
  assert.equal(isIssueFreshEnough(result), true);
});

test("handles empty previous issues array gracefully", () => {
  const currentIssue: IssueData = {
    issue_number: 1,
    subject_line: "First issue ever",
    greeting_blurb: "Namaste. Welcome to the very first AI Green Wire.",
    stories: [],
    stats: [
      { value: "1", label: "a", source_name: "x", source_url: "https://example.com/1" },
    ],
    field_note: ["First note."],
  };

  const result = checkIssueFreshness(currentIssue, []);

  assert.equal(result.repeatedTopicLaneMatches.length, 0);
  assert.equal(isIssueFreshEnough(result), true);
});

test("normalizeStatValue canonicalises currency and unit format variations", () => {
  // Rupee variations
  assert.equal(normalizeStatValue("₹70,000Cr"), "70000cr");
  assert.equal(normalizeStatValue("₹70,000 crore"), "70000cr");
  assert.equal(normalizeStatValue("₹70,000cr"), "70000cr");
  assert.equal(normalizeStatValue("₹70000cr"), "70000cr");

  // Dollar variations
  assert.equal(normalizeStatValue("$20.7B"), "20.7b");
  assert.equal(normalizeStatValue("$20.7 billion"), "20.7b");
  assert.equal(normalizeStatValue("$30 million"), "30m");
  assert.equal(normalizeStatValue("$30M"), "30m");

  // Lakh variations
  assert.equal(normalizeStatValue("95 lakh"), "95l");
  assert.equal(normalizeStatValue("95 lakhs"), "95l");

  // Plain numbers
  assert.equal(normalizeStatValue("73%"), "73%");
  assert.equal(normalizeStatValue("₹38,750"), "38750");
});

test("flags duplicate stats when only the numeric value matches across format variations", () => {
  const previousIssue: PreviousIssueContext = {
    issueNumber: 4,
    subjectLine: "Previous issue",
    greetingBlurb: "Namaste. Market movements in carbon credits this week.",
    fieldNote: ["Old advice."],
    stories: [],
    stats: [
      { value: "₹70,000Cr", label: "Potential annual farmer income boost from AI advisories", sourceUrl: "https://example.com/old-stat-1" },
      { value: "$8.9B", label: "AI in agriculture market", sourceUrl: "https://example.com/old-stat-2" },
      { value: "42%", label: "yield improvement", sourceUrl: "https://example.com/old-stat-3" },
      { value: "95 lakh", label: "farmer queries", sourceUrl: "https://example.com/old-stat-4" },
    ],
  };

  const currentIssue: IssueData = {
    issue_number: 5,
    subject_line: "New subject line",
    greeting_blurb: "Namaste. A startup demonstrates remote sensing for soil health monitoring.",
    stories: [],
    stats: [
      // Same number, different format and label, different URL
      { value: "₹70,000 crore", label: "Annual value potential for farm holdings through AI", source_name: "x", source_url: "https://example.com/completely-different-url" },
      // Completely new
      { value: "15%", label: "efficiency gain", source_name: "x", source_url: "https://example.com/new-stat" },
      { value: "200K", label: "sensors deployed", source_name: "x", source_url: "https://example.com/new-stat-2" },
      { value: "3.2M", label: "hectares under monitoring", source_name: "x", source_url: "https://example.com/new-stat-3" },
    ],
    field_note: ["Completely different advice."],
  };

  const result = checkIssueFreshness(currentIssue, previousIssue);

  assert.equal(result.duplicateStatMatches.length, 1, "should catch ₹70,000Cr vs ₹70,000 crore");
  assert.equal(result.duplicateStatMatches[0]!.currentValue, "₹70,000 crore");
  assert.equal(result.duplicateStatMatches[0]!.previousValue, "₹70,000Cr");
  assert.equal(isIssueFreshEnough(result), false);
});

test("flags repeated source-domain clusters when the same domain dominates another issue", () => {
  const previousIssue: PreviousIssueContext = {
    issueNumber: 5,
    subjectLine: "The AI Green Wire · Issue 05 · India announces ₹10,372cr AI revolution for farms",
    greetingBlurb:
      "Namaste. A policy-led week put central AI farming plans back in the spotlight. That matters because growers still need fresher, more practical signals than another top-down announcement. Watch for different institutions and field outcomes next week.",
    fieldNote: ["Previous note one.", "Previous note two."],
    stories: [
      {
        section: "forestry",
        headline: "FAO launches AIM4Forests programme for AI-driven forest monitoring",
        sourceUrls: ["https://www.fao.org/aim4forests/en/"],
      },
      {
        section: "india",
        headline: "Different India story",
        sourceUrls: ["https://example.com/india-story"],
      },
    ],
    stats: [
      { value: "1", label: "a", sourceUrl: "https://example.com/s1" },
      { value: "2", label: "b", sourceUrl: "https://example.com/s2" },
      { value: "3", label: "c", sourceUrl: "https://example.com/s3" },
      { value: "4", label: "d", sourceUrl: "https://example.com/s4" },
    ],
  };

  const currentIssue: IssueData = {
    issue_number: 6,
    subject_line: "The AI Green Wire · Issue 06 · Fresh forestry week",
    greeting_blurb:
      "Namaste. New forest-monitoring tools are shaping this week's view of practical AI in the natural world. That matters because readers need current operational signals rather than reruns of last week's institutional stories. Watch for field deployments that broaden beyond the usual sources.",
    stories: [
      {
        section: "india",
        tag: "FIELD",
        headline: "District crop-disease pilot expands",
        paragraphs: ["p1", "p2"],
        sources: [{ name: "State", url: "https://district.example.com/new-1" }],
      },
      {
        section: "india",
        tag: "MARKET",
        headline: "Mandi prediction tool adds pulses",
        paragraphs: ["p1", "p2"],
        sources: [{ name: "Startup", url: "https://mandi.example.com/new-2" }],
      },
      {
        section: "india",
        tag: "RESEARCH",
        headline: "Crop imagery benchmark lands",
        paragraphs: ["p1", "p2"],
        sources: [{ name: "University", url: "https://benchmark.example.com/new-3" }],
      },
      {
        section: "forestry",
        tag: "FORESTRY",
        headline: "FAO publishes landmark AI forest monitoring roadmap",
        paragraphs: ["p1", "p2"],
        sources: [{ name: "FAO", url: "https://www.fao.org/forest-monitoring-roadmap" }],
      },
      {
        section: "forestry",
        tag: "FORESTRY",
        headline: "FAO-backed carbon monitoring benchmark expands",
        paragraphs: ["p1", "p2"],
        sources: [{ name: "FAO", url: "https://www.fao.org/carbon-monitoring-benchmark" }],
      },
      {
        section: "forestry",
        tag: "FORESTRY",
        headline: "Independent mangrove mapping update",
        paragraphs: ["p1", "p2"],
        sources: [{ name: "Nature", url: "https://mangrove.example.com/new-4" }],
      },
      {
        section: "forestry",
        tag: "FORESTRY",
        headline: "Restoration audit startup lands pilot",
        paragraphs: ["p1", "p2"],
        sources: [{ name: "Startup", url: "https://restoration.example.com/new-5" }],
      },
      {
        section: "students",
        tag: "PHD",
        headline: "New PhD call opens",
        paragraphs: ["p1", "p2"],
        sources: [{ name: "University", url: "https://phd.example.com/new-6" }],
      },
      {
        section: "students",
        tag: "FELLOWSHIP",
        headline: "Field robotics fellowship opens",
        paragraphs: ["p1", "p2"],
        sources: [{ name: "Institute", url: "https://fellowship.example.com/new-7" }],
      },
    ],
    stats: [
      { value: "10", label: "x", source_name: "x", source_url: "https://example.com/ns1" },
      { value: "20", label: "y", source_name: "x", source_url: "https://example.com/ns2" },
      { value: "30", label: "z", source_name: "x", source_url: "https://example.com/ns3" },
      { value: "40", label: "w", source_name: "x", source_url: "https://example.com/ns4" },
    ],
    field_note: ["Fresh field note one.", "Fresh field note two."],
  };

  const result = checkIssueFreshness(currentIssue, previousIssue);

  assert.equal(result.repeatedSourceDomainMatches.length, 1);
  assert.equal(result.repeatedSourceDomainMatches[0]!.domain, "fao.org");
  assert.equal(isIssueFreshEnough(result), false);
});

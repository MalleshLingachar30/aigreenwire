import test from "node:test";
import assert from "node:assert/strict";
import type { IssueData, Story } from "@/lib/claude";
import { selectTopStoriesWithFreshness } from "@/lib/whatsapp-card-selection";

function makeStory(
  section: Story["section"],
  headline: string,
  sourceUrl: string,
  tag = "TAG"
): Story {
  return {
    section,
    tag,
    headline,
    paragraphs: ["Paragraph one.", "Paragraph two."],
    sources: [{ name: "Source", url: sourceUrl }],
  };
}

test("prefers fresher card mix over repeated India policy and Maharashtra lanes", () => {
  const previousIssue: IssueData = {
    issue_number: 4,
    subject_line: "Issue 04",
    greeting_blurb: "Namaste. Previous issue.",
    stories: [
      makeStory(
        "india",
        "Budget 2026-27 unveils Bharat-VISTAAR for nationwide farm advisory",
        "https://example.com/prev-india-1",
        "POLICY"
      ),
      makeStory(
        "india",
        "Maharashtra positions AI agriculture conference as state rollout signal",
        "https://example.com/prev-india-2",
        "STATE"
      ),
      makeStory(
        "india",
        "Separate India story that would not become a card",
        "https://example.com/prev-india-3",
        "INDIA"
      ),
      makeStory(
        "forestry",
        "FAO forest carbon model expands canopy accounting",
        "https://example.com/prev-forest-1",
        "FORESTRY"
      ),
      makeStory(
        "forestry",
        "Another forestry story",
        "https://example.com/prev-forest-2",
        "FORESTRY"
      ),
      makeStory(
        "forestry",
        "Third forestry story",
        "https://example.com/prev-forest-3",
        "FORESTRY"
      ),
      makeStory(
        "forestry",
        "Fourth forestry story",
        "https://example.com/prev-forest-4",
        "FORESTRY"
      ),
      makeStory(
        "students",
        "Research fellowship opens",
        "https://example.com/prev-student-1",
        "FELLOWSHIP"
      ),
      makeStory(
        "students",
        "Doctoral training call opens",
        "https://example.com/prev-student-2",
        "PHD"
      ),
    ],
    stats: [
      { value: "1", label: "a", source_name: "x", source_url: "https://example.com/s1" },
      { value: "2", label: "b", source_name: "x", source_url: "https://example.com/s2" },
      { value: "3", label: "c", source_name: "x", source_url: "https://example.com/s3" },
      { value: "4", label: "d", source_name: "x", source_url: "https://example.com/s4" },
    ],
    field_note: ["Old note one.", "Old note two."],
  };

  const currentIssue: IssueData = {
    issue_number: 5,
    subject_line: "Issue 05",
    greeting_blurb: "Namaste. New issue.",
    stories: [
      makeStory(
        "india",
        "National AI advisory stack moves toward a bigger policy rollout for farmers",
        "https://example.com/current-india-1",
        "POLICY"
      ),
      makeStory(
        "india",
        "Satellite irrigation audit helps drought districts prioritize canal repairs",
        "https://example.com/current-india-2",
        "WATER"
      ),
      makeStory(
        "india",
        "Maharashtra renews AI agriculture push with another state conference",
        "https://example.com/current-india-3",
        "STATE"
      ),
      makeStory(
        "forestry",
        "Mangrove monitoring tool spots salinity stress weeks earlier",
        "https://example.com/current-forest-1",
        "FORESTRY"
      ),
      makeStory(
        "forestry",
        "Forest restoration benchmark expands",
        "https://example.com/current-forest-2",
        "FORESTRY"
      ),
      makeStory(
        "forestry",
        "Another forestry story",
        "https://example.com/current-forest-3",
        "FORESTRY"
      ),
      makeStory(
        "forestry",
        "Fourth forestry story",
        "https://example.com/current-forest-4",
        "FORESTRY"
      ),
      makeStory(
        "students",
        "Applied ecology AI studio opens cohort for field robotics projects",
        "https://example.com/current-student-1",
        "FELLOWSHIP"
      ),
      makeStory(
        "students",
        "Doctoral training call expands for watershed mapping",
        "https://example.com/current-student-2",
        "PHD"
      ),
    ],
    stats: [
      { value: "10", label: "x", source_name: "x", source_url: "https://example.com/ns1" },
      { value: "20", label: "y", source_name: "x", source_url: "https://example.com/ns2" },
      { value: "30", label: "z", source_name: "x", source_url: "https://example.com/ns3" },
      { value: "40", label: "w", source_name: "x", source_url: "https://example.com/ns4" },
    ],
    field_note: ["New note one.", "New note two."],
  };

  const [card1, card2, card3] = selectTopStoriesWithFreshness(currentIssue, previousIssue);

  assert.equal(card1.headline, "Satellite irrigation audit helps drought districts prioritize canal repairs");
  assert.equal(card2.headline, "Mangrove monitoring tool spots salinity stress weeks earlier");
  assert.equal(card3.headline, "Applied ecology AI studio opens cohort for field robotics projects");
});

test("falls back to legacy ordering when there is no previous issue", () => {
  const issue: IssueData = {
    issue_number: 1,
    subject_line: "Issue 01",
    greeting_blurb: "Namaste. First issue.",
    stories: [
      makeStory("india", "First India story", "https://example.com/i1"),
      makeStory("india", "Second India story", "https://example.com/i2"),
      makeStory("india", "Third India story", "https://example.com/i3"),
      makeStory("forestry", "First Forestry story", "https://example.com/f1"),
      makeStory("forestry", "Second Forestry story", "https://example.com/f2"),
      makeStory("forestry", "Third Forestry story", "https://example.com/f3"),
      makeStory("forestry", "Fourth Forestry story", "https://example.com/f4"),
      makeStory("students", "First Student story", "https://example.com/s1"),
      makeStory("students", "Second Student story", "https://example.com/s2"),
    ],
    stats: [
      { value: "1", label: "a", source_name: "x", source_url: "https://example.com/1" },
      { value: "2", label: "b", source_name: "x", source_url: "https://example.com/2" },
      { value: "3", label: "c", source_name: "x", source_url: "https://example.com/3" },
      { value: "4", label: "d", source_name: "x", source_url: "https://example.com/4" },
    ],
    field_note: ["Note one.", "Note two."],
  };

  const [card1, card2, card3] = selectTopStoriesWithFreshness(issue, null);

  assert.equal(card1.headline, "First India story");
  assert.equal(card2.headline, "First Forestry story");
  assert.equal(card3.headline, "Second India story");
});

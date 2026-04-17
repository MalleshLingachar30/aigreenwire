import type { IssueData, Story } from "@/lib/claude";

const CITE_TAG_PATTERN = /<\/?\s*cite\b[^>]*>/gi;
const ENCODED_CITE_TAG_PATTERN = /&lt;\/?\s*cite\b[^&]*&gt;/gi;
const INDEX_ASSIGNMENT_PATTERN = /\s*index=(?:"[^"]*"|'[^']*')/gi;

export function stripCitationMarkup(value: string): string {
  return value
    .replace(CITE_TAG_PATTERN, "")
    .replace(ENCODED_CITE_TAG_PATTERN, "")
    .replace(INDEX_ASSIGNMENT_PATTERN, "")
    .trim();
}

function sanitizeStory(story: Story): Story {
  const action = story.action ? stripCitationMarkup(story.action) : undefined;

  return {
    section: story.section,
    tag: stripCitationMarkup(story.tag),
    headline: stripCitationMarkup(story.headline),
    paragraphs: story.paragraphs.map((paragraph) => stripCitationMarkup(paragraph)),
    ...(action ? { action } : {}),
    sources: story.sources.map((source) => ({
      name: stripCitationMarkup(source.name),
      url: source.url,
    })),
  };
}

export function sanitizeIssueData(issue: IssueData): IssueData {
  return {
    issue_number: issue.issue_number,
    subject_line: stripCitationMarkup(issue.subject_line),
    greeting_blurb: stripCitationMarkup(issue.greeting_blurb),
    stories: issue.stories.map((story) => sanitizeStory(story)),
    stats: issue.stats.map((stat) => ({
      value: stripCitationMarkup(stat.value),
      label: stripCitationMarkup(stat.label),
      source_name: stripCitationMarkup(stat.source_name),
      source_url: stat.source_url,
    })),
    field_note: issue.field_note.map((paragraph) => stripCitationMarkup(paragraph)),
  };
}

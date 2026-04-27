import type { IssueData, Story } from "@/lib/claude";

export type PreviousIssueContext = {
  issueNumber: number;
  subjectLine: string;
  greetingBlurb: string;
  fieldNote: string[];
  stories: Array<{
    section: Story["section"];
    headline: string;
    sourceUrls: string[];
  }>;
};

export type FreshnessCheckResult = {
  duplicateSourceUrlMatches: Array<{
    currentHeadline: string;
    previousHeadline: string;
    sourceUrl: string;
  }>;
  similarHeadlineMatches: Array<{
    currentHeadline: string;
    previousHeadline: string;
    similarity: number;
  }>;
  similarSubjectLine: {
    currentSubjectLine: string;
    previousSubjectLine: string;
    similarity: number;
  } | null;
};

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "announces",
  "announced",
  "announcing",
  "at",
  "becomes",
  "by",
  "for",
  "from",
  "in",
  "india",
  "indias",
  "into",
  "launch",
  "launches",
  "launched",
  "of",
  "on",
  "the",
  "to",
  "with",
]);

function normalizeWhitespace(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function tokenizeHeadline(value: string): string[] {
  return normalizeWhitespace(value)
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4 && !STOP_WORDS.has(token));
}

function uniqueTokens(value: string): Set<string> {
  return new Set(tokenizeHeadline(value));
}

function jaccardSimilarity(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) {
      intersection += 1;
    }
  }

  const union = new Set([...left, ...right]).size;
  return union === 0 ? 0 : intersection / union;
}

export function buildPreviousIssuePromptBlock(context: PreviousIssueContext): string {
  const storyLines = context.stories
    .map(
      (story, index) =>
        `${index + 1}. [${story.section}] ${story.headline}${
          story.sourceUrls[0] ? ` (${story.sourceUrls[0]})` : ""
        }`
    )
    .join("\n");

  return [
    `Previous issue context to avoid repeating: issue ${context.issueNumber}.`,
    `Previous subject line: ${context.subjectLine}`,
    `Previous greeting blurb: ${context.greetingBlurb}`,
    `Previous field note: ${context.fieldNote.join(" ")}`,
    "Do not reuse the same anchor topics, same angle, same framing, or the same primary source URLs unless there is a materially new development that clearly advances the story.",
    "Every story in the new issue must either come from the past 7 days or be an explicit follow-on where the headline and paragraphs clearly state what changed since last week.",
    "Rewrite the editorial framing each week: vary the subject line angle, the greeting emphasis, and the field note advice so readers do not feel they are reading the same issue twice.",
    "Previous story headlines:",
    storyLines,
  ].join("\n");
}

export function checkIssueFreshness(
  currentIssue: IssueData,
  previousIssue: PreviousIssueContext | null
): FreshnessCheckResult {
  if (!previousIssue) {
    return {
      duplicateSourceUrlMatches: [],
      similarHeadlineMatches: [],
      similarSubjectLine: null,
    };
  }

  const duplicateSourceUrlMatches: FreshnessCheckResult["duplicateSourceUrlMatches"] = [];
  const similarHeadlineMatches: FreshnessCheckResult["similarHeadlineMatches"] = [];
  const subjectSimilarity = jaccardSimilarity(
    uniqueTokens(currentIssue.subject_line),
    uniqueTokens(previousIssue.subjectLine)
  );

  for (const story of currentIssue.stories) {
    const storySourceUrls = new Set(story.sources.map((source) => source.url.trim()));
    const currentTokens = uniqueTokens(story.headline);

    for (const previousStory of previousIssue.stories) {
      const sharedSourceUrl = previousStory.sourceUrls.find((url) => storySourceUrls.has(url));
      if (sharedSourceUrl) {
        duplicateSourceUrlMatches.push({
          currentHeadline: story.headline,
          previousHeadline: previousStory.headline,
          sourceUrl: sharedSourceUrl,
        });
      }

      const similarity = jaccardSimilarity(currentTokens, uniqueTokens(previousStory.headline));
      if (similarity >= 0.34) {
        similarHeadlineMatches.push({
          currentHeadline: story.headline,
          previousHeadline: previousStory.headline,
          similarity,
        });
      }
    }
  }

  return {
    duplicateSourceUrlMatches,
    similarHeadlineMatches,
    similarSubjectLine:
      subjectSimilarity >= 0.4
        ? {
            currentSubjectLine: currentIssue.subject_line,
            previousSubjectLine: previousIssue.subjectLine,
            similarity: subjectSimilarity,
          }
        : null,
  };
}

export function isIssueFreshEnough(result: FreshnessCheckResult): boolean {
  const duplicateSources = result.duplicateSourceUrlMatches.length;
  const similarHeadlines = result.similarHeadlineMatches.length;
  const similarSubjectLine = result.similarSubjectLine !== null;

  return duplicateSources === 0 && similarHeadlines <= 1 && !similarSubjectLine;
}

export function formatFreshnessFailure(result: FreshnessCheckResult): string {
  const lines: string[] = [];

  if (result.duplicateSourceUrlMatches.length > 0) {
    lines.push(
      `duplicate source URLs: ${result.duplicateSourceUrlMatches
        .map((match) => `${match.currentHeadline} <-> ${match.previousHeadline}`)
        .join("; ")}`
    );
  }

  if (result.similarHeadlineMatches.length > 0) {
    lines.push(
      `similar headlines: ${result.similarHeadlineMatches
        .map(
          (match) =>
            `${match.currentHeadline} <-> ${match.previousHeadline} (${match.similarity.toFixed(
              2
            )})`
        )
        .join("; ")}`
    );
  }

  if (result.similarSubjectLine) {
    lines.push(
      `similar subject line: ${result.similarSubjectLine.currentSubjectLine} <-> ${result.similarSubjectLine.previousSubjectLine} (${result.similarSubjectLine.similarity.toFixed(
        2
      )})`
    );
  }

  return lines.join(" | ");
}

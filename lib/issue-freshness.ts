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

export type OpeningLens =
  | "policy"
  | "field-impact"
  | "research"
  | "market"
  | "student-opportunity"
  | "unknown";

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
  repeatedOpeningEntity: {
    entity: string;
    currentOpeningSentence: string;
    previousOpeningSentence: string;
  } | null;
  repeatedOpeningLens: {
    lens: Exclude<OpeningLens, "unknown">;
    currentOpeningSentence: string;
    previousOpeningSentence: string;
  } | null;
  repeatedOpeningStructure: {
    structure: string;
    currentOpeningSentence: string;
    previousOpeningSentence: string;
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

const GENERIC_SINGLE_WORD_ENTITIES = new Set([
  "ai",
  "farmer",
  "farmers",
  "growers",
  "india",
  "indian",
  "namaste",
  "this",
  "watch",
  "week",
]);

const LEADING_ENTITY_WORDS_TO_DROP = new Set([
  "cabinet",
  "chief",
  "department",
  "director",
  "dr",
  "government",
  "minister",
  "ministry",
  "mr",
  "ms",
  "prof",
  "professor",
  "secretary",
  "shri",
  "smt",
  "state",
  "the",
  "union",
]);

const BANNED_OPENING_STARTERS = [
  "this week marks",
  "this week marked",
  "this week signals",
  "this week shows",
  "india positions",
] as const;

const OPENING_LENS_KEYWORDS: Record<Exclude<OpeningLens, "unknown">, string[]> = {
  policy: [
    "budget",
    "cabinet",
    "government",
    "mission",
    "minister",
    "ministry",
    "policy",
    "regulation",
    "scheme",
    "summit",
    "union",
  ],
  "field-impact": [
    "advisory",
    "cooperative",
    "district",
    "extension",
    "farmer",
    "field",
    "grower",
    "harvest",
    "irrigation",
    "yield",
    "village",
  ],
  research: [
    "benchmark",
    "dataset",
    "institute",
    "laboratory",
    "lab",
    "model",
    "paper",
    "published",
    "research",
    "study",
    "trial",
    "university",
  ],
  market: [
    "acquisition",
    "buyers",
    "capital",
    "commercial",
    "credits",
    "funding",
    "investment",
    "market",
    "pricing",
    "revenue",
    "startup",
  ],
  "student-opportunity": [
    "applications",
    "challenge",
    "cohort",
    "fellowship",
    "internship",
    "masters",
    "phd",
    "postdoc",
    "scholarship",
    "student",
    "students",
  ],
};

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

function splitSentences(value: string): string[] {
  return (value.match(/[^.!?]+[.!?]?/g) ?? [])
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function getOpeningSentence(value: string): string {
  const sentences = splitSentences(value);

  for (const sentence of sentences) {
    const normalized = normalizeWhitespace(sentence).replace(/[.!?]+$/g, "");
    if (normalized !== "namaste") {
      return sentence;
    }
  }

  return value.trim();
}

function normalizeEntityPhrase(value: string): string | null {
  const cleaned = value.replace(/[.,:;()]+/g, " ").trim();
  if (!cleaned) {
    return null;
  }

  const words = cleaned
    .split(/\s+/)
    .map((word) => word.toLowerCase())
    .filter(Boolean);

  while (words.length > 0 && LEADING_ENTITY_WORDS_TO_DROP.has(words[0]!)) {
    words.shift();
  }

  if (words.length === 0) {
    return null;
  }

  if (words.length === 1 && GENERIC_SINGLE_WORD_ENTITIES.has(words[0]!)) {
    return null;
  }

  return words.join(" ");
}

function extractLeadOpeningEntity(openingSentence: string): string | null {
  const normalizedSentence = openingSentence.replace(/\./g, " ");
  const matches =
    normalizedSentence.match(
      /(?:[A-Z][A-Za-z0-9-]*|[A-Z]{2,}[A-Za-z0-9-]*)(?:\s+(?:[A-Z][A-Za-z0-9-]*|[A-Z]{2,}[A-Za-z0-9-]*|of|and|for|the|AI))*/g
    ) ?? [];

  for (const match of matches) {
    const normalized = normalizeEntityPhrase(match);
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function scoreOpeningLens(openingSentence: string, keywords: string[]): number {
  const normalized = normalizeWhitespace(openingSentence).replace(/[^a-z0-9\s-]/g, " ");
  return keywords.reduce((score, keyword) => {
    const pattern = new RegExp(`\\b${keyword.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`, "g");
    return score + (normalized.match(pattern)?.length ?? 0);
  }, 0);
}

export function classifyOpeningLens(greetingBlurb: string): OpeningLens {
  const openingSentence = getOpeningSentence(greetingBlurb);
  let bestLens: OpeningLens = "unknown";
  let bestScore = 0;

  for (const [lens, keywords] of Object.entries(OPENING_LENS_KEYWORDS) as Array<
    [Exclude<OpeningLens, "unknown">, string[]]
  >) {
    const score = scoreOpeningLens(openingSentence, keywords);
    if (score > bestScore) {
      bestLens = lens;
      bestScore = score;
    }
  }

  return bestLens;
}

function extractOpeningStructure(openingSentence: string): string | null {
  const normalized = normalizeWhitespace(openingSentence).replace(/[^a-z0-9\s-]/g, " ");

  for (const starter of BANNED_OPENING_STARTERS) {
    if (normalized.startsWith(starter)) {
      return starter;
    }
  }

  const tokens = normalized.split(/\s+/).filter(Boolean);
  if (tokens.length < 3) {
    return null;
  }

  return tokens.slice(0, 3).join(" ");
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
  const previousOpeningSentence = getOpeningSentence(context.greetingBlurb);
  const previousOpeningLens = classifyOpeningLens(context.greetingBlurb);
  const previousOpeningEntity = extractLeadOpeningEntity(previousOpeningSentence);
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
    `Previous opening sentence: ${previousOpeningSentence}`,
    `Previous opening lens: ${previousOpeningLens}`,
    `Previous lead opening entity: ${previousOpeningEntity ?? "none"}`,
    `Previous field note: ${context.fieldNote.join(" ")}`,
    "Do not reuse the same anchor topics, same angle, same framing, or the same primary source URLs unless there is a materially new development that clearly advances the story.",
    "Every story in the new issue must either come from the past 7 days or be an explicit follow-on where the headline and paragraphs clearly state what changed since last week.",
    "Rewrite the editorial framing each week: vary the subject line angle, the greeting emphasis, and the field note advice so readers do not feel they are reading the same issue twice.",
    "Opening freshness rule: do not lead with the same person, institution, programme, ministry, or state in consecutive issues unless there is a materially larger follow-on event. Rotate the opening lens across policy, field impact, research breakthrough, market movement, and student opportunity. Do not reuse formulaic structures such as 'This week marks...' or 'This week marked...'.",
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
      repeatedOpeningEntity: null,
      repeatedOpeningLens: null,
      repeatedOpeningStructure: null,
    };
  }

  const duplicateSourceUrlMatches: FreshnessCheckResult["duplicateSourceUrlMatches"] = [];
  const similarHeadlineMatches: FreshnessCheckResult["similarHeadlineMatches"] = [];
  const currentOpeningSentence = getOpeningSentence(currentIssue.greeting_blurb);
  const previousOpeningSentence = getOpeningSentence(previousIssue.greetingBlurb);
  const currentOpeningEntity = extractLeadOpeningEntity(currentOpeningSentence);
  const previousOpeningEntity = extractLeadOpeningEntity(previousOpeningSentence);
  const currentOpeningLens = classifyOpeningLens(currentIssue.greeting_blurb);
  const previousOpeningLens = classifyOpeningLens(previousIssue.greetingBlurb);
  const currentOpeningStructure = extractOpeningStructure(currentOpeningSentence);
  const previousOpeningStructure = extractOpeningStructure(previousOpeningSentence);
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
    repeatedOpeningEntity:
      currentOpeningEntity &&
      previousOpeningEntity &&
      currentOpeningEntity === previousOpeningEntity
        ? {
            entity: currentOpeningEntity,
            currentOpeningSentence,
            previousOpeningSentence,
          }
        : null,
    repeatedOpeningLens:
      currentOpeningLens !== "unknown" && currentOpeningLens === previousOpeningLens
        ? {
            lens: currentOpeningLens,
            currentOpeningSentence,
            previousOpeningSentence,
          }
        : null,
    repeatedOpeningStructure:
      currentOpeningStructure &&
      previousOpeningStructure &&
      currentOpeningStructure === previousOpeningStructure
        ? {
            structure: currentOpeningStructure,
            currentOpeningSentence,
            previousOpeningSentence,
          }
        : null,
  };
}

export function isIssueFreshEnough(result: FreshnessCheckResult): boolean {
  const duplicateSources = result.duplicateSourceUrlMatches.length;
  const similarHeadlines = result.similarHeadlineMatches.length;
  const similarSubjectLine = result.similarSubjectLine !== null;
  const repeatedOpeningEntity = result.repeatedOpeningEntity !== null;
  const repeatedOpeningLens = result.repeatedOpeningLens !== null;
  const repeatedOpeningStructure = result.repeatedOpeningStructure !== null;

  return (
    duplicateSources === 0 &&
    similarHeadlines <= 1 &&
    !similarSubjectLine &&
    !repeatedOpeningEntity &&
    !repeatedOpeningLens &&
    !repeatedOpeningStructure
  );
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

  if (result.repeatedOpeningEntity) {
    lines.push(
      `repeated opening entity: ${result.repeatedOpeningEntity.entity} (${result.repeatedOpeningEntity.currentOpeningSentence} <-> ${result.repeatedOpeningEntity.previousOpeningSentence})`
    );
  }

  if (result.repeatedOpeningLens) {
    lines.push(
      `repeated opening lens: ${result.repeatedOpeningLens.lens} (${result.repeatedOpeningLens.currentOpeningSentence} <-> ${result.repeatedOpeningLens.previousOpeningSentence})`
    );
  }

  if (result.repeatedOpeningStructure) {
    lines.push(
      `repeated opening structure: ${result.repeatedOpeningStructure.structure} (${result.repeatedOpeningStructure.currentOpeningSentence} <-> ${result.repeatedOpeningStructure.previousOpeningSentence})`
    );
  }

  return lines.join(" | ");
}

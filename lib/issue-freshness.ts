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
  stats: Array<{
    value: string;
    label: string;
    sourceUrl: string;
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
  duplicateStatMatches: Array<{
    currentValue: string;
    currentLabel: string;
    previousValue: string;
    previousLabel: string;
  }>;
  similarFieldNote: {
    similarity: number;
    currentFieldNote: string;
    previousFieldNote: string;
  } | null;
  similarGreetingBlurb: {
    similarity: number;
    currentGreetingBlurb: string;
    previousGreetingBlurb: string;
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

export function buildPreviousIssuePromptBlock(
  contextOrContexts: PreviousIssueContext | PreviousIssueContext[]
): string {
  const contexts = Array.isArray(contextOrContexts) ? contextOrContexts : [contextOrContexts];
  if (contexts.length === 0) {
    return "";
  }

  const blocks: string[] = [];

  for (const context of contexts) {
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

    const statLines = context.stats
      .map(
        (stat, index) =>
          `${index + 1}. ${stat.value} — ${stat.label} (${stat.sourceUrl})`
      )
      .join("\n");

    blocks.push(
      [
        `--- Issue ${context.issueNumber} (do not repeat) ---`,
        `Subject line: ${context.subjectLine}`,
        `Greeting blurb: ${context.greetingBlurb}`,
        `Opening sentence: ${previousOpeningSentence}`,
        `Opening lens: ${previousOpeningLens}`,
        `Lead opening entity: ${previousOpeningEntity ?? "none"}`,
        `Field note: ${context.fieldNote.join(" ")}`,
        "Story headlines:",
        storyLines,
        "Stats (do NOT reuse):",
        statLines,
      ].join("\n")
    );
  }

  const issueNumbers = contexts.map((c) => c.issueNumber).join(", ");

  return [
    `Previous issue context to avoid repeating: issues ${issueNumbers}.`,
    ...blocks,
    "--- Freshness rules ---",
    "Do not reuse the same anchor topics, same angle, same framing, or the same primary source URLs from ANY of the above issues unless there is a materially new development that clearly advances the story.",
    "Every story in the new issue must either come from the past 7 days or be an explicit follow-on where the headline and paragraphs clearly state what changed since last week.",
    "Rewrite the editorial framing each week: vary the subject line angle, the greeting emphasis, and the field note advice so readers do not feel they are reading the same issue twice.",
    "Opening freshness rule: do not lead with the same person, institution, programme, ministry, or state in consecutive issues unless there is a materially larger follow-on event. Rotate the opening lens across policy, field impact, research breakthrough, market movement, and student opportunity. Do not reuse formulaic structures such as 'This week marks...' or 'This week marked...'.",
    "Stats freshness rule: every stat in the new issue must be different from ALL recent issues listed above. Do not reuse any stat value, label, or source URL. Find completely new data points from the past 7 days.",
    "Field note freshness rule: the sandalwood/agroforestry advice must be substantially different from ALL recent issues. Cover a different aspect, season, or practice. Do not rephrase the same advice.",
  ].join("\n");
}

function normalizeStatFingerprint(value: string, label: string): string {
  return normalizeWhitespace(`${value} ${label}`)
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function checkIssueFreshness(
  currentIssue: IssueData,
  previousIssueOrIssues: PreviousIssueContext | PreviousIssueContext[] | null
): FreshnessCheckResult {
  const emptyResult: FreshnessCheckResult = {
    duplicateSourceUrlMatches: [],
    similarHeadlineMatches: [],
    similarSubjectLine: null,
    repeatedOpeningEntity: null,
    repeatedOpeningLens: null,
    repeatedOpeningStructure: null,
    duplicateStatMatches: [],
    similarFieldNote: null,
    similarGreetingBlurb: null,
  };

  if (!previousIssueOrIssues) {
    return emptyResult;
  }

  const previousIssues = Array.isArray(previousIssueOrIssues)
    ? previousIssueOrIssues
    : [previousIssueOrIssues];

  if (previousIssues.length === 0) {
    return emptyResult;
  }

  // The most recent previous issue is used for opening-level (editorial) checks
  const mostRecent = previousIssues[0]!;

  const duplicateSourceUrlMatches: FreshnessCheckResult["duplicateSourceUrlMatches"] = [];
  const similarHeadlineMatches: FreshnessCheckResult["similarHeadlineMatches"] = [];
  const duplicateStatMatches: FreshnessCheckResult["duplicateStatMatches"] = [];

  // Opening-level checks only against most recent issue (N-1)
  const currentOpeningSentence = getOpeningSentence(currentIssue.greeting_blurb);
  const previousOpeningSentence = getOpeningSentence(mostRecent.greetingBlurb);
  const currentOpeningEntity = extractLeadOpeningEntity(currentOpeningSentence);
  const previousOpeningEntity = extractLeadOpeningEntity(previousOpeningSentence);
  const currentOpeningLens = classifyOpeningLens(currentIssue.greeting_blurb);
  const previousOpeningLens = classifyOpeningLens(mostRecent.greetingBlurb);
  const currentOpeningStructure = extractOpeningStructure(currentOpeningSentence);
  const previousOpeningStructure = extractOpeningStructure(previousOpeningSentence);
  const subjectSimilarity = jaccardSimilarity(
    uniqueTokens(currentIssue.subject_line),
    uniqueTokens(mostRecent.subjectLine)
  );

  // Content-level checks against ALL previous issues
  for (const previousIssue of previousIssues) {
    for (const story of currentIssue.stories) {
      const storySourceUrls = new Set(story.sources.map((source) => source.url.trim()));
      const currentTokens = uniqueTokens(story.headline);

      for (const previousStory of previousIssue.stories) {
        const sharedSourceUrl = previousStory.sourceUrls.find((url) => storySourceUrls.has(url));
        if (sharedSourceUrl) {
          const alreadyLogged = duplicateSourceUrlMatches.some(
            (m) => m.sourceUrl === sharedSourceUrl && m.currentHeadline === story.headline
          );
          if (!alreadyLogged) {
            duplicateSourceUrlMatches.push({
              currentHeadline: story.headline,
              previousHeadline: previousStory.headline,
              sourceUrl: sharedSourceUrl,
            });
          }
        }

        const similarity = jaccardSimilarity(currentTokens, uniqueTokens(previousStory.headline));
        if (similarity >= 0.34) {
          const alreadyLogged = similarHeadlineMatches.some(
            (m) => m.currentHeadline === story.headline && m.previousHeadline === previousStory.headline
          );
          if (!alreadyLogged) {
            similarHeadlineMatches.push({
              currentHeadline: story.headline,
              previousHeadline: previousStory.headline,
              similarity,
            });
          }
        }
      }
    }

    // Stats checks against all previous issues
    const previousStatFingerprints = new Set(
      previousIssue.stats.map((stat) => normalizeStatFingerprint(stat.value, stat.label))
    );
    const previousStatSourceUrls = new Set(
      previousIssue.stats.map((stat) => stat.sourceUrl.trim())
    );

    for (const stat of currentIssue.stats) {
      const currentFingerprint = normalizeStatFingerprint(stat.value, stat.label);
      const currentSourceUrl = stat.source_url.trim();

      if (previousStatFingerprints.has(currentFingerprint) || previousStatSourceUrls.has(currentSourceUrl)) {
        const matchedPrevStat = previousIssue.stats.find(
          (prev) =>
            normalizeStatFingerprint(prev.value, prev.label) === currentFingerprint ||
            prev.sourceUrl.trim() === currentSourceUrl
        );
        if (matchedPrevStat) {
          const alreadyLogged = duplicateStatMatches.some(
            (m) => m.currentValue === stat.value && m.currentLabel === stat.label &&
              m.previousValue === matchedPrevStat.value && m.previousLabel === matchedPrevStat.label
          );
          if (!alreadyLogged) {
            duplicateStatMatches.push({
              currentValue: stat.value,
              currentLabel: stat.label,
              previousValue: matchedPrevStat.value,
              previousLabel: matchedPrevStat.label,
            });
          }
        }
      }
    }
  }

  // Field note and greeting similarity — check against the most similar previous issue
  let worstFieldNoteSimilarity = 0;
  let worstFieldNotePreviousText = "";
  let worstGreetingSimilarity = 0;
  let worstGreetingPreviousText = "";
  const currentFieldNoteText = currentIssue.field_note.join(" ");

  for (const previousIssue of previousIssues) {
    const previousFieldNoteText = previousIssue.fieldNote.join(" ");
    const fieldNoteSim = jaccardSimilarity(
      uniqueTokens(currentFieldNoteText),
      uniqueTokens(previousFieldNoteText)
    );
    if (fieldNoteSim > worstFieldNoteSimilarity) {
      worstFieldNoteSimilarity = fieldNoteSim;
      worstFieldNotePreviousText = previousFieldNoteText;
    }

    const greetingSim = jaccardSimilarity(
      uniqueTokens(currentIssue.greeting_blurb),
      uniqueTokens(previousIssue.greetingBlurb)
    );
    if (greetingSim > worstGreetingSimilarity) {
      worstGreetingSimilarity = greetingSim;
      worstGreetingPreviousText = previousIssue.greetingBlurb;
    }
  }

  return {
    duplicateSourceUrlMatches,
    similarHeadlineMatches,
    similarSubjectLine:
      subjectSimilarity >= 0.4
        ? {
            currentSubjectLine: currentIssue.subject_line,
            previousSubjectLine: mostRecent.subjectLine,
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
    duplicateStatMatches,
    similarFieldNote:
      worstFieldNoteSimilarity >= 0.30
        ? {
            similarity: worstFieldNoteSimilarity,
            currentFieldNote: currentFieldNoteText,
            previousFieldNote: worstFieldNotePreviousText,
          }
        : null,
    similarGreetingBlurb:
      worstGreetingSimilarity >= 0.35
        ? {
            similarity: worstGreetingSimilarity,
            currentGreetingBlurb: currentIssue.greeting_blurb,
            previousGreetingBlurb: worstGreetingPreviousText,
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
  const duplicateStats = result.duplicateStatMatches.length;
  const similarFieldNote = result.similarFieldNote !== null;
  const similarGreetingBlurb = result.similarGreetingBlurb !== null;

  return (
    duplicateSources === 0 &&
    similarHeadlines <= 1 &&
    !similarSubjectLine &&
    !repeatedOpeningEntity &&
    !repeatedOpeningLens &&
    !repeatedOpeningStructure &&
    duplicateStats === 0 &&
    !similarFieldNote &&
    !similarGreetingBlurb
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

  if (result.duplicateStatMatches.length > 0) {
    lines.push(
      `duplicate stats: ${result.duplicateStatMatches
        .map(
          (match) =>
            `${match.currentValue} "${match.currentLabel}" <-> ${match.previousValue} "${match.previousLabel}"`
        )
        .join("; ")}`
    );
  }

  if (result.similarFieldNote) {
    lines.push(
      `similar field note (${result.similarFieldNote.similarity.toFixed(2)})`
    );
  }

  if (result.similarGreetingBlurb) {
    lines.push(
      `similar greeting blurb (${result.similarGreetingBlurb.similarity.toFixed(2)})`
    );
  }

  return lines.join(" | ");
}

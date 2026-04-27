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

type TopicLaneDefinition = {
  id: string;
  label: string;
  keywordGroups: string[][];
};

export type TopicLaneMatch = {
  id: string;
  label: string;
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
  repeatedTopicLaneMatches: Array<{
    laneId: string;
    laneLabel: string;
    previousIssueNumber: number;
    previousSubjectLine: string;
  }>;
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

const TOPIC_LANE_DEFINITIONS: TopicLaneDefinition[] = [
  {
    id: "national-ai-farm-policy-push",
    label: "national AI farm policy push",
    keywordGroups: [
      ["ai", "artificial intelligence"],
      ["farm", "farmer", "farmers", "grower", "growers", "agri", "agriculture"],
      ["india", "union", "national"],
      ["policy", "mission", "budget", "scheme", "advisory", "rollout", "minister", "ministry"],
    ],
  },
  {
    id: "national-farm-advisory-rollout",
    label: "national farm advisory rollout",
    keywordGroups: [
      ["national", "nationwide", "india", "union"],
      ["farm", "farmer", "farmers", "grower", "growers", "agri", "agriculture"],
      ["advisory", "guidance", "multilingual", "rollout", "customised", "customized"],
    ],
  },
  {
    id: "bharat-vistaar-advisory-rollout",
    label: "Bharat-VISTAAR advisory rollout",
    keywordGroups: [
      ["bharat-vistaar", "bharat vistaar"],
      ["advisory", "multilingual", "agristack", "customised", "customized"],
      ["farm", "farmer", "farmers", "grower", "growers", "agri", "agriculture"],
    ],
  },
  {
    id: "india-ai-mission-agriculture",
    label: "India AI Mission for agriculture",
    keywordGroups: [
      ["india ai mission", "ai mission", "10372", "10 372", "10372cr", "10372 crore"],
      ["farm", "farmer", "farmers", "grower", "growers", "agri", "agriculture", "advisory"],
    ],
  },
  {
    id: "maharashtra-ai-agriculture-push",
    label: "Maharashtra AI agriculture push",
    keywordGroups: [
      ["maharashtra", "mahaagri-ai", "mahaagri ai", "ai4agri"],
      ["ai", "artificial intelligence"],
      [
        "farm",
        "farmer",
        "farmers",
        "grower",
        "growers",
        "agri",
        "agriculture",
        "conference",
        "summit",
        "policy",
        "platform",
      ],
    ],
  },
];

function normalizeWhitespace(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function normalizeSearchableText(value: string): string {
  return ` ${normalizeWhitespace(value)
    .replace(/[₹]/g, " rupee ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()} `;
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

function containsKeyword(normalizedText: string, keyword: string): boolean {
  const normalizedKeyword = normalizeSearchableText(keyword).trim();
  if (!normalizedKeyword) {
    return false;
  }

  return normalizedText.includes(` ${normalizedKeyword} `);
}

function matchesTopicLane(normalizedText: string, lane: TopicLaneDefinition): boolean {
  return lane.keywordGroups.every((keywords) =>
    keywords.some((keyword) => containsKeyword(normalizedText, keyword))
  );
}

export function detectTopicLanesFromText(value: string): TopicLaneMatch[] {
  const normalizedText = normalizeSearchableText(value);
  return TOPIC_LANE_DEFINITIONS.filter((lane) => matchesTopicLane(normalizedText, lane)).map(
    (lane) => ({
      id: lane.id,
      label: lane.label,
    })
  );
}

export function detectTopicLanesForStory(story: Pick<Story, "section" | "tag" | "headline" | "paragraphs" | "action">): TopicLaneMatch[] {
  return detectTopicLanesFromText(
    [
      story.section,
      story.tag,
      story.headline,
      story.paragraphs.join(" "),
      story.action ?? "",
    ].join(" ")
  );
}

export function detectTopicLanesForIssue(issue: Pick<IssueData, "subject_line" | "greeting_blurb" | "stories">): TopicLaneMatch[] {
  return detectTopicLanesFromText(
    [
      issue.subject_line,
      issue.greeting_blurb,
      ...issue.stories.map((story) =>
        [
          story.section,
          story.tag,
          story.headline,
          story.paragraphs.join(" "),
          story.action ?? "",
        ].join(" ")
      ),
    ].join(" ")
  );
}

function buildPreviousIssueSearchText(context: PreviousIssueContext): string {
  return [
    context.subjectLine,
    context.greetingBlurb,
    ...context.stories.map((story) => `${story.section} ${story.headline}`),
  ].join(" ");
}

function buildCurrentIssueSearchText(issue: IssueData): string {
  return [
    issue.subject_line,
    issue.greeting_blurb,
    ...issue.stories.map((story) =>
      [
        story.section,
        story.tag,
        story.headline,
        story.paragraphs.join(" "),
        story.action ?? "",
      ].join(" ")
    ),
  ].join(" ");
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
    const topicLanes = detectTopicLanesFromText(buildPreviousIssueSearchText(context))
      .map((lane) => lane.label)
      .join("; ");
    const storyLines = context.stories
      .slice(0, 3)
      .map(
        (story, index) => `${index + 1}. [${story.section}] ${story.headline}`
      )
      .join("\n");

    const statLines = context.stats
      .slice(0, 2)
      .map(
        (stat, index) => `${index + 1}. ${stat.value} — ${stat.label}`
      )
      .join("\n");

    blocks.push(
      [
        `--- Issue ${context.issueNumber} ---`,
        `Subject: ${context.subjectLine}`,
        `Opening: ${previousOpeningSentence}`,
        `Lens: ${previousOpeningLens}; Entity: ${previousOpeningEntity ?? "none"}`,
        `Blocked lanes: ${topicLanes || "none"}`,
        `Field note theme: ${context.fieldNote.join(" ")}`,
        "Top headlines to avoid repeating:",
        storyLines,
        "Stats to avoid repeating:",
        statLines,
      ].join("\n")
    );
  }

  const issueNumbers = contexts.map((c) => c.issueNumber).join(", ");

  return [
    `Previous issue context to avoid repeating: issues ${issueNumbers}.`,
    ...blocks,
    "--- Freshness rules ---",
    "Do not reuse the same anchor topics, same angle, or same framing from any of the above issues unless there is a materially new development that clearly advances the story.",
    "Semantic topic-lane rule: avoid re-running the same lane from recent issues even if you rewrite the wording. In particular, do not produce another national AI farm policy push, Bharat-VISTAAR advisory rollout, India AI Mission for agriculture, or Maharashtra AI agriculture push unless there is an unmistakable last-7-days development that materially changes the story.",
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
    repeatedTopicLaneMatches: [],
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
  const repeatedTopicLaneMatches: FreshnessCheckResult["repeatedTopicLaneMatches"] = [];
  const duplicateStatMatches: FreshnessCheckResult["duplicateStatMatches"] = [];
  const currentTopicLaneIds = new Set(
    detectTopicLanesFromText(buildCurrentIssueSearchText(currentIssue)).map((lane) => lane.id)
  );

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
    const previousTopicLanes = detectTopicLanesFromText(buildPreviousIssueSearchText(previousIssue));
    for (const lane of previousTopicLanes) {
      if (!currentTopicLaneIds.has(lane.id)) {
        continue;
      }

      const alreadyLogged = repeatedTopicLaneMatches.some(
        (match) => match.laneId === lane.id && match.previousIssueNumber === previousIssue.issueNumber
      );
      if (!alreadyLogged) {
        repeatedTopicLaneMatches.push({
          laneId: lane.id,
          laneLabel: lane.label,
          previousIssueNumber: previousIssue.issueNumber,
          previousSubjectLine: previousIssue.subjectLine,
        });
      }
    }

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
    repeatedTopicLaneMatches,
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
  const repeatedTopicLanes = result.repeatedTopicLaneMatches.length;
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
    repeatedTopicLanes === 0 &&
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

  if (result.repeatedTopicLaneMatches.length > 0) {
    lines.push(
      `repeated topic lanes: ${result.repeatedTopicLaneMatches
        .map((match) => `${match.laneLabel} (issue ${match.previousIssueNumber}: ${match.previousSubjectLine})`)
        .join("; ")}`
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

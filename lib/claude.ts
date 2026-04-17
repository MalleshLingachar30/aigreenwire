import Anthropic from "@anthropic-ai/sdk";
import { sanitizeIssueData, stripCitationMarkup } from "@/lib/citation-sanitize";

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export type Story = {
  section: "india" | "forestry" | "students";
  tag: string;
  headline: string;
  paragraphs: string[];
  action?: string;
  sources: { name: string; url: string }[];
};

export type IssueData = {
  issue_number: number;
  subject_line: string;
  greeting_blurb: string;
  stories: Story[];
  stats: {
    value: string;
    label: string;
    source_name: string;
    source_url: string;
  }[];
  field_note: string[];
};

const RESEARCH_PROMPT = `You are the research editor for "The AI Green Wire", a weekly newsletter published by Grobet India Agrotech covering AI developments in agriculture, agroforestry, forestry, biodiversity, and ecology — with special emphasis on India and Indian growers.

Your task: use the web_search tool to find the most important developments from the **past 7 days** in these domains. Prioritise:
1. India-specific AI-in-agriculture news (policy, product launches, pilot results)
2. Agroforestry, forestry, and carbon/biodiversity AI developments (global but India-relevant)
3. Opportunities for Indian students and researchers (PhDs, postdocs, challenges)

You should search for at least 6 different queries across these topics. Prefer stories with:
- Named institutions (government ministries, universities, WEF, FAO, Google Research, etc.)
- Concrete numbers (farmers reached, yield gains, funding amounts, accuracy metrics)
- Working URLs from authoritative sources (PIB, Reuters, FAO, WEF, ICAR, Nature, research university sites)

**Return ONLY a valid JSON object** (no markdown fences, no prose commentary) matching this exact shape:

{
  "issue_number": <the number passed in>,
  "subject_line": "The AI Green Wire · Issue NN · <short headline of the week>",
  "greeting_blurb": "<4-5 sentences starting with 'Namaste.' summarising the week's 2-3 biggest stories and why they matter to Indian growers>",
  "stories": [
    {
      "section": "india" | "forestry" | "students",
      "tag": "<short uppercase label, 1-3 words>",
      "headline": "<one-line headline>",
      "paragraphs": [
        "<paragraph 1: what happened, 3-5 sentences>",
        "<paragraph 2: context and implications for Indian growers/foresters, 3-5 sentences>"
      ],
      "action": "<optional 'What you can do:' one-sentence action, or null>",
      "sources": [
        { "name": "<publication name>", "url": "<full URL>" }
      ]
    }
  ],
  "stats": [
    { "value": "<e.g. $8.9B>", "label": "<short label>", "source_name": "<pub>", "source_url": "<url>" }
  ],
  "field_note": [
    "<paragraph 1: 3-5 sentences on what the week's developments mean specifically for sandalwood growers or Indian agroforestry growers>",
    "<paragraph 2: 2-4 sentences of concrete advice on what the reader should do this month>"
  ]
}

Requirements:
- Exactly 3 stories in "india" section
- Exactly 4 stories in "forestry" section
- Exactly 2 stories in "students" section
- Exactly 4 stats
- Every story MUST have at least one source with a real, working URL
- Every source URL must be a full URL starting with https://
- No made-up URLs — only cite sources you actually found via web_search
- Write in clear, accessible British English. No jargon unexplained.
- Sandalwood or Karnataka context welcome in the field_note, but not forced into every story`;

function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeIssueData(input: unknown, issueNumber: number): IssueData {
  if (!input || typeof input !== "object") {
    throw new Error("Claude response payload is not an object.");
  }

  const data = input as Record<string, unknown>;
  const subjectLine =
    typeof data.subject_line === "string"
      ? stripCitationMarkup(data.subject_line)
      : "";
  const greetingBlurb =
    typeof data.greeting_blurb === "string"
      ? stripCitationMarkup(data.greeting_blurb)
      : "";

  if (!subjectLine) {
    throw new Error("Claude response is missing subject_line.");
  }

  if (!greetingBlurb.startsWith("Namaste.")) {
    throw new Error("greeting_blurb must start with 'Namaste.'.");
  }

  if (!Array.isArray(data.stories)) {
    throw new Error("stories must be an array.");
  }

  const stories: Story[] = data.stories.map((story, index) => {
    if (!story || typeof story !== "object") {
      throw new Error(`stories[${index}] must be an object.`);
    }

    const raw = story as Record<string, unknown>;
    const section = raw.section;
    if (section !== "india" && section !== "forestry" && section !== "students") {
      throw new Error(`stories[${index}].section is invalid.`);
    }

    const tag = typeof raw.tag === "string" ? stripCitationMarkup(raw.tag) : "";
    const headline =
      typeof raw.headline === "string"
        ? stripCitationMarkup(raw.headline)
        : "";
    if (!tag || !headline) {
      throw new Error(`stories[${index}] is missing tag/headline.`);
    }

    if (!Array.isArray(raw.paragraphs) || raw.paragraphs.length < 2) {
      throw new Error(`stories[${index}].paragraphs must contain at least 2 entries.`);
    }

    const paragraphs = raw.paragraphs
      .map((paragraph, paragraphIndex) => {
        if (typeof paragraph !== "string" || !paragraph.trim()) {
          throw new Error(`stories[${index}].paragraphs[${paragraphIndex}] is invalid.`);
        }
        return stripCitationMarkup(paragraph);
      })
      .filter(Boolean);

    if (!Array.isArray(raw.sources) || raw.sources.length === 0) {
      throw new Error(`stories[${index}] must include at least one source.`);
    }

    const sources = raw.sources.map((source, sourceIndex) => {
      if (!source || typeof source !== "object") {
        throw new Error(`stories[${index}].sources[${sourceIndex}] is invalid.`);
      }

      const src = source as Record<string, unknown>;
      const name =
        typeof src.name === "string"
          ? stripCitationMarkup(src.name)
          : "";
      const url = typeof src.url === "string" ? src.url.trim() : "";

      if (!name || !url || !isHttpsUrl(url)) {
        throw new Error(`stories[${index}].sources[${sourceIndex}] must include a valid https URL.`);
      }

      return { name, url };
    });

    const action =
      typeof raw.action === "string" && raw.action.trim()
        ? stripCitationMarkup(raw.action)
        : undefined;

    return {
      section,
      tag,
      headline,
      paragraphs,
      ...(action ? { action } : {}),
      sources,
    };
  });

  const indiaCount = stories.filter((story) => story.section === "india").length;
  const forestryCount = stories.filter((story) => story.section === "forestry").length;
  const studentsCount = stories.filter((story) => story.section === "students").length;

  if (indiaCount !== 3 || forestryCount !== 4 || studentsCount !== 2) {
    throw new Error(
      `Section counts invalid: india=${indiaCount}, forestry=${forestryCount}, students=${studentsCount}.`
    );
  }

  if (!Array.isArray(data.stats) || data.stats.length !== 4) {
    throw new Error("stats must contain exactly 4 entries.");
  }

  const stats = data.stats.map((stat, index) => {
    if (!stat || typeof stat !== "object") {
      throw new Error(`stats[${index}] must be an object.`);
    }

    const raw = stat as Record<string, unknown>;
    const value =
      typeof raw.value === "string"
        ? stripCitationMarkup(raw.value)
        : "";
    const label =
      typeof raw.label === "string"
        ? stripCitationMarkup(raw.label)
        : "";
    const source_name =
      typeof raw.source_name === "string"
        ? stripCitationMarkup(raw.source_name)
        : "";
    const source_url = typeof raw.source_url === "string" ? raw.source_url.trim() : "";

    if (!value || !label || !source_name || !isHttpsUrl(source_url)) {
      throw new Error(`stats[${index}] is missing required fields or has invalid source_url.`);
    }

    return { value, label, source_name, source_url };
  });

  if (!Array.isArray(data.field_note) || data.field_note.length !== 2) {
    throw new Error("field_note must contain exactly 2 paragraphs.");
  }

  const field_note = data.field_note.map((paragraph, index) => {
    if (typeof paragraph !== "string" || !paragraph.trim()) {
      throw new Error(`field_note[${index}] is invalid.`);
    }
    return stripCitationMarkup(paragraph);
  });

  return sanitizeIssueData({
    issue_number: issueNumber,
    subject_line: subjectLine,
    greeting_blurb: greetingBlurb,
    stories,
    stats,
    field_note,
  });
}

export async function generateIssue(issueNumber: number): Promise<IssueData> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8000,
    tools: [
      {
        type: "web_search_20250305",
        name: "web_search",
      } as any,
    ],
    messages: [
      {
        role: "user",
        content: `${RESEARCH_PROMPT}\n\nGenerate the content for issue_number: ${issueNumber}. Today's date is ${new Date()
          .toISOString()
          .split("T")[0]}.`,
      },
    ],
  } as any);

  const textBlocks = response.content.filter((block: any) => block.type === "text");
  if (textBlocks.length === 0) {
    throw new Error("Claude returned no text output");
  }

  const raw = (textBlocks[textBlocks.length - 1] as any).text as string;
  const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*$/g, "").trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Claude returned invalid JSON:\n${cleaned.slice(0, 500)}...`);
  }

  return normalizeIssueData(parsed, issueNumber);
}

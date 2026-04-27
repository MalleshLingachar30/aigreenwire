import Anthropic from "@anthropic-ai/sdk";
import { sanitizeIssueData, stripCitationMarkup } from "@/lib/citation-sanitize";
import { buildPreviousIssuePromptBlock, type PreviousIssueContext } from "@/lib/issue-freshness";

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export const ISSUE_GENERATION_MODEL = "claude-sonnet-4-6";

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

type GenerateIssueOptions = {
  /** @deprecated Use previousIssues instead */
  previousIssue?: PreviousIssueContext | null;
  previousIssues?: PreviousIssueContext[] | null;
};

const RESEARCH_PROMPT = `You are the research editor for "The AI Green Wire", a weekly newsletter published by Grobet India Agrotech covering AI developments in agriculture, agroforestry, forestry, biodiversity, and ecology — with special emphasis on India and Indian growers.

Your task: use the web_search tool to find the most important developments from the **past 7 days** in these domains. Prioritise:
1. India-specific AI-in-agriculture news (policy, product launches, pilot results)
2. Agroforestry, forestry, and carbon/biodiversity AI developments (global but India-relevant)
3. Opportunities for Indian students and researchers (PhDs, postdocs, challenges)

Hard budget rule: this run must stay compact to avoid rate limits.
- Use at most 4 broad web_search queries total
- Prefer one strong source per story (max 2 only when essential)
- Keep every sentence factual and concise

Prefer stories with:
- Named institutions (government ministries, universities, WEF, FAO, Google Research, etc.)
- Concrete numbers (farmers reached, yield gains, funding amounts, accuracy metrics)
- Working URLs from authoritative sources (PIB, Reuters, FAO, WEF, ICAR, Nature, research university sites)
- Developments that are genuinely new this week, not lightly reworded continuations of last week's lead items

**Return ONLY a valid JSON object** (no markdown fences, no prose commentary) matching this exact shape:

{
  "issue_number": <the number passed in>,
  "subject_line": "The AI Green Wire · Issue NN · <short headline of the week>",
  "greeting_blurb": "<exactly 3 short sentences starting with 'Namaste.' summarising the week's top signals for Indian growers>",
  "stories": [
    {
      "section": "india" | "forestry" | "students",
      "tag": "<short uppercase label, 1-3 words>",
      "headline": "<one-line headline>",
      "paragraphs": [
        "<paragraph 1: what happened, exactly 2 short sentences>",
        "<paragraph 2: implications for Indian growers/foresters, exactly 2 short sentences>"
      ],
      "action": "<optional 'What you can do:' one short sentence (max 18 words), or null>",
      "sources": [
        { "name": "<publication name>", "url": "<full URL>" }
      ]
    }
  ],
  "stats": [
    { "value": "<e.g. $8.9B>", "label": "<short label>", "source_name": "<pub>", "source_url": "<url>" }
  ],
  "field_note": [
    "<paragraph 1: exactly 2 short sentences on what this means for sandalwood or Indian agroforestry growers>",
    "<paragraph 2: exactly 2 short sentences of concrete advice for this month>"
  ]
}

Requirements:
- Exactly 3 stories in "india" section
- Exactly 4 stories in "forestry" section
- Exactly 2 stories in "students" section
- Exactly 4 stats
- Keep the full JSON response compact; avoid long paragraphs
- Avoid recycling the same editorial frame from the previous issue; the subject line, greeting emphasis, and field note should feel newly written this week
- Avoid recycling the same semantic topic lane from recent issues even if you change the wording. Do not simply rerun the same India national AI-policy, Bharat-VISTAAR-style advisory rollout, India AI Mission agriculture, or Maharashtra AI-agriculture lane unless there is a genuinely material new development in the last 7 days.
- Opening freshness rule for greeting_blurb:
  - The opening must feel clearly new relative to the previous issue
  - Do not lead with the same person, institution, programme, ministry, or state in consecutive issues unless there is a materially larger follow-on development
  - Rotate the opening lens across policy, field impact, research breakthrough, market movement, and student opportunity
  - If last week opened with policy, prefer a different lens this week unless policy news is overwhelmingly dominant
  - Do not reuse formulaic starters such as "This week marks...", "This week marked...", "This week signals...", "This week shows...", or "India positions..."
  - Sentence 1 must identify the single strongest fresh development from the past 7 days
  - Sentence 2 must explain why it matters through this week's chosen lens
  - Sentence 3 must say what readers should watch next
  - If you continue a prior story, explicitly state what changed since last week in the opening
- Every story MUST have at least one source with a real, working URL
- Every source URL must be a full URL starting with https://
- No made-up URLs — only cite sources you actually found via web_search
- If you continue a story from the previous issue, only do so when there is a material new development in the past 7 days and make the "what changed" explicit
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

export async function generateIssue(
  issueNumber: number,
  options?: GenerateIssueOptions
): Promise<IssueData> {
  const previousContexts = options?.previousIssues ?? (options?.previousIssue ? [options.previousIssue] : null);
  const previousIssuePrompt = previousContexts && previousContexts.length > 0
    ? `\n\n${buildPreviousIssuePromptBlock(previousContexts)}`
    : "";

  const response = await anthropic.messages.create({
    model: ISSUE_GENERATION_MODEL,
    // Keep output budget under Sonnet 4 OTPM while preserving issue quality.
    max_tokens: 6000,
    tools: [
      {
        type: "web_search_20250305",
        name: "web_search",
        max_uses: 4,
      } as any,
    ],
    messages: [
      {
        role: "user",
        content: `${RESEARCH_PROMPT}\n\nGenerate the content for issue_number: ${issueNumber}. Today's date is ${new Date()
          .toISOString()
          .split("T")[0]}.${previousIssuePrompt}`,
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

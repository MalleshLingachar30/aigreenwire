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

const RESEARCH_PROMPT = [
  'You are the research editor for "The AI Green Wire", a weekly newsletter published by Grobet India Agrotech covering AI developments in agriculture, agroforestry, forestry, biodiversity, and ecology — with special emphasis on India and Indian growers.',
  "",
  "Your task: use the web_search tool to find the most important developments from the **past 7 days** in these domains. Prioritise:",
  "1. India-specific AI-in-agriculture news (policy, product launches, pilot results)",
  "2. Agroforestry, forestry, and carbon/biodiversity AI developments (global but India-relevant)",
  "3. Opportunities for Indian students and researchers (PhDs, postdocs, challenges)",
  "",
  "Hard budget rule: this run must stay compact to avoid rate limits.",
  "- Use at most 4 broad web_search queries total",
  "- Prefer one strong source per story (max 2 only when essential)",
  "- Keep every sentence factual and concise",
  "",
  "Prefer stories with:",
  "- Named institutions (government ministries, universities, WEF, FAO, Google Research, etc.)",
  "- Concrete numbers (farmers reached, yield gains, funding amounts, accuracy metrics)",
  "- Working URLs from authoritative sources (PIB, Reuters, FAO, WEF, ICAR, Nature, research university sites)",
  "- Developments that are genuinely new this week, not lightly reworded continuations of last week's lead items",
  "- After you finish research, call the store_issue tool with the final issue payload.",
  "- Do not output prose commentary, setup text, or markdown before the final tool call.",
  "",
  "Requirements:",
  "- Use the store_issue tool for the final payload; the tool schema already defines the exact JSON shape.",
  '- subject_line format: "The AI Green Wire · Issue NN · <short headline of the week>"',
  "- greeting_blurb: exactly 3 short sentences and must start with Namaste.",
  '- Exactly 3 stories in "india" section',
  '- Exactly 4 stories in "forestry" section',
  '- Exactly 2 stories in "students" section',
  "- Exactly 4 stats",
  "- field_note: exactly 2 short paragraphs",
  "- Keep the full JSON response compact; avoid long paragraphs",
  "- Avoid recycling the same editorial frame from the previous issue; the subject line, greeting emphasis, and field note should feel newly written this week",
  "- Avoid recycling the same semantic topic lane from recent issues even if you change the wording. Do not simply rerun the same India national AI-policy, Bharat-VISTAAR-style advisory rollout, India AI Mission agriculture, or Maharashtra AI-agriculture lane unless there is a genuinely material new development in the last 7 days.",
  "- Opening freshness rule for greeting_blurb:",
  "  - The opening must feel clearly new relative to the previous issue",
  "  - Do not lead with the same person, institution, programme, ministry, or state in consecutive issues unless there is a materially larger follow-on development",
  "  - Rotate the opening lens across policy, field impact, research breakthrough, market movement, and student opportunity",
  "  - If last week opened with policy, prefer a different lens this week unless policy news is overwhelmingly dominant",
  '  - Do not reuse formulaic starters such as "This week marks...", "This week marked...", "This week signals...", "This week shows...", or "India positions..."',
  "  - Sentence 1 must identify the single strongest fresh development from the past 7 days",
  "  - Sentence 2 must explain why it matters through this week's chosen lens",
  "  - Sentence 3 must say what readers should watch next",
  "  - If you continue a prior story, explicitly state what changed since last week in the opening",
  "- Every story MUST have at least one source with a real, working URL",
  "- Every source URL must be a full URL starting with https://",
  "- No made-up URLs — only cite sources you actually found via web_search",
  "- If you continue a story from the previous issue, only do so when there is a material new development in the past 7 days and make the what-changed explicit",
  "- Write in clear, accessible British English. No jargon unexplained.",
  "- Sandalwood or Karnataka context welcome in the field_note, but not forced into every story",
].join("\n");

function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeGreetingBlurb(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  const sanitized = stripCitationMarkup(value).trim().replace(/^["'`\s]+/, "");
  if (!sanitized) {
    return "";
  }

  const namasteMatch = sanitized.match(/^namaste\b[\s,:;.!-]*/i);
  if (namasteMatch) {
    const remainder = sanitized.slice(namasteMatch[0].length).trim();
    return remainder ? `Namaste. ${remainder}` : "Namaste.";
  }

  return `Namaste. ${sanitized}`;
}

export function extractTextFromAnthropicResponse(response: any): string {
  const textBlocks = response.content.filter((block: any) => block.type === "text");
  const lastText = textBlocks[textBlocks.length - 1]?.text;
  if (typeof lastText !== "string" || !lastText.trim()) {
    throw new Error("Claude returned no text output");
  }

  return lastText.replace(/```json\s*/g, "").replace(/```/g, "").trim();
}

export function parseClaudeJsonLikeText(rawResponse: string): unknown {
  const trimmed = rawResponse.replace(/```json\s*/g, "").replace(/```/g, "").trim();
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  const jsonCandidate =
    firstBrace >= 0 && lastBrace > firstBrace
      ? trimmed.slice(firstBrace, lastBrace + 1)
      : trimmed;

  try {
    return JSON.parse(jsonCandidate);
  } catch {
    throw new Error(`Claude returned invalid JSON:\n${trimmed.slice(0, 500)}...`);
  }
}

export function extractIssuePayloadFromClaudeResponse(response: any): unknown {
  const toolBlock = (response.content as any[]).find(
    (block) => block.type === "tool_use" && block.name === "store_issue"
  ) as { input?: unknown } | undefined;

  if (toolBlock && typeof toolBlock.input === "object") {
    return toolBlock.input;
  }

  return parseClaudeJsonLikeText(extractTextFromAnthropicResponse(response));
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
  const greetingBlurb = normalizeGreetingBlurb(data.greeting_blurb);

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
    max_tokens: 8000,
    tools: [
      {
        type: "web_search_20250305",
        name: "web_search",
        max_uses: 4,
      } as any,
      {
        name: "store_issue",
        description: "Store the final AI Green Wire issue payload as strict JSON.",
        input_schema: {
          type: "object",
          properties: {
            issue_number: { type: "integer" },
            subject_line: { type: "string" },
            greeting_blurb: { type: "string" },
            stories: {
              type: "array",
              minItems: 9,
              maxItems: 9,
              items: {
                type: "object",
                properties: {
                  section: { type: "string", enum: ["india", "forestry", "students"] },
                  tag: { type: "string" },
                  headline: { type: "string" },
                  paragraphs: {
                    type: "array",
                    minItems: 2,
                    items: { type: "string" },
                  },
                  action: { type: ["string", "null"] as any },
                  sources: {
                    type: "array",
                    minItems: 1,
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        url: { type: "string" },
                      },
                      required: ["name", "url"],
                    },
                  },
                },
                required: ["section", "tag", "headline", "paragraphs", "sources"],
              },
            },
            stats: {
              type: "array",
              minItems: 4,
              maxItems: 4,
              items: {
                type: "object",
                properties: {
                  value: { type: "string" },
                  label: { type: "string" },
                  source_name: { type: "string" },
                  source_url: { type: "string" },
                },
                required: ["value", "label", "source_name", "source_url"],
              },
            },
            field_note: {
              type: "array",
              minItems: 2,
              maxItems: 2,
              items: { type: "string" },
            },
          },
          required: [
            "issue_number",
            "subject_line",
            "greeting_blurb",
            "stories",
            "stats",
            "field_note",
          ],
        },
      },
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

  return normalizeIssueData(extractIssuePayloadFromClaudeResponse(response), issueNumber);
}

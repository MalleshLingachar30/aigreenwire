import { NextRequest, NextResponse } from "next/server";
import { anthropic } from "@/lib/claude";
import { sql } from "@/lib/db";
import { isCronRequestAuthorized } from "@/lib/api-auth";
import { sendEmail } from "@/lib/resend";
import { buildAppUrl, isValidEmail, normalizeEmail } from "@/lib/subscription";
import { type Story, renderIssueHtml } from "@/lib/template";

type AnthropicContentBlock = {
  type: string;
  text?: string;
};

type GeneratedStoryPayload = {
  title: string;
  summary: string;
  source: string;
  url: string;
  tag?: string;
};

type GeneratedIssuePayload = {
  title: string;
  subjectLine: string;
  greetingBlurb: string;
  editorNote?: string;
  stories: GeneratedStoryPayload[];
};

type MaxIssueNumberRow = {
  max_issue_number: number | string | null;
};

type DraftIssueRow = {
  id: string;
  issue_number: number;
  slug: string;
  title: string;
  subject_line: string;
  status: string;
};

type InsertedDraft = {
  id: string;
  issueNumber: number;
  slug: string;
  title: string;
  subjectLine: string;
  status: string;
  htmlRendered: string;
};

const MIN_STORIES = 3;
const MAX_STORIES = 5;
const DEFAULT_MODEL = "claude-3-5-sonnet-latest";

function getEditorEmail(): string {
  const raw = process.env.EDITOR_EMAIL ?? "";
  const email = normalizeEmail(raw);

  if (!isValidEmail(email)) {
    throw new Error("EDITOR_EMAIL is missing or invalid.");
  }

  return email;
}

async function resolveAnthropicModel(): Promise<string> {
  const configuredModel = process.env.ANTHROPIC_MODEL?.trim();
  if (configuredModel) {
    return configuredModel;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is missing.");
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/models", {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
    });

    if (!response.ok) {
      return DEFAULT_MODEL;
    }

    const payload = (await response.json()) as {
      data?: Array<{ id?: string }>;
    };
    const models = payload.data ?? [];
    const preferred = models.find((model) => {
      const id = model.id?.toLowerCase() ?? "";
      return id.includes("sonnet") && !id.includes("deprecated");
    });

    return preferred?.id ?? models[0]?.id ?? DEFAULT_MODEL;
  } catch {
    return DEFAULT_MODEL;
  }
}

function extractTextFromBlocks(blocks: AnthropicContentBlock[]): string {
  return blocks
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text as string)
    .join("\n")
    .trim();
}

function extractJsonObject(text: string): string {
  const fencedMatch = text.match(/```json\s*([\s\S]*?)```/i);
  const candidate = fencedMatch?.[1] ?? text;
  const firstBrace = candidate.indexOf("{");
  const lastBrace = candidate.lastIndexOf("}");

  if (firstBrace < 0 || lastBrace <= firstBrace) {
    throw new Error("Claude response did not include a JSON object.");
  }

  return candidate.slice(firstBrace, lastBrace + 1);
}

function normalizeText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const compact = value
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!compact) {
    return null;
  }

  return compact.slice(0, maxLength);
}

function normalizeUrl(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function normalizeStories(rawStories: unknown): Story[] {
  if (!Array.isArray(rawStories)) {
    throw new Error("Claude response stories must be an array.");
  }

  const stories = rawStories
    .map((raw) => {
      if (!raw || typeof raw !== "object") {
        return null;
      }

      const title = normalizeText((raw as { title?: unknown }).title, 180);
      const summary = normalizeText((raw as { summary?: unknown }).summary, 700);
      const source = normalizeText((raw as { source?: unknown }).source, 120);
      const url = normalizeUrl((raw as { url?: unknown }).url);
      const tag = normalizeText((raw as { tag?: unknown }).tag, 80) ?? undefined;

      if (!title || !summary || !source || !url) {
        return null;
      }

      return {
        title,
        summary,
        source,
        url,
        ...(tag ? { tag } : {}),
      };
    })
    .filter((story): story is Story => story !== null);

  if (stories.length < MIN_STORIES) {
    throw new Error("Claude response did not include enough valid stories.");
  }

  return stories.slice(0, MAX_STORIES);
}

function normalizeGeneratedIssue(rawPayload: unknown): GeneratedIssuePayload {
  if (!rawPayload || typeof rawPayload !== "object") {
    throw new Error("Claude response payload is invalid.");
  }

  const payload = rawPayload as Record<string, unknown>;

  const title = normalizeText(payload.title, 220);
  const subjectLine = normalizeText(payload.subjectLine, 220);
  const greetingBlurb = normalizeText(payload.greetingBlurb, 700);
  const editorNote = normalizeText(payload.editorNote, 700) ?? undefined;
  const stories = normalizeStories(payload.stories);

  if (!title || !subjectLine || !greetingBlurb) {
    throw new Error("Claude response is missing required issue fields.");
  }

  return {
    title,
    subjectLine,
    greetingBlurb,
    stories,
    ...(editorNote ? { editorNote } : {}),
  };
}

function slugify(input: string): string {
  const value = input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  return value || "weekly-issue";
}

function buildIssueSlug(issueNumber: number, title: string): string {
  const issueLabel = `issue-${String(issueNumber).padStart(2, "0")}`;
  const titlePart = slugify(title).slice(0, 64).replace(/^-+|-+$/g, "");
  return `${issueLabel}-${titlePart}`.replace(/-+/g, "-");
}

function isUniqueViolation(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.message.toLowerCase().includes("duplicate key value");
}

async function getNextIssueNumber(): Promise<number> {
  const rows = (await sql`
    SELECT COALESCE(MAX(issue_number), 0) AS max_issue_number
    FROM issues
  `) as MaxIssueNumberRow[];

  const max = Number(rows[0]?.max_issue_number ?? 0);
  return Number.isFinite(max) ? max + 1 : 1;
}

async function createDraftIssue(
  generated: GeneratedIssuePayload,
  model: string
): Promise<InsertedDraft> {
  const storiesJson = JSON.stringify(generated.stories);
  const unsubscribePreviewUrl = buildAppUrl("/unsubscribe", {
    token: "preview-only",
    status: "preview",
  });

  const maxAttempts = 3;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const issueNumber = await getNextIssueNumber();
    const slug = buildIssueSlug(issueNumber, generated.title);

    const htmlRendered = renderIssueHtml({
      issueNumber,
      title: generated.title,
      subjectLine: generated.subjectLine,
      greetingBlurb: generated.greetingBlurb,
      stories: generated.stories,
      ...(generated.editorNote ? { editorNote: generated.editorNote } : {}),
      unsubscribeUrl: unsubscribePreviewUrl,
    });

    try {
      const rows = (await sql`
        INSERT INTO issues (
          issue_number,
          slug,
          title,
          subject_line,
          greeting_blurb,
          stories_json,
          html_rendered,
          status,
          metadata
        )
        VALUES (
          ${issueNumber},
          ${slug},
          ${generated.title},
          ${generated.subjectLine},
          ${generated.greetingBlurb},
          ${storiesJson}::jsonb,
          ${htmlRendered},
          'draft',
          ${JSON.stringify({
            generation_model: model,
            generated_by: "cron-generate-route",
          })}::jsonb
        )
        RETURNING
          id::text AS id,
          issue_number,
          slug,
          title,
          subject_line,
          status
      `) as DraftIssueRow[];

      const draft = rows[0];
      if (!draft) {
        throw new Error("Failed to insert generated issue.");
      }

      return {
        id: draft.id,
        issueNumber: Number(draft.issue_number),
        slug: draft.slug,
        title: draft.title,
        subjectLine: draft.subject_line,
        status: draft.status,
        htmlRendered,
      };
    } catch (error) {
      if (isUniqueViolation(error) && attempt < maxAttempts - 1) {
        continue;
      }
      throw error;
    }
  }

  throw new Error("Could not create draft issue after retries.");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildPreviewEnvelopeHtml(draft: InsertedDraft, htmlRendered: string): string {
  const approveEndpoint = buildAppUrl("/api/admin/approve");

  return [
    "<div style=\"font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#0f172a;line-height:1.5;\">",
    `<p><strong>Preview ready:</strong> Issue ${String(draft.issueNumber).padStart(2, "0")} (${escapeHtml(draft.slug)})</p>`,
    `<p>When ready, approve and send-to-self with:</p>`,
    `<pre style="white-space:pre-wrap;background:#f8fafc;border:1px solid #e2e8f0;padding:12px;border-radius:8px;">curl -X POST "${escapeHtml(
      approveEndpoint
    )}" \\\n  -H "Authorization: Bearer &lt;ADMIN_SECRET&gt;" \\\n  -H "Content-Type: application/json" \\\n  -d '{"issueId":"${escapeHtml(
      draft.id
    )}"}'</pre>`,
    "</div>",
    "<hr style=\"margin:20px 0;border:none;border-top:1px solid #e2e8f0;\" />",
    htmlRendered,
  ].join("");
}

async function generateWeeklyIssue(model: string): Promise<GeneratedIssuePayload> {
  const today = new Date().toISOString().slice(0, 10);
  const prompt = [
    "Create one weekly newsletter issue draft for The AI Green Wire.",
    "Audience: agritech founders, forestry teams, and ecology operators in India.",
    `Date context: ${today}. Use developments from the last 7 days where possible.`,
    "Return only JSON, no markdown, using this exact schema:",
    "{",
    '  "title": "string",',
    '  "subjectLine": "string",',
    '  "greetingBlurb": "string",',
    '  "editorNote": "string",',
    '  "stories": [',
    "    {",
    '      "title": "string",',
    '      "summary": "string",',
    '      "source": "string",',
    '      "url": "https://...",',
    '      "tag": "string"',
    "    }",
    "  ]",
    "}",
    "Requirements:",
    "- Include 5 stories.",
    "- Each story summary should be 2-3 sentences and practical.",
    "- URLs must be real HTTP/HTTPS links.",
    "- Keep claims conservative and verifiable.",
  ].join("\n");

  const response = await anthropic.messages.create({
    model,
    max_tokens: 1800,
    temperature: 0.4,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const text = extractTextFromBlocks(
    response.content as unknown as AnthropicContentBlock[]
  );
  const jsonObject = extractJsonObject(text);
  const parsed = JSON.parse(jsonObject) as unknown;
  return normalizeGeneratedIssue(parsed);
}

export async function GET(request: NextRequest) {
  if (!isCronRequestAuthorized(request)) {
    return NextResponse.json(
      { ok: false, message: "Unauthorized cron trigger." },
      { status: 401 }
    );
  }

  try {
    const editorEmail = getEditorEmail();
    const model = await resolveAnthropicModel();
    const generated = await generateWeeklyIssue(model);
    const draft = await createDraftIssue(generated, model);
    const previewHtml = buildPreviewEnvelopeHtml(draft, draft.htmlRendered);
    const previewEmailId = await sendEmail({
      to: editorEmail,
      subject: `[Preview] ${draft.subjectLine}`,
      html: previewHtml,
      tags: [
        { name: "flow", value: "weekly-pipeline" },
        { name: "action", value: "preview" },
        { name: "issue_id", value: draft.id },
      ],
    });

    await sql`
      UPDATE issues
      SET metadata = COALESCE(metadata, '{}'::jsonb) || ${JSON.stringify({
        preview_email_id: previewEmailId,
      })}::jsonb
      WHERE id = ${draft.id}
    `;

    return NextResponse.json(
      {
        ok: true,
        issue: {
          id: draft.id,
          issueNumber: draft.issueNumber,
          slug: draft.slug,
          title: draft.title,
          status: draft.status,
        },
        preview: {
          to: editorEmail,
          messageId: previewEmailId,
        },
        model,
      },
      { status: 201 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate weekly issue.";

    return NextResponse.json(
      {
        ok: false,
        message,
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import {
  generateIssue,
  ISSUE_GENERATION_MODEL,
  type IssueData,
} from "@/lib/claude";
import { sql } from "@/lib/db";
import { isCronRequestAuthorized } from "@/lib/api-auth";
import { sendEmail } from "@/lib/resend";
import { buildAppUrl, isValidEmail, normalizeEmail } from "@/lib/subscription";
import { renderIssue } from "@/lib/template";
import { sanitizeIssueData } from "@/lib/citation-sanitize";
import {
  checkIssueFreshness,
  formatFreshnessFailure,
  isIssueFreshEnough,
  scoreFreshnessViolations,
  type FreshnessCheckResult,
  type PreviousIssueContext,
} from "@/lib/issue-freshness";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

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

type PreviousIssueRow = {
  issue_number: number;
  subject_line: string;
  greeting_blurb: string;
  stories_json: unknown;
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

type GenerationResult = {
  issue: IssueData;
  freshness: FreshnessCheckResult;
  passedFreshness: boolean;
  attempts: number;
};

const MAX_INSERT_ATTEMPTS = 3;
const MAX_GENERATION_ATTEMPTS = 3;
const DEFAULT_MODEL = ISSUE_GENERATION_MODEL;

function getEditorEmail(): string {
  const raw = process.env.EDITOR_EMAIL ?? "";
  const email = normalizeEmail(raw);

  if (!isValidEmail(email)) {
    throw new Error("EDITOR_EMAIL is missing or invalid.");
  }

  return email;
}

function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) {
    throw new Error("NEXT_PUBLIC_SITE_URL is missing.");
  }

  return raw.replace(/\/+$/, "");
}

function getAdminPassword(): string {
  const value = process.env.ADMIN_PASSWORD;
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("ADMIN_PASSWORD is missing.");
  }

  return value.trim();
}

function slugify(input: string): string {
  const value = input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  return value || "weekly-briefing";
}

function extractHeadline(subjectLine: string): string {
  const parts = subjectLine
    .split("·")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 3) {
    return parts[parts.length - 1] as string;
  }

  return subjectLine.trim();
}

function buildIssueSlug(issueNumber: number, subjectLine: string): string {
  const issueLabel = String(issueNumber).padStart(2, "0");
  const headline = extractHeadline(subjectLine);
  const slugPart = slugify(headline).slice(0, 64).replace(/^-+|-+$/g, "");
  return `${issueLabel}-${slugPart}`.replace(/-+/g, "-");
}

function isUniqueViolation(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.message.toLowerCase().includes("duplicate key value");
}

async function cleanUpStaleDrafts(): Promise<number> {
  const rows = (await sql`
    DELETE FROM issues
    WHERE status IN ('draft', 'failed')
      AND generated_at < NOW() - INTERVAL '24 hours'
    RETURNING id
  `) as Array<{ id: string }>;

  return rows.length;
}

async function getNextIssueNumber(): Promise<number> {
  const rows = (await sql`
    SELECT COALESCE(MAX(issue_number), 0) AS max_issue_number
    FROM issues
    WHERE status = 'sent'
  `) as MaxIssueNumberRow[];

  const max = Number(rows[0]?.max_issue_number ?? 0);
  return Number.isFinite(max) ? max + 1 : 1;
}

const PREVIOUS_ISSUES_LOOKBACK = 2;

async function getPreviousIssueContexts(nextIssueNumber: number): Promise<PreviousIssueContext[]> {
  const rows = (await sql`
    SELECT
      issue_number,
      subject_line,
      greeting_blurb,
      stories_json
    FROM issues
    WHERE issue_number < ${nextIssueNumber}
      AND status = 'sent'
    ORDER BY issue_number DESC
    LIMIT ${PREVIOUS_ISSUES_LOOKBACK}
  `) as PreviousIssueRow[];

  return rows.map((previous) => {
    const parsed = sanitizeIssueData(
      JSON.parse(
        typeof previous.stories_json === "string"
          ? previous.stories_json
          : JSON.stringify(previous.stories_json)
      ) as IssueData
    );

    return {
      issueNumber: Number(previous.issue_number),
      subjectLine: previous.subject_line,
      greetingBlurb: previous.greeting_blurb,
      fieldNote: parsed.field_note,
      stories: parsed.stories.map((story) => ({
        section: story.section,
        headline: story.headline,
        sourceUrls: story.sources.map((source) => source.url),
      })),
      stats: parsed.stats.map((stat) => ({
        value: stat.value,
        label: stat.label,
        sourceUrl: stat.source_url,
      })),
    };
  });
}

/**
 * Generate an issue, retrying for freshness up to MAX_GENERATION_ATTEMPTS.
 *
 * If an attempt passes the freshness gate, it is returned immediately. If no
 * attempt passes, we DO NOT fail — we return the least-stale attempt (lowest
 * scoreFreshnessViolations) flagged with passedFreshness=false, so the caller
 * always has an approvable draft to review instead of starting from scratch.
 *
 * Rate-limit backoff is handled inside lib/claude's API wrapper, so there are
 * no blanket sleeps here; this keeps the run comfortably within maxDuration.
 */
async function generateFreshIssue(issueNumber: number): Promise<GenerationResult> {
  const previousIssues = await getPreviousIssueContexts(issueNumber);
  const previousIssueForPrompt = previousIssues.length > 0 ? previousIssues : null;

  let best: GenerationResult | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  let lastFailure = "";

  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const retryHint = attempt > 0 && lastFailure ? lastFailure : null;
    const generated = await generateIssue(issueNumber, {
      previousIssues: previousIssueForPrompt,
      retryHint,
    });
    const freshness = checkIssueFreshness(generated, previousIssueForPrompt);

    if (isIssueFreshEnough(freshness)) {
      return {
        issue: generated,
        freshness,
        passedFreshness: true,
        attempts: attempt + 1,
      };
    }

    const score = scoreFreshnessViolations(freshness);
    if (score < bestScore) {
      bestScore = score;
      best = {
        issue: generated,
        freshness,
        passedFreshness: false,
        attempts: attempt + 1,
      };
    }

    lastFailure = formatFreshnessFailure(freshness);
    console.log(
      `[cron] attempt ${attempt + 1}/${MAX_GENERATION_ATTEMPTS} failed freshness (score ${score}): ${lastFailure}`
    );
  }

  // No attempt passed cleanly — return the least-stale one so a draft is always saved.
  console.log(
    `[cron] no attempt passed freshness; saving best attempt (score ${bestScore}) as a flagged draft.`
  );
  return best!;
}

async function createDraftIssue(generated: IssueData, model: string): Promise<InsertedDraft> {
  const unsubscribePreviewUrl = buildAppUrl("/unsubscribe", {
    token: "preview-only",
    status: "preview",
  });

  for (let attempt = 0; attempt < MAX_INSERT_ATTEMPTS; attempt += 1) {
    const issueNumber = await getNextIssueNumber();
    generated.issue_number = issueNumber;
    const sanitizedIssue = sanitizeIssueData(generated);

    const title = extractHeadline(sanitizedIssue.subject_line);
    const slug = buildIssueSlug(issueNumber, sanitizedIssue.subject_line);
    const htmlRendered = renderIssue(sanitizedIssue, {
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
          ${title},
          ${sanitizedIssue.subject_line},
          ${sanitizedIssue.greeting_blurb},
          ${JSON.stringify(sanitizedIssue)}::jsonb,
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
      if (isUniqueViolation(error) && attempt < MAX_INSERT_ATTEMPTS - 1) {
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

function buildFreshnessBlock(generation: GenerationResult): string {
  if (generation.passedFreshness) {
    return `<div style="margin:0 0 18px;padding:14px 16px;border:1px solid #cfe7da;border-radius:14px;background:#f4fbf6;color:#0f5132;">
      <p style="margin:0;font-size:13px;font-weight:700;">✓ Passed freshness checks (${generation.attempts} attempt${
      generation.attempts === 1 ? "" : "s"
    }). Safe to approve.</p>
    </div>`;
  }

  const warnings = formatFreshnessFailure(generation.freshness) || "freshness gate not satisfied";
  return `<div style="margin:0 0 18px;padding:14px 16px;border:1px solid #f5c000;border-radius:14px;background:#fff8e1;color:#7a5d00;">
    <p style="margin:0 0 8px;font-size:13px;font-weight:700;">⚠ Freshness warnings — review before sending</p>
    <p style="margin:0;font-size:13px;line-height:1.5;">This is the freshest of ${generation.attempts} generation attempt${
    generation.attempts === 1 ? "" : "s"
  }, saved so you can edit rather than start from scratch. Outstanding issues:</p>
    <p style="margin:8px 0 0;font-size:13px;line-height:1.5;color:#5c4600;">${escapeHtml(warnings)}</p>
  </div>`;
}

function buildPreviewEnvelopeHtml(
  draft: InsertedDraft,
  htmlRendered: string,
  generation: GenerationResult
): string {
  const siteUrl = getSiteUrl();
  const encodedPassword = encodeURIComponent(getAdminPassword());
  const previewUrl = `${siteUrl}/api/admin/preview?id=${draft.id}&password=${encodedPassword}`;
  const approveUrl = `${siteUrl}/api/admin/approve?id=${draft.id}&password=${encodedPassword}`;

  const cardsNote = `<div style="margin:0 0 18px;padding:12px 16px;border:1px solid #e2e8f0;border-radius:14px;background:#f8fafc;color:#475569;">
    <p style="margin:0;font-size:13px;line-height:1.5;">WhatsApp cards (Kannada, Telugu, Tamil, Hindi) are generated automatically when you approve & send — no action needed here.</p>
  </div>`;

  return [
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#0f172a;line-height:1.5;">',
    `<p><strong>Preview ready:</strong> Issue ${String(draft.issueNumber).padStart(2, "0")} (${escapeHtml(draft.slug)})</p>`,
    buildFreshnessBlock(generation),
    "<p>Review the draft and approve when ready:</p>",
    cardsNote,
    `<p style="margin:14px 0 16px;">
      <a href="${escapeHtml(previewUrl)}" style="display:inline-block;padding:10px 16px;background:#1d4ed8;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;margin-right:8px;">Preview Draft</a>
      <a href="${escapeHtml(approveUrl)}" style="display:inline-block;padding:10px 16px;background:#166534;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;">Approve &amp; Send</a>
    </p>`,
    `<p style="margin:0 0 6px;"><strong>Preview URL:</strong> <a href="${escapeHtml(previewUrl)}">${escapeHtml(previewUrl)}</a></p>`,
    `<p style="margin:0;"><strong>Approve URL:</strong> <a href="${escapeHtml(approveUrl)}">${escapeHtml(approveUrl)}</a></p>`,
    '</div>',
    '<hr style="margin:20px 0;border:none;border-top:1px solid #e2e8f0;" />',
    htmlRendered,
  ].join("");
}

export async function GET(request: NextRequest) {
  if (!isCronRequestAuthorized(request)) {
    return NextResponse.json(
      { ok: false, message: "Unauthorized cron trigger." },
      { status: 401 }
    );
  }

  try {
    const staleDraftsRemoved = await cleanUpStaleDrafts();
    if (staleDraftsRemoved > 0) {
      console.log(`[cron] Cleaned up ${staleDraftsRemoved} stale draft/failed issue(s).`);
    }

    const editorEmail = getEditorEmail();
    const nextIssueNumber = await getNextIssueNumber();

    // Idempotency guard: if a non-failed issue with this number already exists
    // (e.g. a concurrent/retried cron invocation already generated it this week),
    // skip rather than burn a Claude call and collide on the unique constraint.
    const existing = (await sql`
      SELECT id::text AS id, issue_number, slug, title, status
      FROM issues
      WHERE issue_number = ${nextIssueNumber}
        AND status <> 'failed'
      LIMIT 1
    `) as DraftIssueRow[];

    if (existing[0]) {
      const found = existing[0];
      console.log(
        `[cron] issue #${nextIssueNumber} already exists (status ${found.status}); skipping generation.`
      );
      return NextResponse.json(
        {
          ok: true,
          skipped: true,
          reason: "issue-already-exists",
          issue: {
            id: found.id,
            issueNumber: Number(found.issue_number),
            slug: found.slug,
            title: found.title,
            status: found.status,
          },
        },
        { status: 200 }
      );
    }

    const generation = await generateFreshIssue(nextIssueNumber);
    const draft = await createDraftIssue(generation.issue, DEFAULT_MODEL);

    // WhatsApp cards are intentionally NOT generated here — they are regenerated
    // from scratch at approval time (see app/api/admin/approve/route.ts). Keeping
    // them out of the cron removes the per-card Claude translation latency and the
    // rate-limit sleep that previously pushed the run past maxDuration.
    const previewHtml = buildPreviewEnvelopeHtml(draft, draft.htmlRendered, generation);

    const previewEmailId = await sendEmail({
      to: editorEmail,
      subject: generation.passedFreshness
        ? `[Preview] ${draft.subjectLine}`
        : `[Preview · review freshness] ${draft.subjectLine}`,
      html: previewHtml,
      tags: [
        { name: "flow", value: "weekly-pipeline" },
        { name: "action", value: "preview" },
        { name: "issue_id", value: draft.id },
      ],
    });

    const freshnessWarnings = generation.passedFreshness
      ? null
      : formatFreshnessFailure(generation.freshness);

    await sql`
      UPDATE issues
      SET metadata = COALESCE(metadata, '{}'::jsonb) || ${JSON.stringify({
        preview_email_id: previewEmailId,
        passed_freshness: generation.passedFreshness,
        freshness_warnings: freshnessWarnings,
        generation_attempts: generation.attempts,
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
        freshness: {
          passed: generation.passedFreshness,
          attempts: generation.attempts,
          warnings: freshnessWarnings,
        },
        preview: {
          to: editorEmail,
          messageId: previewEmailId,
        },
        model: DEFAULT_MODEL,
      },
      { status: 201 }
    );
  } catch (error) {
    // A duplicate-key violation means another concurrent invocation won the race
    // and already created this week's issue. That's a success, not a failure —
    // report it as a skip so the cron run is not logged/alerted as a 500.
    if (isUniqueViolation(error)) {
      console.log(
        "[cron] duplicate issue_number on insert — another invocation already generated this week's issue; skipping."
      );
      return NextResponse.json(
        { ok: true, skipped: true, reason: "duplicate-issue-number-race" },
        { status: 200 }
      );
    }

    const message =
      error instanceof Error ? error.message : "Failed to generate weekly issue.";

    console.error(
      "[cron] issue generation failed",
      JSON.stringify({
        message,
        error:
          error instanceof Error
            ? {
                name: error.name,
                message: error.message,
                stack: error.stack,
              }
            : error,
      })
    );

    return NextResponse.json(
      {
        ok: false,
        message,
      },
      { status: 500 }
    );
  }
}

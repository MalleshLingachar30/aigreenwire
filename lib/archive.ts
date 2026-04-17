import { sql } from "@/lib/db";

export type ArchiveStory = {
  title: string;
  summary: string;
  source: string;
  url: string;
  tag?: string;
};

export type ArchiveIssue = {
  id: string;
  issueNumber: number;
  slug: string;
  title: string;
  subjectLine: string;
  greetingBlurb: string;
  stories: ArchiveStory[];
  status: string;
  generatedAt: string;
  approvedAt: string | null;
  sentAt: string | null;
  publishedAt: string;
};

type ArchiveIssueRow = {
  id: string;
  issue_number: number;
  slug: string;
  title: string;
  subject_line: string;
  greeting_blurb: string | null;
  stories_json: unknown;
  status: string;
  generated_at: string;
  approved_at: string | null;
  sent_at: string | null;
};

const DEFAULT_LIST_LIMIT = 30;

function asText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const compact = value.trim();
  if (!compact) {
    return null;
  }

  return compact.slice(0, maxLength);
}

function asUrl(value: unknown): string | null {
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

function parseStories(value: unknown): ArchiveStory[] {
  let storiesInput = value;
  if (typeof value === "string") {
    try {
      storiesInput = JSON.parse(value) as unknown;
    } catch {
      return [];
    }
  }

  if (!Array.isArray(storiesInput)) {
    return [];
  }

  return storiesInput
    .map((story): ArchiveStory | null => {
      if (!story || typeof story !== "object") {
        return null;
      }

      const title = asText((story as { title?: unknown }).title, 180);
      const summary = asText((story as { summary?: unknown }).summary, 700);
      const source = asText((story as { source?: unknown }).source, 120);
      const url = asUrl((story as { url?: unknown }).url);
      const tag = asText((story as { tag?: unknown }).tag, 80) ?? undefined;

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
    .filter((story): story is ArchiveStory => story !== null);
}

function mapArchiveIssue(row: ArchiveIssueRow): ArchiveIssue {
  const publishedAt = row.sent_at ?? row.approved_at ?? row.generated_at;

  return {
    id: row.id,
    issueNumber: Number(row.issue_number),
    slug: row.slug,
    title: row.title,
    subjectLine: row.subject_line,
    greetingBlurb: row.greeting_blurb ?? "",
    stories: parseStories(row.stories_json),
    status: row.status,
    generatedAt: row.generated_at,
    approvedAt: row.approved_at,
    sentAt: row.sent_at,
    publishedAt,
  };
}

function normalizeListLimit(limit?: number): number {
  if (!Number.isFinite(limit)) {
    return DEFAULT_LIST_LIMIT;
  }

  const safe = Math.floor(limit as number);
  if (safe <= 0) {
    return DEFAULT_LIST_LIMIT;
  }

  return Math.min(safe, 100);
}

export function formatIssueNumber(issueNumber: number): string {
  return String(issueNumber).padStart(2, "0");
}

export function formatArchiveDate(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);

  if (Number.isNaN(date.getTime())) {
    return isoTimestamp;
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date);
}

export async function listArchiveIssues(limit?: number): Promise<ArchiveIssue[]> {
  const safeLimit = normalizeListLimit(limit);

  const rows = (await sql`
    SELECT
      id::text AS id,
      issue_number,
      slug,
      title,
      subject_line,
      greeting_blurb,
      stories_json,
      status,
      generated_at::text AS generated_at,
      approved_at::text AS approved_at,
      sent_at::text AS sent_at
    FROM issues
    WHERE status IN ('approved', 'sent')
    ORDER BY COALESCE(sent_at, approved_at, generated_at) DESC, issue_number DESC
    LIMIT ${safeLimit}
  `) as ArchiveIssueRow[];

  return rows.map(mapArchiveIssue);
}

export async function getArchiveIssueBySlug(
  slug: string
): Promise<ArchiveIssue | null> {
  const rows = (await sql`
    SELECT
      id::text AS id,
      issue_number,
      slug,
      title,
      subject_line,
      greeting_blurb,
      stories_json,
      status,
      generated_at::text AS generated_at,
      approved_at::text AS approved_at,
      sent_at::text AS sent_at
    FROM issues
    WHERE slug = ${slug}
      AND status IN ('approved', 'sent')
    LIMIT 1
  `) as ArchiveIssueRow[];

  const issue = rows[0];
  return issue ? mapArchiveIssue(issue) : null;
}

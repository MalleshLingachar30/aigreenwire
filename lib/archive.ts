import type { IssueData, Story } from "@/lib/claude";
import { sql } from "@/lib/db";
import { stripCitationMarkup } from "@/lib/citation-sanitize";
import { isLanguage, type Language } from "@/lib/whatsapp-cards";

export type ArchiveIssue = {
  id: string;
  issueNumber: number;
  slug: string;
  title: string;
  subjectLine: string;
  status: string;
  generatedAt: string;
  approvedAt: string | null;
  sentAt: string | null;
  publishedAt: string;
  availableCardLanguages: Language[];
  data: IssueData;
  htmlRendered: string;
};

type ArchiveIssueRow = {
  id: string;
  issue_number: number;
  slug: string;
  title: string;
  subject_line: string;
  greeting_blurb: string | null;
  stories_json: unknown;
  html_rendered: string;
  status: string;
  generated_at: string;
  approved_at: string | null;
  sent_at: string | null;
  card_languages: unknown;
};

const DEFAULT_LIST_LIMIT = 30;

function asText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const compact = stripCitationMarkup(value);
  if (!compact) {
    return null;
  }

  return compact.slice(0, maxLength);
}

function asHttpsUrl(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function parseStory(input: unknown): Story | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const raw = input as Record<string, unknown>;
  const section = raw.section;
  if (section !== "india" && section !== "forestry" && section !== "students") {
    return null;
  }

  const tag = asText(raw.tag, 80);
  const headline = asText(raw.headline, 220);
  if (!tag || !headline) {
    return null;
  }

  if (!Array.isArray(raw.paragraphs) || raw.paragraphs.length < 2) {
    return null;
  }

  const paragraphs = raw.paragraphs
    .map((paragraph) => asText(paragraph, 2000))
    .filter((paragraph): paragraph is string => paragraph !== null);

  if (paragraphs.length < 2) {
    return null;
  }

  if (!Array.isArray(raw.sources) || raw.sources.length === 0) {
    return null;
  }

  const sources = raw.sources
    .map((source) => {
      if (!source || typeof source !== "object") {
        return null;
      }
      const sourceObj = source as Record<string, unknown>;
      const name = asText(sourceObj.name, 120);
      const url = asHttpsUrl(sourceObj.url);
      if (!name || !url) {
        return null;
      }
      return { name, url };
    })
    .filter((source): source is { name: string; url: string } => source !== null);

  if (sources.length === 0) {
    return null;
  }

  const action = asText(raw.action, 600) ?? undefined;

  return {
    section,
    tag,
    headline,
    paragraphs,
    ...(action ? { action } : {}),
    sources,
  };
}

function parseCardLanguages(value: unknown): Language[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((language): language is Language => isLanguage(language));
}

function parseIssueData(
  value: unknown,
  issueNumber: number,
  subjectLine: string,
  greetingBlurb: string
): IssueData | null {
  let parsedInput = value;
  if (typeof value === "string") {
    try {
      parsedInput = JSON.parse(value) as unknown;
    } catch {
      return null;
    }
  }

  if (!parsedInput || typeof parsedInput !== "object") {
    return null;
  }

  const raw = parsedInput as Record<string, unknown>;
  const storiesRaw = Array.isArray(raw.stories) ? raw.stories : [];
  const stories = storiesRaw
    .map((story) => parseStory(story))
    .filter((story): story is Story => story !== null);

  if (stories.length !== 9) {
    return null;
  }

  const indiaCount = stories.filter((story) => story.section === "india").length;
  const forestryCount = stories.filter((story) => story.section === "forestry").length;
  const studentsCount = stories.filter((story) => story.section === "students").length;
  if (indiaCount !== 3 || forestryCount !== 4 || studentsCount !== 2) {
    return null;
  }

  const statsRaw = Array.isArray(raw.stats) ? raw.stats : [];
  const stats = statsRaw
    .map((stat) => {
      if (!stat || typeof stat !== "object") {
        return null;
      }

      const statObj = stat as Record<string, unknown>;
      const value = asText(statObj.value, 80);
      const label = asText(statObj.label, 240);
      const source_name = asText(statObj.source_name, 120);
      const source_url = asHttpsUrl(statObj.source_url);

      if (!value || !label || !source_name || !source_url) {
        return null;
      }

      return { value, label, source_name, source_url };
    })
    .filter(
      (
        stat
      ): stat is {
        value: string;
        label: string;
        source_name: string;
        source_url: string;
      } => stat !== null
    );

  if (stats.length !== 4) {
    return null;
  }

  const fieldNoteRaw = Array.isArray(raw.field_note) ? raw.field_note : [];
  const field_note = fieldNoteRaw
    .map((paragraph) => asText(paragraph, 2600))
    .filter((paragraph): paragraph is string => paragraph !== null);

  if (field_note.length !== 2) {
    return null;
  }

  const greeting = asText(raw.greeting_blurb, 3200) ?? greetingBlurb;
  if (!greeting.startsWith("Namaste.")) {
    return null;
  }

  const fromPayloadSubject = asText(raw.subject_line, 220) ?? subjectLine;

  return {
    issue_number: issueNumber,
    subject_line: fromPayloadSubject,
    greeting_blurb: greeting,
    stories,
    stats,
    field_note,
  };
}

function mapArchiveIssue(row: ArchiveIssueRow): ArchiveIssue | null {
  const publishedAt = row.sent_at ?? row.approved_at ?? row.generated_at;

  const issueData = parseIssueData(
    row.stories_json,
    Number(row.issue_number),
    row.subject_line,
    row.greeting_blurb ?? ""
  );

  if (!issueData) {
    return null;
  }

  return {
    id: row.id,
    issueNumber: Number(row.issue_number),
    slug: row.slug,
    title: row.title,
    subjectLine: row.subject_line,
    status: row.status,
    generatedAt: row.generated_at,
    approvedAt: row.approved_at,
    sentAt: row.sent_at,
    publishedAt,
    availableCardLanguages: parseCardLanguages(row.card_languages),
    data: issueData,
    htmlRendered: stripCitationMarkup(row.html_rendered),
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
      html_rendered,
      status,
      generated_at::text AS generated_at,
      approved_at::text AS approved_at,
      sent_at::text AS sent_at,
      COALESCE(
        (
          SELECT array_agg(DISTINCT language ORDER BY language)
          FROM whatsapp_cards
          WHERE issue_number = issues.issue_number
        ),
        ARRAY[]::text[]
      ) AS card_languages
    FROM issues
    WHERE status IN ('approved', 'sent')
    ORDER BY COALESCE(sent_at, approved_at, generated_at) DESC, issue_number DESC
    LIMIT ${safeLimit}
  `) as ArchiveIssueRow[];

  return rows
    .map((row) => mapArchiveIssue(row))
    .filter((row): row is ArchiveIssue => row !== null);
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
      html_rendered,
      status,
      generated_at::text AS generated_at,
      approved_at::text AS approved_at,
      sent_at::text AS sent_at,
      COALESCE(
        (
          SELECT array_agg(DISTINCT language ORDER BY language)
          FROM whatsapp_cards
          WHERE issue_number = issues.issue_number
        ),
        ARRAY[]::text[]
      ) AS card_languages
    FROM issues
    WHERE slug = ${slug}
      AND status IN ('approved', 'sent')
    LIMIT 1
  `) as ArchiveIssueRow[];

  const issue = rows[0];
  if (!issue) {
    return null;
  }

  return mapArchiveIssue(issue);
}

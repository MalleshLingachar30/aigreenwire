import { NextRequest, NextResponse } from "next/server";
import { isAdminRequestAuthorized } from "@/lib/api-auth";
import { sql } from "@/lib/db";

type IssueListRow = {
  id: string;
  issue_number: number;
  slug: string;
  title: string;
  subject_line: string;
  status: string;
  generated_at: string;
  approved_at: string | null;
  sent_at: string | null;
  sent_count: number;
};

function parseLimit(value: string | null): number {
  if (!value) {
    return 25;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 25;
  }

  return Math.min(parsed, 100);
}

export async function GET(request: NextRequest) {
  if (!isAdminRequestAuthorized(request)) {
    return NextResponse.json(
      { ok: false, message: "Unauthorized admin request." },
      { status: 401 }
    );
  }

  const limit = parseLimit(request.nextUrl.searchParams.get("limit"));

  try {
    const rows = (await sql`
      SELECT
        id::text AS id,
        issue_number,
        slug,
        title,
        subject_line,
        status,
        generated_at::text AS generated_at,
        approved_at::text AS approved_at,
        sent_at::text AS sent_at,
        sent_count
      FROM issues
      ORDER BY generated_at DESC
      LIMIT ${limit}
    `) as IssueListRow[];

    const issues = rows.map((row) => ({
      id: row.id,
      issueNumber: Number(row.issue_number),
      slug: row.slug,
      title: row.title,
      subjectLine: row.subject_line,
      status: row.status,
      generatedAt: row.generated_at,
      approvedAt: row.approved_at,
      sentAt: row.sent_at,
      sentCount: Number(row.sent_count),
    }));

    return NextResponse.json(
      {
        ok: true,
        issues,
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message: "Failed to fetch issues list.",
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { isAdminRequestAuthorized } from "@/lib/api-auth";
import { sql } from "@/lib/db";
import { isUuidToken } from "@/lib/subscription";

type IssuePreviewRow = {
  id: string;
  issue_number: number;
  slug: string;
  title: string;
  subject_line: string;
  status: string;
  html_rendered: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getSiteUrl(): string {
  const value = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!value) {
    throw new Error("NEXT_PUBLIC_SITE_URL is missing.");
  }

  return value.replace(/\/+$/, "");
}

function getAdminPassword(): string {
  const value = process.env.ADMIN_PASSWORD;
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("ADMIN_PASSWORD is missing.");
  }

  return value;
}

function extractIssueBody(renderedHtml: string): string {
  const bodyMatch = renderedHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch?.[1]) {
    return bodyMatch[1];
  }

  return renderedHtml;
}

function renderPreviewPage(issue: IssuePreviewRow, approveUrl: string): string {
  const issueBody = extractIssueBody(issue.html_rendered);
  const isDraft = issue.status === "draft";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Draft Preview · Issue ${String(issue.issue_number).padStart(2, "0")}</title>
</head>
<body style="margin:0;background:#eef2f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
  <main style="max-width:980px;margin:0 auto;padding:20px 14px 30px;">
    <section style="background:#ffffff;border:1px solid #dbe3ee;border-radius:12px;padding:16px 18px;margin-bottom:16px;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
        <div>
          <div style="font-size:12px;color:#475569;text-transform:uppercase;letter-spacing:0.08em;">Draft Preview</div>
          <h1 style="margin:6px 0 4px;font-size:20px;line-height:1.25;">Issue ${String(issue.issue_number).padStart(
            2,
            "0"
          )} · ${escapeHtml(issue.title)}</h1>
          <p style="margin:0;font-size:14px;color:#334155;">${escapeHtml(issue.subject_line)}</p>
          <p style="margin:8px 0 0;font-size:12px;color:#64748b;">Slug: ${escapeHtml(
            issue.slug
          )} · Status: ${escapeHtml(issue.status)}</p>
        </div>
        ${
          isDraft
            ? `<a href="${escapeHtml(
                approveUrl
              )}" style="display:inline-block;padding:10px 14px;background:#166534;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;">Approve &amp; Send</a>`
            : '<div style="font-size:12px;color:#991b1b;background:#fee2e2;border:1px solid #fecaca;border-radius:8px;padding:8px 10px;">Only drafts can be approved.</div>'
        }
      </div>
    </section>
    <section style="background:#ffffff;border:1px solid #dbe3ee;border-radius:12px;padding:16px;">
      ${issueBody}
    </section>
  </main>
</body>
</html>`;
}

export async function GET(request: NextRequest) {
  if (!isAdminRequestAuthorized(request)) {
    return NextResponse.json(
      { ok: false, message: "Unauthorized admin request." },
      { status: 401 }
    );
  }

  const issueId = request.nextUrl.searchParams.get("id")?.trim() ?? "";
  if (!isUuidToken(issueId)) {
    return NextResponse.json(
      { ok: false, message: "id query param must be a valid UUID." },
      { status: 400 }
    );
  }

  const rows = (await sql`
    SELECT
      id::text AS id,
      issue_number,
      slug,
      title,
      subject_line,
      status,
      html_rendered
    FROM issues
    WHERE id = ${issueId}
    LIMIT 1
  `) as IssuePreviewRow[];

  const issue = rows[0];
  if (!issue) {
    return NextResponse.json({ ok: false, message: "Draft not found." }, { status: 404 });
  }

  const siteUrl = getSiteUrl();
  const encodedPassword = encodeURIComponent(getAdminPassword());
  const approveUrl = `${siteUrl}/api/admin/approve?id=${issue.id}&password=${encodedPassword}`;
  const html = renderPreviewPage(issue, approveUrl);

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
    },
  });
}

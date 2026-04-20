import { NextRequest, NextResponse } from "next/server";
import { isLanguage } from "@/lib/whatsapp-cards";

type RouteParams = {
  issue: string;
  lang: string;
};

function parseIssue(value: string): number | null {
  const issue = Number.parseInt(value, 10);
  if (!Number.isFinite(issue) || issue <= 0) {
    return null;
  }

  return issue;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<RouteParams> }
) {
  const { issue, lang } = await context.params;
  const issueNumber = parseIssue(issue);

  if (!issueNumber || !isLanguage(lang)) {
    return new Response("Invalid short card URL.", { status: 404 });
  }

  const redirectUrl = new URL("/api/cards/language", request.url);
  redirectUrl.searchParams.set("issue", String(issueNumber));
  redirectUrl.searchParams.set("lang", lang);

  return NextResponse.redirect(redirectUrl, { status: 307 });
}

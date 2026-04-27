import { parseIssueNumber } from "@/lib/cards-language-reader";
import { renderIssueHubResponse } from "@/lib/cards-issue-hub";

type RouteParams = {
  issue: string;
};

export async function GET(
  request: Request,
  context: { params: Promise<RouteParams> }
) {
  const { issue } = await context.params;
  const issueNumber = parseIssueNumber(issue);
  const requestUrl = new URL(request.url);
  const shareVersion = requestUrl.searchParams.get("share")?.trim();

  if (!issueNumber) {
    return new Response("Invalid WhatsApp issue URL.", { status: 404 });
  }

  const shortUrl = new URL(`/w/${issueNumber}`, request.url);
  if (shareVersion) {
    shortUrl.searchParams.set("share", shareVersion);
  }

  const ogImageUrl = new URL(`/w/${issueNumber}/share-image`, request.url);
  ogImageUrl.searchParams.set("v", shareVersion || "3");

  return renderIssueHubResponse({
    issueNumber,
    shareMeta: {
      canonicalUrl: shortUrl.toString(),
      pageUrl: shortUrl.toString(),
      ogImageUrl: ogImageUrl.toString(),
    },
  });
}

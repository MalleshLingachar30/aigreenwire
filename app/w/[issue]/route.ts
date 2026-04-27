import {
  parseIssueNumber,
} from "@/lib/cards-language-reader";
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

  if (!issueNumber) {
    return new Response("Invalid WhatsApp issue URL.", { status: 404 });
  }

  const shortUrl = new URL(`/w/${issueNumber}`, request.url).toString();
  const ogImageUrl = new URL(`/w/${issueNumber}/share-image?v=2`, request.url).toString();

  return renderIssueHubResponse({
    issueNumber,
    shareMeta: {
      canonicalUrl: shortUrl,
      pageUrl: shortUrl,
      ogImageUrl,
    },
  });
}

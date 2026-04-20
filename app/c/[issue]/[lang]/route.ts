import { NextRequest } from "next/server";
import {
  parseIssueNumber,
  renderLanguageCardsReaderResponse,
} from "@/lib/cards-language-reader";
import { isLanguage } from "@/lib/whatsapp-cards";

type RouteParams = {
  issue: string;
  lang: string;
};

export async function GET(
  request: NextRequest,
  context: { params: Promise<RouteParams> }
) {
  const { issue, lang } = await context.params;
  const issueNumber = parseIssueNumber(issue);

  if (!issueNumber || !isLanguage(lang)) {
    return new Response("Invalid short card URL.", { status: 404 });
  }

  const shortUrl = new URL(`/c/${issueNumber}/${lang}`, request.url).toString();
  const ogImageUrl = new URL(`/c/${issueNumber}/${lang}/share-image`, request.url).toString();

  return renderLanguageCardsReaderResponse({
    issueNumber,
    language: lang,
    shareMeta: {
      canonicalUrl: shortUrl,
      pageUrl: shortUrl,
      ogImageUrl,
    },
  });
}

import { NextRequest } from "next/server";
import {
  parseIssueNumber,
  renderLanguageCardsReaderResponse,
} from "@/lib/cards-language-reader";
import { isLanguage } from "@/lib/whatsapp-cards";

export async function GET(request: NextRequest) {
  const issueNumber = parseIssueNumber(request.nextUrl.searchParams.get("issue"));
  const languageRaw = request.nextUrl.searchParams.get("lang");

  if (!issueNumber || !isLanguage(languageRaw)) {
    return new Response("Missing or invalid issue/lang query params.", { status: 400 });
  }

  return renderLanguageCardsReaderResponse({
    issueNumber,
    language: languageRaw,
  });
}

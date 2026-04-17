import { NextRequest } from "next/server";
import { renderCardHTML } from "@/lib/card-renderer";
import { getStoredWhatsAppCard, isLanguage } from "@/lib/whatsapp-cards";

function parseIssueNumber(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const issue = Number.parseInt(value, 10);
  if (!Number.isFinite(issue) || issue <= 0) {
    return null;
  }

  return issue;
}

function parseCardNumber(value: string | null): 1 | 2 | 3 | null {
  if (!value) {
    return null;
  }

  const cardNumber = Number.parseInt(value, 10);
  if (cardNumber !== 1 && cardNumber !== 2 && cardNumber !== 3) {
    return null;
  }

  return cardNumber;
}

export async function GET(request: NextRequest) {
  const issueNumber = parseIssueNumber(request.nextUrl.searchParams.get("issue"));
  const languageRaw = request.nextUrl.searchParams.get("lang");
  const cardNumber = parseCardNumber(request.nextUrl.searchParams.get("card"));

  if (!issueNumber || !isLanguage(languageRaw) || !cardNumber) {
    return new Response("Missing or invalid issue/lang/card query params.", { status: 400 });
  }

  const card = await getStoredWhatsAppCard(issueNumber, languageRaw, cardNumber);
  if (!card) {
    return new Response("Card not found.", { status: 404 });
  }

  const html = renderCardHTML({
    issueNumber: card.issueNumber,
    language: card.language,
    cardNumber: card.cardNumber,
    tag: card.tag,
    headline: card.headline,
    summary: card.summary,
    actionText: card.actionText,
    sourceUrl: card.sourceUrl,
    sourceName: card.sourceName,
  });

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
    },
  });
}

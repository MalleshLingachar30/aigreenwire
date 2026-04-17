import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { renderCardHTML } from "@/lib/card-renderer";
import { isLanguage, type Language } from "@/lib/whatsapp-cards";

type CardRow = {
  issue_number: number;
  language: Language;
  card_number: number;
  headline: string;
  summary: string;
  action_text: string;
  tag: string | null;
  source_url: string | null;
  source_name: string | null;
};

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

  const rows = (await sql`
    SELECT
      issue_number,
      language,
      card_number,
      headline,
      summary,
      action_text,
      tag,
      source_url,
      source_name
    FROM whatsapp_cards
    WHERE issue_number = ${issueNumber}
      AND language = ${languageRaw}
      AND card_number = ${cardNumber}
    LIMIT 1
  `) as CardRow[];

  const card = rows[0];
  if (!card) {
    return new Response("Card not found.", { status: 404 });
  }

  const html = renderCardHTML({
    issueNumber: Number(card.issue_number),
    language: card.language,
    cardNumber: card.card_number as 1 | 2 | 3,
    tag: card.tag ?? "",
    headline: card.headline,
    summary: card.summary,
    actionText: card.action_text,
    sourceUrl: card.source_url,
    sourceName: card.source_name,
  });

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
    },
  });
}

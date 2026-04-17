import { NextRequest, NextResponse } from "next/server";
import { isAdminRequestAuthorized } from "@/lib/api-auth";
import { sql } from "@/lib/db";
import { LANGUAGE_CONFIG, type Language } from "@/lib/whatsapp-cards";

type CardRow = {
  issue_number: number;
  language: Language;
  card_number: number;
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function GET(request: NextRequest) {
  if (!isAdminRequestAuthorized(request)) {
    return NextResponse.json(
      { ok: false, message: "Unauthorized admin request." },
      { status: 401 }
    );
  }

  const issueNumber = parseIssueNumber(request.nextUrl.searchParams.get("issue"));
  if (!issueNumber) {
    return NextResponse.json(
      { ok: false, message: "issue query param must be a positive integer." },
      { status: 400 }
    );
  }

  const rows = (await sql`
    SELECT
      issue_number,
      language,
      card_number
    FROM whatsapp_cards
    WHERE issue_number = ${issueNumber}
    ORDER BY language, card_number
  `) as CardRow[];

  if (rows.length === 0) {
    return new Response("No WhatsApp cards found for this issue.", { status: 404 });
  }

  const languages: Language[] = ["kn", "te", "ta", "hi"];
  const groups = new Map<Language, number[]>();

  for (const language of languages) {
    groups.set(language, []);
  }

  for (const row of rows) {
    const cards = groups.get(row.language);
    if (cards) {
      cards.push(Number(row.card_number));
    }
  }

  const sections = languages
    .map((language) => {
      const languageMeta = LANGUAGE_CONFIG[language];
      const cards = groups.get(language) ?? [];
      const cardTiles = cards
        .map(
          (cardNumber) => `
          <div style="width:360px;">
            <div style="font-size:14px;color:#173404;margin:0 0 8px;font-weight:600;">Card ${cardNumber}</div>
            <div style="width:360px;height:640px;overflow:hidden;border:1px solid #d9e7c7;border-radius:14px;background:#ffffff;">
              <iframe
                src="/api/cards/preview?issue=${issueNumber}&lang=${language}&card=${cardNumber}"
                style="width:1080px;height:1920px;border:0;transform:scale(0.333333);transform-origin:top left;"
                loading="lazy"
              ></iframe>
            </div>
          </div>
        `
        )
        .join("");

      return `
        <section style="margin-bottom:36px;">
          <h2 style="margin:0 0 14px;font-size:24px;color:#173404;">${escapeHtml(languageMeta.name)} (${escapeHtml(
        languageMeta.nativeName
      )})</h2>
          <div style="display:flex;flex-wrap:wrap;gap:16px;">${cardTiles}</div>
        </section>
      `;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>WhatsApp Cards Gallery · Issue ${issueNumber}</title>
</head>
<body style="margin:0;padding:22px;background:#f7f6f1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#173404;">
  <main style="max-width:1160px;margin:0 auto;">
    <h1 style="margin:0 0 6px;font-size:30px;">WhatsApp Cards Gallery</h1>
    <p style="margin:0 0 24px;font-size:16px;color:#3b5b1f;">Issue ${issueNumber} · 1080x1920 mobile cards</p>
    ${sections}
  </main>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
    },
  });
}

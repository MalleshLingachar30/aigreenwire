import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { LANGUAGE_CONFIG, isLanguage, type Language } from "@/lib/whatsapp-cards";

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

type CardTheme = {
  pageBackground: string;
  border: string;
  badgeBackground: string;
  badgeText: string;
  heading: string;
  body: string;
  actionBackground: string;
  actionBorder: string;
};

const CARD_THEMES: Record<1 | 2 | 3, CardTheme> = {
  1: {
    pageBackground: "#f6fbf2",
    border: "#d8ebc9",
    badgeBackground: "#deefcd",
    badgeText: "#264b0b",
    heading: "#1d3b07",
    body: "#2b4813",
    actionBackground: "#edf7e3",
    actionBorder: "#b8d99a",
  },
  2: {
    pageBackground: "#fff7ee",
    border: "#f2debf",
    badgeBackground: "#fbe9ce",
    badgeText: "#6b3d03",
    heading: "#5e3402",
    body: "#6d430f",
    actionBackground: "#fff0da",
    actionBorder: "#efcb9a",
  },
  3: {
    pageBackground: "#eef9f8",
    border: "#cdebe7",
    badgeBackground: "#daf2ef",
    badgeText: "#0d514c",
    heading: "#094540",
    body: "#18504b",
    actionBackground: "#e2f4f1",
    actionBorder: "#b9e1dc",
  },
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

function getLanguageFont(language: Language): string {
  if (language === "kn") {
    return "'Noto Sans Kannada', 'Noto Sans', sans-serif";
  }

  if (language === "te") {
    return "'Noto Sans Telugu', 'Noto Sans', sans-serif";
  }

  if (language === "ta") {
    return "'Noto Sans Tamil', 'Noto Sans', sans-serif";
  }

  return "'Noto Sans Devanagari', 'Noto Sans', sans-serif";
}

export async function GET(request: NextRequest) {
  const issueNumber = parseIssueNumber(request.nextUrl.searchParams.get("issue"));
  const languageRaw = request.nextUrl.searchParams.get("lang");

  if (!issueNumber || !isLanguage(languageRaw)) {
    return new Response("Missing or invalid issue/lang query params.", { status: 400 });
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
    ORDER BY card_number ASC
  `) as CardRow[];

  if (rows.length === 0) {
    return new Response("No WhatsApp cards found for this issue and language.", { status: 404 });
  }

  const language = rows[0]!.language;
  const languageMeta = LANGUAGE_CONFIG[language];
  const fontFamily = getLanguageFont(language);
  const cardHtml = rows
    .map((card) => {
      const cardNumber = card.card_number === 2 ? 2 : card.card_number === 3 ? 3 : 1;
      const theme = CARD_THEMES[cardNumber];
      const tag = card.tag?.trim() ? card.tag : "AI GREEN WIRE";
      const sourceName = card.source_name?.trim() || "AI Green Wire Desk";

      return `<article style="background:${theme.pageBackground};border:1px solid ${theme.border};border-radius:16px;padding:18px 16px 16px;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px;">
          <span style="font-size:12px;font-weight:700;letter-spacing:0.03em;text-transform:uppercase;color:#0f172a;">Card ${cardNumber}</span>
          <span style="font-size:11px;font-weight:700;line-height:1;background:${theme.badgeBackground};color:${theme.badgeText};padding:7px 10px;border-radius:999px;letter-spacing:0.04em;text-transform:uppercase;">${escapeHtml(
            tag
          )}</span>
        </div>
        <h2 style="margin:0 0 10px;font-size:23px;line-height:1.25;color:${theme.heading};font-weight:700;">${escapeHtml(
          card.headline
        )}</h2>
        <p style="margin:0 0 14px;font-size:17px;line-height:1.6;color:${theme.body};">${escapeHtml(
          card.summary
        )}</p>
        <section style="background:${theme.actionBackground};border:1px solid ${theme.actionBorder};border-radius:12px;padding:12px;">
          <div style="font-size:13px;font-weight:700;color:${theme.badgeText};margin-bottom:6px;">${escapeHtml(
            languageMeta.actionText
          )}</div>
          <div style="font-size:17px;line-height:1.55;color:${theme.body};">${escapeHtml(
            card.action_text
          )}</div>
        </section>
        <footer style="margin-top:12px;font-size:13px;line-height:1.5;color:${theme.body};display:flex;flex-direction:column;gap:6px;">
          <div><strong>${escapeHtml(languageMeta.sourceText)}:</strong> ${escapeHtml(sourceName)}</div>
          ${
            card.source_url
              ? `<a href="${escapeHtml(
                  card.source_url
                )}" target="_blank" rel="noopener noreferrer" style="color:${theme.badgeText};font-weight:600;text-decoration:none;">${escapeHtml(
                  languageMeta.readMoreText
                )}</a>`
              : ""
          }
        </footer>
      </article>`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>AI Green Wire Cards · Issue ${issueNumber} · ${escapeHtml(languageMeta.name)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;600;700&family=Noto+Sans+Kannada:wght@400;600;700&family=Noto+Sans+Telugu:wght@400;600;700&family=Noto+Sans+Tamil:wght@400;600;700&family=Noto+Sans+Devanagari:wght@400;600;700&display=swap" rel="stylesheet" />
</head>
<body style="margin:0;background:#f8fafc;color:#0f172a;font-family:${fontFamily};">
  <main style="max-width:560px;margin:0 auto;padding:18px 14px 28px;">
    <header style="margin-bottom:16px;">
      <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;">AI Green Wire</p>
      <h1 style="margin:0 0 4px;font-size:28px;line-height:1.2;font-weight:800;color:#0f172a;">Issue ${String(
        issueNumber
      ).padStart(2, "0")} · ${escapeHtml(languageMeta.name)}</h1>
      <p style="margin:0;font-size:16px;line-height:1.45;color:#334155;">${escapeHtml(
        languageMeta.nativeName
      )} · 3-card mobile reader</p>
    </header>
    <section style="display:flex;flex-direction:column;gap:12px;">${cardHtml}</section>
  </main>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}

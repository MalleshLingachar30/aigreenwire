import { sql } from "@/lib/db";
import { LANGUAGE_CONFIG, type Language } from "@/lib/whatsapp-cards";

type HubCardRow = {
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

type ShareMeta = {
  canonicalUrl: string;
  pageUrl: string;
  ogImageUrl: string;
};

type HubRenderOptions = {
  issueNumber: number;
  shareMeta?: ShareMeta;
};

const LANGUAGE_SEQUENCE: Language[] = ["kn", "te", "ta", "hi"];

const LANGUAGE_BACKGROUND: Record<Language, string> = {
  kn: "#f6fbf2",
  te: "#eef9f8",
  ta: "#fff7ee",
  hi: "#f8f5ff",
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildShareMetaTags(options: {
  title: string;
  description: string;
  ogImageAlt: string;
  shareMeta: ShareMeta;
}): string {
  const title = escapeHtml(options.title);
  const description = escapeHtml(options.description);
  const ogImageAlt = escapeHtml(options.ogImageAlt);
  const canonicalUrl = escapeHtml(options.shareMeta.canonicalUrl);
  const pageUrl = escapeHtml(options.shareMeta.pageUrl);
  const ogImageUrl = escapeHtml(options.shareMeta.ogImageUrl);

  return [
    `<link rel="canonical" href="${canonicalUrl}" />`,
    `<meta name="description" content="${description}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="AI Green Wire" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${pageUrl}" />`,
    `<meta property="og:image" content="${ogImageUrl}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:type" content="image/png" />`,
    `<meta property="og:image:alt" content="${ogImageAlt}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    `<meta name="twitter:image" content="${ogImageUrl}" />`,
    `<meta name="twitter:image:alt" content="${ogImageAlt}" />`,
  ].join("\n  ");
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

export async function loadIssueHubCards(
  issueNumber: number
): Promise<Map<Language, HubCardRow[]>> {
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
    ORDER BY language ASC, card_number ASC
  `) as HubCardRow[];

  const groups = new Map<Language, HubCardRow[]>();
  for (const language of LANGUAGE_SEQUENCE) {
    groups.set(language, []);
  }

  for (const row of rows) {
    groups.get(row.language)?.push(row);
  }

  return groups;
}

export async function renderIssueHubResponse(
  options: HubRenderOptions
): Promise<Response> {
  const groups = await loadIssueHubCards(options.issueNumber);
  const totalCards = Array.from(groups.values()).reduce((count, cards) => count + cards.length, 0);

  if (totalCards === 0) {
    return new Response("No WhatsApp cards found for this issue.", { status: 404 });
  }

  const issueLabel = String(options.issueNumber).padStart(2, "0");
  const pageTitle = `AI Green Wire WhatsApp Cards · Issue ${issueLabel}`;
  const description = `Issue ${issueLabel} WhatsApp hub with 12 AI Green Wire cards grouped by Kannada, Telugu, Tamil, and Hindi.`;
  const socialTags = options.shareMeta
    ? buildShareMetaTags({
        title: pageTitle,
        description,
        ogImageAlt: `AI Green Wire Issue ${issueLabel} WhatsApp cards in four Indian languages`,
        shareMeta: options.shareMeta,
      })
    : "";

  const jumpLinks = LANGUAGE_SEQUENCE.map((language) => {
    const meta = LANGUAGE_CONFIG[language];
    const count = groups.get(language)?.length ?? 0;

    return `<a href="#${language}" style="display:inline-flex;align-items:center;gap:8px;border:1px solid #d1d5db;border-radius:999px;padding:10px 14px;background:#ffffff;color:#0f172a;text-decoration:none;font-size:14px;font-weight:700;">
      <span>${escapeHtml(meta.name)}</span>
      <span style="font-size:12px;color:#64748b;">${count} cards</span>
    </a>`;
  }).join("");

  const sections = LANGUAGE_SEQUENCE.map((language) => {
    const meta = LANGUAGE_CONFIG[language];
    const cards = groups.get(language) ?? [];
    const fontFamily = getLanguageFont(language);
    const sectionBackground = LANGUAGE_BACKGROUND[language];

    const cardsHtml = cards
      .map((card) => {
        const tag = card.tag?.trim() ? card.tag : "AI GREEN WIRE";
        const sourceName = card.source_name?.trim() || "AI Green Wire Desk";

        return `<article style="background:#ffffff;border:1px solid #d7e3d0;border-radius:16px;padding:16px;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px;">
            <span style="font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#334155;">Card ${card.card_number}</span>
            <span style="font-size:11px;font-weight:700;line-height:1;background:#e5f1d6;color:#305314;padding:7px 10px;border-radius:999px;letter-spacing:0.04em;text-transform:uppercase;">${escapeHtml(
              tag
            )}</span>
          </div>
          <h3 style="margin:0 0 10px;font-size:22px;line-height:1.25;color:#0f172a;font-weight:800;">${escapeHtml(
            card.headline
          )}</h3>
          <p style="margin:0 0 14px;font-size:17px;line-height:1.6;color:#334155;">${escapeHtml(
            card.summary
          )}</p>
          <section style="background:#f7fbf2;border:1px solid #d7e7c5;border-radius:12px;padding:12px;margin-bottom:12px;">
            <div style="font-size:13px;font-weight:700;color:#365314;margin-bottom:6px;">${escapeHtml(
              meta.actionText
            )}</div>
            <div style="font-size:16px;line-height:1.55;color:#1f2937;">${escapeHtml(
              card.action_text
            )}</div>
          </section>
          <footer style="display:flex;flex-direction:column;gap:6px;font-size:13px;line-height:1.5;color:#475569;">
            <div><strong>${escapeHtml(meta.sourceText)}:</strong> ${escapeHtml(sourceName)}</div>
            ${
              card.source_url
                ? `<a href="${escapeHtml(
                    card.source_url
                  )}" target="_blank" rel="noopener noreferrer" style="color:#0f766e;font-weight:700;text-decoration:none;">${escapeHtml(
                    meta.readMoreText
                  )}</a>`
                : ""
            }
          </footer>
        </article>`;
      })
      .join("");

    return `<section id="${language}" style="margin:0 0 20px;padding:18px;border:1px solid #dbe4d1;border-radius:22px;background:${sectionBackground};">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:14px;">
        <div>
          <h2 style="margin:0 0 4px;font-size:24px;line-height:1.2;color:#0f172a;">${escapeHtml(
            meta.name
          )}</h2>
          <p style="margin:0;font-size:17px;line-height:1.45;color:#475569;font-family:${fontFamily};">${escapeHtml(
            meta.nativeName
          )} · 3-card reader</p>
        </div>
        <a href="/c/${options.issueNumber}/${language}" style="display:inline-flex;align-items:center;border:1px solid #cbd5e1;border-radius:999px;padding:10px 14px;background:#ffffff;color:#0f172a;text-decoration:none;font-size:14px;font-weight:700;">Open only ${escapeHtml(
          meta.name
        )}</a>
      </div>
      <div style="display:flex;flex-direction:column;gap:12px;font-family:${fontFamily};">${cardsHtml}</div>
    </section>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(pageTitle)}</title>
  ${socialTags}
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;600;700;800&family=Noto+Sans+Kannada:wght@400;600;700;800&family=Noto+Sans+Telugu:wght@400;600;700;800&family=Noto+Sans+Tamil:wght@400;600;700;800&family=Noto+Sans+Devanagari:wght@400;600;700;800&display=swap" rel="stylesheet" />
</head>
<body style="margin:0;background:linear-gradient(180deg,#f8fafc 0%,#eef6ec 100%);color:#0f172a;font-family:'Noto Sans',sans-serif;">
  <main style="max-width:720px;margin:0 auto;padding:18px 14px 36px;">
    <header style="margin-bottom:18px;padding:20px 18px;border-radius:24px;background:linear-gradient(135deg,#184e1d 0%,#0f766e 100%);color:#f8fafc;">
      <p style="margin:0 0 8px;font-size:12px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;opacity:0.8;">AI Green Wire</p>
      <h1 style="margin:0 0 8px;font-size:31px;line-height:1.15;font-weight:800;">WhatsApp Cards · Issue ${issueLabel}</h1>
      <p style="margin:0 0 14px;font-size:17px;line-height:1.55;opacity:0.92;">One shareable hub for all 12 cards across Kannada, Telugu, Tamil, and Hindi.</p>
      <div style="display:flex;flex-wrap:wrap;gap:10px;">${jumpLinks}</div>
    </header>
    <section style="margin-bottom:16px;padding:16px;border:1px solid #dbe4d1;border-radius:18px;background:#ffffff;">
      <p style="margin:0;font-size:15px;line-height:1.6;color:#334155;">Send this single link when you want one multilingual WhatsApp-ready issue page. Readers can jump to their language or open the language-only short links from each section.</p>
    </section>
    ${sections}
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

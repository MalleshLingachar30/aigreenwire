import { stripCitationMarkup } from "@/lib/citation-sanitize";
import { LANGUAGE_CONFIG, type Language, type TranslatedCard } from "@/lib/whatsapp-cards";

type AccentTheme = {
  background: string;
  accent: string;
  accentSoft: string;
  textDark: string;
};

export type RenderableCard = TranslatedCard & {
  issueNumber: number;
};

const CARD_THEMES: Record<1 | 2 | 3, AccentTheme> = {
  1: {
    background: "#F4FAEE",
    accent: "#3B6D11",
    accentSoft: "#CDE6B2",
    textDark: "#143009",
  },
  2: {
    background: "#FFF6EA",
    accent: "#BA7517",
    accentSoft: "#F7D4A7",
    textDark: "#4B2A04",
  },
  3: {
    background: "#EEF8F7",
    accent: "#0D7A73",
    accentSoft: "#B4E5E1",
    textDark: "#053A36",
  },
};

const LOGO_URL = "https://aigreenwire.com/assets/grobet-logo.png";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeCardText(value: string): string {
  return stripCitationMarkup(value).replace(/\s+/g, " ").trim();
}

function toRenderableSourceUrl(value: string | null): string | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
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

export function renderCardHTML(card: RenderableCard): string {
  const languageMeta = LANGUAGE_CONFIG[card.language];
  const theme = CARD_THEMES[card.cardNumber];
  const fontFamily = getLanguageFont(card.language);
  const issueLabel = String(card.issueNumber).padStart(2, "0");
  const safeTag = sanitizeCardText(card.tag);
  const safeHeadline = sanitizeCardText(card.headline);
  const safeSummary = sanitizeCardText(card.summary);
  const safeActionText = sanitizeCardText(card.actionText);
  const sanitizedSourceName = card.sourceName ? sanitizeCardText(card.sourceName) : "";
  const sourceName = sanitizedSourceName ? escapeHtml(sanitizedSourceName) : "AI Green Wire Desk";
  const sourceUrl = toRenderableSourceUrl(card.sourceUrl);
  const footerJustify = sourceUrl ? "space-between" : "flex-start";
  const readMoreCta = sourceUrl
    ? `<a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;font-size:28px;font-weight:700;color:#ffffff;background:${theme.accent};padding:16px 24px;border-radius:14px;">
        ${escapeHtml(languageMeta.readMoreText)}
      </a>`
    : "";

  return `<!DOCTYPE html>
<html lang="${card.language}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>AI Green Wire WhatsApp Card ${card.cardNumber}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;600;700&family=Noto+Sans+Kannada:wght@400;600;700&family=Noto+Sans+Telugu:wght@400;600;700&family=Noto+Sans+Tamil:wght@400;600;700&family=Noto+Sans+Devanagari:wght@400;600;700&display=swap" rel="stylesheet" />
</head>
<body style="margin:0;padding:0;background:#0f172a;display:flex;align-items:center;justify-content:center;min-height:100vh;">
  <article style="width:1080px;height:1920px;box-sizing:border-box;background:${theme.background};border:8px solid ${theme.accentSoft};padding:92px 88px 78px;font-family:${fontFamily};position:relative;display:flex;flex-direction:column;color:${theme.textDark};">
    <header style="display:flex;align-items:center;justify-content:space-between;margin-bottom:54px;">
      <div style="display:flex;align-items:center;gap:18px;">
        <div style="width:92px;height:92px;border-radius:999px;background:${theme.accentSoft};overflow:hidden;position:relative;text-align:center;line-height:92px;color:${theme.accent};font-weight:700;font-size:28px;letter-spacing:1px;">
          GB
          <img src="${LOGO_URL}" alt="Grow Better India" width="92" height="92" style="display:block;width:92px;height:92px;object-fit:cover;position:absolute;inset:0;border-radius:999px;" onerror="this.style.display='none'" />
        </div>
        <div>
          <div style="font-size:34px;font-weight:700;line-height:1.15;color:${theme.accent};">The AI Green Wire</div>
          <div style="font-size:28px;line-height:1.25;opacity:0.9;">${escapeHtml(languageMeta.weeklyBriefText)}</div>
        </div>
      </div>
      <div style="text-align:right;">
        <div style="display:inline-block;font-size:28px;font-weight:700;color:#ffffff;background:${theme.accent};padding:12px 22px;border-radius:999px;margin-bottom:14px;">
          ${escapeHtml(languageMeta.issueText)} ${issueLabel}
        </div>
        <div style="font-size:28px;font-weight:600;color:${theme.textDark};">${escapeHtml(languageMeta.nativeName)}</div>
      </div>
    </header>

    <div style="margin-bottom:26px;">
      <span style="display:inline-block;padding:8px 18px;border-radius:999px;background:${theme.accentSoft};color:${theme.accent};font-size:24px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;">
        ${escapeHtml(safeTag)}
      </span>
    </div>

    <h1 style="margin:0 0 30px;font-size:64px;line-height:1.18;color:${theme.textDark};font-weight:700;">
      ${escapeHtml(safeHeadline)}
    </h1>

    <p style="margin:0 0 36px;font-size:38px;line-height:1.5;color:${theme.textDark};">
      ${escapeHtml(safeSummary)}
    </p>

    <section style="margin-top:auto;background:#ffffff;border:3px solid ${theme.accentSoft};border-left:12px solid ${theme.accent};border-radius:20px;padding:30px 32px 30px;">
      <div style="font-size:25px;font-weight:700;color:${theme.accent};letter-spacing:0.2px;margin-bottom:12px;">
        ${escapeHtml(languageMeta.actionText)}
      </div>
      <div style="font-size:35px;line-height:1.45;color:${theme.textDark};">
        ${escapeHtml(safeActionText)}
      </div>
    </section>

    <footer style="margin-top:32px;padding-top:26px;border-top:3px solid ${theme.accentSoft};display:flex;align-items:flex-end;justify-content:${footerJustify};gap:20px;">
      <div style="font-size:24px;color:${theme.textDark};line-height:1.4;">
        <div style="margin-bottom:8px;"><strong>${escapeHtml(languageMeta.sourceText)}:</strong> ${sourceName}</div>
        <div style="font-size:22px;opacity:0.85;">aigreenwire.com</div>
      </div>
      ${readMoreCta}
    </footer>
  </article>
</body>
</html>`;
}

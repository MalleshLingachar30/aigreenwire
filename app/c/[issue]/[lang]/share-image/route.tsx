import { ImageResponse } from "next/og";
import {
  loadFirstLanguageCardPreview,
  parseIssueNumber,
} from "@/lib/cards-language-reader";
import { loadStoredSharePreview } from "@/lib/whatsapp-share-previews";
import { LANGUAGE_CONFIG, isLanguage } from "@/lib/whatsapp-cards";

export const runtime = "nodejs";

type RouteParams = {
  issue: string;
  lang: string;
};

export async function GET(
  _request: Request,
  context: { params: Promise<RouteParams> }
) {
  const { issue, lang } = await context.params;
  const issueNumber = parseIssueNumber(issue);

  if (!issueNumber || !isLanguage(lang)) {
    return new Response("Invalid share image path.", { status: 404 });
  }

  if (lang === "kn") {
    const storedPreview = await loadStoredSharePreview(issueNumber, lang);
    if (storedPreview) {
      return new Response(new Uint8Array(storedPreview.imageData), {
        status: 200,
        headers: {
          "content-type": storedPreview.mimeType,
          "cache-control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      });
    }
  }

  const firstCard = await loadFirstLanguageCardPreview(issueNumber, lang);
  if (!firstCard) {
    return new Response("No WhatsApp cards found for this issue and language.", { status: 404 });
  }

  const languageMeta = LANGUAGE_CONFIG[lang];
  const issueLabel = String(issueNumber).padStart(2, "0");
  const headlineFontSize = lang === "kn" ? 42 : 48;
  const cardFontFamily =
    lang === "kn" ? "'Noto Sans Kannada', 'Noto Sans', Arial, sans-serif" : "Noto Sans, Arial, sans-serif";

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background:
            "linear-gradient(135deg, rgba(15,118,110,0.95) 0%, rgba(14,116,144,0.92) 60%, rgba(12,74,110,0.94) 100%)",
          color: "#f8fafc",
          padding: "54px",
          gap: "28px",
          fontFamily: "Noto Sans, Arial, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            width: "100%",
            gap: "28px",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignSelf: "flex-start",
              gap: "16px",
              width: "236px",
              paddingTop: "18px",
            }}
          >
            <div
              style={{
                display: "inline-flex",
                width: "fit-content",
                fontSize: 23,
                fontWeight: 700,
                letterSpacing: 0.9,
                textTransform: "uppercase",
                border: "2px solid rgba(240,253,250,0.65)",
                borderRadius: 999,
                padding: "10px 18px",
              }}
            >
              AI Green Wire
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                paddingLeft: "2px",
              }}
            >
              <div style={{ display: "flex", fontSize: 30, fontWeight: 700, lineHeight: 1.15 }}>
                Issue {issueLabel}
              </div>
              <div style={{ display: "flex", fontSize: 22, fontWeight: 600, lineHeight: 1.2, opacity: 0.9 }}>
                {languageMeta.name}
              </div>
              <div style={{ display: "flex", fontSize: 18, lineHeight: 1.3, opacity: 0.72 }}>
                {languageMeta.nativeName}
              </div>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: "782px",
              minHeight: "514px",
              background: firstCard.theme.pageBackground,
              border: `2px solid ${firstCard.theme.border}`,
              borderRadius: "32px",
              padding: "34px 36px 32px",
              boxShadow: "0 32px 64px rgba(15, 23, 42, 0.26)",
              overflow: "hidden",
              fontFamily: cardFontFamily,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "18px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  fontSize: 21,
                  fontWeight: 700,
                  letterSpacing: 0.6,
                  textTransform: "uppercase",
                  color: "#0f172a",
                }}
              >
                Card {firstCard.cardNumber}
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: 19,
                  fontWeight: 700,
                  lineHeight: 1,
                  background: firstCard.theme.badgeBackground,
                  color: firstCard.theme.badgeText,
                  padding: "11px 16px",
                  borderRadius: "999px",
                  letterSpacing: 0.5,
                  textTransform: "uppercase",
                  maxWidth: "360px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {firstCard.tag}
              </div>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "22px",
                marginTop: "28px",
                color: firstCard.theme.heading,
              }}
            >
              <div
                style={{
                  display: "flex",
                  fontSize: 17,
                  fontWeight: 700,
                  letterSpacing: 0.8,
                  textTransform: "uppercase",
                  color: "#64748b",
                }}
              >
                AI Green Wire
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: headlineFontSize,
                  fontWeight: 800,
                  lineHeight: 1.18,
                  maxHeight: "206px",
                  overflow: "hidden",
                }}
              >
                {firstCard.headline}
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: 20,
                  lineHeight: 1.35,
                  color: firstCard.theme.body,
                  opacity: 0.82,
                  maxWidth: "520px",
                  maxHeight: "32px",
                  overflow: "hidden",
                }}
              >
                {firstCard.sourceName}
              </div>
            </div>
            <div
              style={{
                display: "flex",
                marginTop: "24px",
                height: "150px",
                width: "100%",
                borderTop: `1px solid ${firstCard.theme.actionBorder}`,
                background: `linear-gradient(180deg, rgba(255,255,255,0) 0%, ${firstCard.theme.actionBackground} 100%)`,
              }}
            />
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}

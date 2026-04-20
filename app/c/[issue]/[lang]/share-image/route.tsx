import { ImageResponse } from "next/og";
import {
  loadFirstLanguageCardPreview,
  parseIssueNumber,
} from "@/lib/cards-language-reader";
import { LANGUAGE_CONFIG, isLanguage } from "@/lib/whatsapp-cards";

export const runtime = "edge";

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

  const firstCard = await loadFirstLanguageCardPreview(issueNumber, lang);
  if (!firstCard) {
    return new Response("No WhatsApp cards found for this issue and language.", { status: 404 });
  }

  const languageMeta = LANGUAGE_CONFIG[lang];
  const issueLabel = String(issueNumber).padStart(2, "0");

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          alignItems: "stretch",
          justifyContent: "space-between",
          background:
            "linear-gradient(135deg, rgba(15,118,110,0.95) 0%, rgba(14,116,144,0.92) 60%, rgba(12,74,110,0.94) 100%)",
          color: "#f8fafc",
          padding: "48px",
          gap: "34px",
          fontFamily: "Noto Sans, Arial, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "28px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "14px", maxWidth: "470px" }}>
            <div
              style={{
                display: "inline-flex",
                width: "fit-content",
                fontSize: 24,
                fontWeight: 700,
                letterSpacing: 1,
                textTransform: "uppercase",
                border: "2px solid rgba(240,253,250,0.65)",
                borderRadius: 999,
                padding: "10px 18px",
              }}
            >
              AI Green Wire
            </div>
            <div style={{ fontSize: 58, fontWeight: 800, lineHeight: 1.02 }}>
              {languageMeta.name} Card Preview
            </div>
            <div style={{ fontSize: 34, fontWeight: 600, opacity: 0.94 }}>
              Issue {issueLabel} · {languageMeta.nativeName}
            </div>
            <div style={{ fontSize: 24, lineHeight: 1.4, opacity: 0.82, maxWidth: "430px" }}>
              Shareable 3-card mobile reader with a live preview from the first published card.
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: "560px",
              minHeight: "534px",
              background: firstCard.theme.pageBackground,
              border: `2px solid ${firstCard.theme.border}`,
              borderRadius: "28px",
              padding: "28px 28px 0",
              boxShadow: "0 32px 64px rgba(15, 23, 42, 0.26)",
              overflow: "hidden",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div
                style={{
                  display: "flex",
                  fontSize: 20,
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
                  fontSize: 18,
                  fontWeight: 700,
                  lineHeight: 1,
                  background: firstCard.theme.badgeBackground,
                  color: firstCard.theme.badgeText,
                  padding: "10px 14px",
                  borderRadius: "999px",
                  letterSpacing: 0.5,
                  textTransform: "uppercase",
                  maxWidth: "320px",
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
                gap: "18px",
                marginTop: "22px",
                color: firstCard.theme.heading,
              }}
            >
              <div
                style={{
                  display: "flex",
                  fontSize: 16,
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
                  fontSize: 42,
                  fontWeight: 800,
                  lineHeight: 1.15,
                  maxHeight: "198px",
                  overflow: "hidden",
                }}
              >
                {firstCard.headline}
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: 24,
                  lineHeight: 1.45,
                  color: firstCard.theme.body,
                  maxHeight: "104px",
                  overflow: "hidden",
                }}
              >
                {firstCard.summary}
              </div>
            </div>
            <div
              style={{
                display: "flex",
                marginTop: "26px",
                padding: "18px 20px",
                borderTopLeftRadius: "20px",
                borderTopRightRadius: "20px",
                background: firstCard.theme.actionBackground,
                borderTop: `1px solid ${firstCard.theme.actionBorder}`,
                borderLeft: `1px solid ${firstCard.theme.actionBorder}`,
                borderRight: `1px solid ${firstCard.theme.actionBorder}`,
                color: firstCard.theme.badgeText,
                fontSize: 18,
                fontWeight: 700,
              }}
            >
              Open full reader
            </div>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}

import React from "react";
import { ImageResponse } from "next/og";
import { loadIssueHubCards } from "@/lib/cards-issue-hub";
import { parseIssueNumber } from "@/lib/cards-language-reader";
import { LANGUAGE_CONFIG, type Language } from "@/lib/whatsapp-cards";

export const runtime = "nodejs";

type RouteParams = {
  issue: string;
};

const LANGUAGE_SEQUENCE: Language[] = ["kn", "te", "ta", "hi"];
const TILE_COLORS: Record<Language, { background: string; border: string; text: string }> = {
  kn: { background: "#f6fbf2", border: "#d8ebc9", text: "#1d3b07" },
  te: { background: "#eef9f8", border: "#cdebe7", text: "#094540" },
  ta: { background: "#fff7ee", border: "#f2debf", text: "#5e3402" },
  hi: { background: "#f8f5ff", border: "#e7dcff", text: "#4c1d95" },
};

export async function GET(
  _request: Request,
  context: { params: Promise<RouteParams> }
) {
  const { issue } = await context.params;
  const issueNumber = parseIssueNumber(issue);

  if (!issueNumber) {
    return new Response("Invalid issue share image path.", { status: 404 });
  }

  const groups = await loadIssueHubCards(issueNumber);
  const totalCards = Array.from(groups.values()).reduce((count, cards) => count + cards.length, 0);

  if (totalCards === 0) {
    return new Response("No WhatsApp cards found for this issue.", { status: 404 });
  }

  const issueLabel = String(issueNumber).padStart(2, "0");

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          justifyContent: "space-between",
          background:
            "linear-gradient(135deg, rgba(13,58,22,1) 0%, rgba(15,118,110,1) 56%, rgba(10,88,125,1) 100%)",
          color: "#f8fafc",
          padding: "46px",
          fontFamily: '"Noto Sans", Arial, sans-serif',
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "480px",
            paddingRight: "18px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              padding: "10px 16px",
              borderRadius: "999px",
              border: "2px solid rgba(248,250,252,0.5)",
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: 1,
              textTransform: "uppercase",
            }}
          >
            AI Green Wire
          </div>
          <div
            style={{
              display: "flex",
              marginTop: "22px",
              fontSize: 62,
              fontWeight: 800,
              lineHeight: 1.02,
              letterSpacing: -1.5,
            }}
          >
            {`WhatsApp Hub · Issue ${issueLabel}`}
          </div>
          <div
            style={{
              display: "flex",
              marginTop: "18px",
              fontSize: 28,
              lineHeight: 1.34,
              opacity: 0.92,
              maxWidth: "420px",
            }}
          >
            {`One shareable link with ${totalCards} cards across four Indian languages.`}
          </div>
          <div
            style={{
              display: "flex",
              gap: "12px",
              marginTop: "28px",
              flexWrap: "wrap",
              maxWidth: "440px",
            }}
          >
            <div
              style={{
                display: "flex",
                padding: "10px 14px",
                borderRadius: "999px",
                background: "rgba(255,255,255,0.16)",
                border: "1px solid rgba(255,255,255,0.18)",
                fontSize: 18,
                fontWeight: 700,
              }}
            >
              12 cards
            </div>
            <div
              style={{
                display: "flex",
                padding: "10px 14px",
                borderRadius: "999px",
                background: "rgba(255,255,255,0.16)",
                border: "1px solid rgba(255,255,255,0.18)",
                fontSize: 18,
                fontWeight: 700,
              }}
            >
              4 languages
            </div>
            <div
              style={{
                display: "flex",
                padding: "10px 14px",
                borderRadius: "999px",
                background: "rgba(255,255,255,0.16)",
                border: "1px solid rgba(255,255,255,0.18)",
                fontSize: 18,
                fontWeight: 700,
              }}
            >
              One URL
            </div>
          </div>
          <div
            style={{
              display: "flex",
              marginTop: "auto",
              padding: "18px 20px",
              borderRadius: "24px",
              background: "rgba(255,255,255,0.12)",
              border: "1px solid rgba(255,255,255,0.16)",
              fontSize: 20,
              lineHeight: 1.45,
              maxWidth: "430px",
            }}
          >
            Send one master link. Readers open the hub and choose Kannada, Telugu, Tamil, or Hindi inside it.
          </div>
        </div>
        <div
          style={{
            display: "flex",
            width: "620px",
            position: "relative",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              position: "absolute",
              inset: "48px 32px 48px 32px",
              borderRadius: "38px",
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.12)",
              filter: "blur(0px)",
            }}
          />
          {LANGUAGE_SEQUENCE.map((language) => {
            const meta = LANGUAGE_CONFIG[language];
            const cards = groups.get(language) ?? [];
            const colors = TILE_COLORS[language];
            const firstCard = cards[0];
            const headlinePreview = firstCard?.headline
              ? firstCard.headline.slice(0, 74).trimEnd()
              : `${meta.name} cards ready`;
            const rotation =
              language === "kn"
                ? -8
                : language === "te"
                  ? -2
                  : language === "ta"
                    ? 5
                    : 10;
            const left =
              language === "kn"
                ? 10
                : language === "te"
                  ? 150
                  : language === "ta"
                    ? 300
                    : 430;
            const top =
              language === "kn"
                ? 84
                : language === "te"
                  ? 28
                  : language === "ta"
                    ? 112
                    : 56;

            return (
              <div
                key={language}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  position: "absolute",
                  left: `${left}px`,
                  top: `${top}px`,
                  width: "190px",
                  background: colors.background,
                  border: `2px solid ${colors.border}`,
                  borderRadius: "24px",
                  padding: "18px",
                  color: colors.text,
                  boxShadow: "0 18px 44px rgba(15,23,42,0.22)",
                  transform: `rotate(${rotation}deg)`,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "10px",
                  }}
                >
                  <div style={{ display: "flex", fontSize: 21, fontWeight: 800, lineHeight: 1.1 }}>
                    {meta.name}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      padding: "6px 10px",
                      borderRadius: "999px",
                      background: "rgba(255,255,255,0.72)",
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                  >
                    {`${cards.length} cards`}
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    marginTop: "12px",
                    padding: "7px 10px",
                    borderRadius: "999px",
                    background: "rgba(255,255,255,0.8)",
                    fontSize: 12,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: 0.4,
                    alignSelf: "flex-start",
                  }}
                >
                  {firstCard?.tag?.trim() || "AI Green Wire"}
                </div>
                <div
                  style={{
                    display: "flex",
                    marginTop: "14px",
                    fontSize: 18,
                    fontWeight: 700,
                    lineHeight: 1.28,
                    minHeight: "92px",
                  }}
                >
                  {headlinePreview}
                </div>
                <div
                  style={{
                    display: "flex",
                    marginTop: "14px",
                    fontSize: 13,
                    lineHeight: 1.4,
                    opacity: 0.82,
                  }}
                >
                  {firstCard?.source_name?.trim() || "AI Green Wire Desk"}
                </div>
              </div>
            );
          })}
          <div
            style={{
              display: "flex",
              position: "absolute",
              right: "22px",
              bottom: "10px",
              padding: "14px 18px",
              borderRadius: "18px",
              background: "rgba(255,255,255,0.14)",
              border: "1px solid rgba(255,255,255,0.16)",
              fontSize: 18,
              fontWeight: 700,
              backdropFilter: "blur(6px)",
            }}
          >
            Open one link. Read in your language.
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}

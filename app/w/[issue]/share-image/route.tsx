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
          flexDirection: "column",
          background:
            "linear-gradient(135deg, rgba(24,78,29,1) 0%, rgba(15,118,110,1) 58%, rgba(14,116,144,1) 100%)",
          color: "#f8fafc",
          padding: "52px",
          fontFamily: '"Noto Sans", Arial, sans-serif',
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "20px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", maxWidth: "720px" }}>
            <div
              style={{
                display: "flex",
                alignSelf: "flex-start",
                padding: "10px 16px",
                borderRadius: "999px",
                border: "2px solid rgba(248,250,252,0.55)",
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: 1,
                textTransform: "uppercase",
              }}
            >
              AI Green Wire
            </div>
            <div style={{ display: "flex", marginTop: "18px", fontSize: 58, fontWeight: 800, lineHeight: 1.04 }}>
              {`WhatsApp Cards · Issue ${issueLabel}`}
            </div>
            <div style={{ display: "flex", marginTop: "16px", fontSize: 28, lineHeight: 1.35, opacity: 0.92 }}>
              {`One multilingual hub with ${totalCards} cards across Kannada, Telugu, Tamil, and Hindi.`}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              background: "rgba(255,255,255,0.12)",
              border: "1px solid rgba(255,255,255,0.18)",
              borderRadius: "24px",
              padding: "18px 20px",
              minWidth: "220px",
            }}
          >
            <div style={{ display: "flex", fontSize: 20, fontWeight: 700, opacity: 0.9 }}>
              Share one URL
            </div>
            <div style={{ display: "flex", marginTop: "10px", fontSize: 18, lineHeight: 1.45, opacity: 0.88 }}>
              Readers choose their language inside the hub.
            </div>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            gap: "18px",
            marginTop: "34px",
          }}
        >
          {LANGUAGE_SEQUENCE.map((language) => {
            const meta = LANGUAGE_CONFIG[language];
            const cards = groups.get(language) ?? [];
            const colors = TILE_COLORS[language];

            return (
              <div
                key={language}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  flex: 1,
                  background: colors.background,
                  border: `2px solid ${colors.border}`,
                  borderRadius: "24px",
                  padding: "24px",
                  color: colors.text,
                }}
              >
                <div style={{ display: "flex", fontSize: 28, fontWeight: 800, lineHeight: 1.1 }}>
                  {meta.name}
                </div>
                <div style={{ display: "flex", marginTop: "10px", fontSize: 22, lineHeight: 1.3 }}>
                  {meta.nativeName}
                </div>
                <div
                  style={{
                    display: "flex",
                    alignSelf: "flex-start",
                    marginTop: "18px",
                    padding: "8px 12px",
                    borderRadius: "999px",
                    background: "rgba(255,255,255,0.7)",
                    fontSize: 18,
                    fontWeight: 700,
                  }}
                >
                  {`${cards.length} cards`}
                </div>
                <div
                  style={{
                    display: "flex",
                    marginTop: "18px",
                    fontSize: 18,
                    lineHeight: 1.45,
                    opacity: 0.84,
                  }}
                >
                  {cards[0]?.headline ?? "Cards ready in this language."}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}

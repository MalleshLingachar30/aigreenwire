import { ImageResponse } from "next/og";
import { parseIssueNumber } from "@/lib/cards-language-reader";
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

  const languageMeta = LANGUAGE_CONFIG[lang];
  const issueLabel = String(issueNumber).padStart(2, "0");

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background:
            "linear-gradient(135deg, rgba(15,118,110,0.95) 0%, rgba(14,116,144,0.92) 60%, rgba(12,74,110,0.94) 100%)",
          color: "#f8fafc",
          padding: "64px 72px",
          fontFamily: "Noto Sans, Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div
            style={{
              display: "inline-flex",
              width: "fit-content",
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: 1,
              textTransform: "uppercase",
              border: "2px solid rgba(240,253,250,0.65)",
              borderRadius: 999,
              padding: "10px 20px",
            }}
          >
            AI Green Wire
          </div>
          <div style={{ fontSize: 66, fontWeight: 800, lineHeight: 1.05 }}>
            Language Cards
          </div>
          <div style={{ fontSize: 40, fontWeight: 600, opacity: 0.95 }}>
            Issue {issueLabel} · {languageMeta.name}
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 30, opacity: 0.95 }}>
          <div>{languageMeta.nativeName}</div>
          <div>3-card mobile reader</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}

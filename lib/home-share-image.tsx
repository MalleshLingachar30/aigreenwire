import React from "react";
import { ImageResponse } from "next/og";

export const HOME_SHARE_IMAGE_ALT = "The AI Green Wire homepage share preview";
export const HOME_SHARE_IMAGE_SIZE = {
  width: 1200,
  height: 630,
};
export const HOME_SHARE_IMAGE_CONTENT_TYPE = "image/png";

export function renderHomeShareImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background:
            "radial-gradient(circle at top left, rgba(192,221,151,0.28), transparent 36%), linear-gradient(135deg, #0f3b0b 0%, #173404 42%, #0f766e 100%)",
          color: "#f8fafc",
          overflow: "hidden",
          fontFamily: "Georgia, ui-serif, serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 34,
            left: 42,
            width: 170,
            height: 170,
            borderRadius: 999,
            background: "rgba(192,221,151,0.18)",
            border: "2px solid rgba(192,221,151,0.28)",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: -90,
            bottom: -110,
            width: 420,
            height: 420,
            borderRadius: 999,
            background: "rgba(192,221,151,0.14)",
            border: "2px solid rgba(192,221,151,0.18)",
          }}
        />
        <div
          style={{
            display: "flex",
            width: "100%",
            padding: "56px 62px",
            justifyContent: "space-between",
            alignItems: "stretch",
            gap: 36,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              width: 690,
              zIndex: 1,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div
                style={{
                  display: "flex",
                  alignSelf: "flex-start",
                  padding: "10px 18px",
                  borderRadius: 999,
                  border: "1px solid rgba(192,221,151,0.55)",
                  color: "#c0dd97",
                  fontFamily: "Arial, sans-serif",
                  fontSize: 22,
                  fontWeight: 700,
                  letterSpacing: 3,
                  textTransform: "uppercase",
                }}
              >
                A Weekly Briefing
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    fontSize: 86,
                    fontWeight: 700,
                    lineHeight: 0.96,
                    letterSpacing: -2,
                  }}
                >
                  The AI Green Wire
                </div>
                <div
                  style={{
                    display: "flex",
                    fontFamily: "Arial, sans-serif",
                    fontSize: 30,
                    lineHeight: 1.35,
                    color: "rgba(248,250,252,0.9)",
                    maxWidth: 620,
                  }}
                >
                  Weekly AI signals across agriculture, agroforestry, forestry, and ecology.
                </div>
              </div>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div
                style={{
                  display: "flex",
                  fontFamily: "Arial, sans-serif",
                  fontSize: 26,
                  fontWeight: 700,
                  color: "#c0dd97",
                }}
              >
                aigreenwire.com
              </div>
              <div
                style={{
                  display: "flex",
                  fontFamily: "Arial, sans-serif",
                  fontSize: 22,
                  lineHeight: 1.4,
                  color: "rgba(248,250,252,0.8)",
                  maxWidth: 600,
                }}
              >
                Free every Monday morning. Curated for growers, foresters, researchers, and students.
              </div>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              width: 350,
              padding: "30px 28px",
              borderRadius: 28,
              background: "rgba(251,249,242,0.96)",
              border: "2px solid rgba(192,221,151,0.72)",
              color: "#173404",
              boxShadow: "0 24px 60px rgba(0,0,0,0.22)",
              zIndex: 1,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div
                style={{
                  display: "flex",
                  alignSelf: "flex-start",
                  padding: "8px 14px",
                  borderRadius: 999,
                  background: "#eaf3de",
                  color: "#3b6d11",
                  fontFamily: "Arial, sans-serif",
                  fontSize: 18,
                  fontWeight: 700,
                  letterSpacing: 1.8,
                  textTransform: "uppercase",
                }}
              >
                AI Green Wire
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    fontSize: 50,
                    fontWeight: 700,
                    lineHeight: 1.02,
                    letterSpacing: -1,
                  }}
                >
                  Monday
                </div>
                <div
                  style={{
                    display: "flex",
                    fontFamily: "Arial, sans-serif",
                    fontSize: 24,
                    lineHeight: 1.35,
                    color: "#475569",
                  }}
                >
                  AI developments that matter for farming, forestry, biodiversity, and the natural world.
                </div>
              </div>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                paddingTop: 18,
                borderTop: "1px solid rgba(59,109,17,0.18)",
                fontFamily: "Arial, sans-serif",
              }}
            >
              <div style={{ display: "flex", fontSize: 18, color: "#64748b", textTransform: "uppercase", letterSpacing: 1.5 }}>
                Prominent share thumbnail
              </div>
              <div style={{ display: "flex", fontSize: 22, fontWeight: 700, color: "#173404" }}>
                Built for clear OG previews in WhatsApp, X, and social cards.
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    HOME_SHARE_IMAGE_SIZE
  );
}

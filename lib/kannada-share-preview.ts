import { existsSync } from "node:fs";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import {
  loadFirstLanguageCardPreview,
  type LanguageCardPreview,
} from "@/lib/cards-language-reader";
import {
  deleteStoredSharePreview,
  upsertStoredSharePreview,
} from "@/lib/whatsapp-share-previews";

const PREVIEW_WIDTH = 1200;
const PREVIEW_HEIGHT = 630;
const LOCAL_CHROME_CANDIDATES = [
  process.env.PUPPETEER_EXECUTABLE_PATH?.trim() || "",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
];

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getLocalChromeExecutablePath(): string {
  const executablePath = LOCAL_CHROME_CANDIDATES.find(
    (candidate) => candidate && existsSync(candidate)
  );

  if (!executablePath) {
    throw new Error("Local Chrome executable not found for Kannada preview generation.");
  }

  return executablePath;
}

function buildKannadaSharePreviewHtml(card: LanguageCardPreview): string {
  const issueLabel = String(card.issueNumber).padStart(2, "0");
  const safeTag = escapeHtml(card.tag);
  const safeHeadline = escapeHtml(card.headline);
  const safeSourceName = escapeHtml(card.sourceName);

  return `<!DOCTYPE html>
<html lang="kn">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=${PREVIEW_WIDTH}, initial-scale=1" />
  <title>AI Green Wire Kannada Share Preview</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;600;700;800&family=Noto+Sans+Kannada:wght@400;600;700;800&display=swap" rel="stylesheet" />
  <style>
    html, body {
      margin: 0;
      width: ${PREVIEW_WIDTH}px;
      height: ${PREVIEW_HEIGHT}px;
      overflow: hidden;
      background:
        radial-gradient(circle at top left, rgba(52, 211, 153, 0.18), transparent 34%),
        linear-gradient(135deg, #0f766e 0%, #0e7490 56%, #0c4a6e 100%);
      font-family: "Noto Sans", Arial, sans-serif;
    }

    body {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .layout {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 28px;
      padding: 54px;
      box-sizing: border-box;
    }

    .meta {
      width: 236px;
      align-self: flex-start;
      padding-top: 18px;
      color: #f0fdfa;
    }

    .pill {
      display: inline-flex;
      align-items: center;
      border: 2px solid rgba(240, 253, 250, 0.65);
      border-radius: 999px;
      padding: 10px 18px;
      font-size: 23px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .issue {
      margin-top: 16px;
      padding-left: 2px;
      font-size: 30px;
      font-weight: 700;
      line-height: 1.15;
    }

    .lang {
      margin-top: 6px;
      padding-left: 2px;
      font-size: 22px;
      font-weight: 600;
      line-height: 1.2;
      opacity: 0.92;
    }

    .native {
      margin-top: 2px;
      padding-left: 2px;
      font-size: 18px;
      line-height: 1.3;
      opacity: 0.72;
    }

    .card {
      width: 782px;
      min-height: 514px;
      box-sizing: border-box;
      background: ${card.theme.pageBackground};
      border: 2px solid ${card.theme.border};
      border-radius: 32px;
      box-shadow: 0 32px 64px rgba(15, 23, 42, 0.26);
      color: ${card.theme.heading};
      overflow: hidden;
      padding: 34px 36px 0;
      font-family: "Noto Sans Kannada", "Noto Sans", Arial, sans-serif;
    }

    .card-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 18px;
    }

    .card-label {
      font-size: 21px;
      font-weight: 700;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      color: #0f172a;
    }

    .tag {
      max-width: 360px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      background: ${card.theme.badgeBackground};
      color: ${card.theme.badgeText};
      border-radius: 999px;
      padding: 11px 16px;
      font-size: 19px;
      font-weight: 700;
      line-height: 1;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      font-family: "Noto Sans", Arial, sans-serif;
    }

    .brand {
      margin-top: 28px;
      font-size: 17px;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: #64748b;
      font-family: "Noto Sans", Arial, sans-serif;
    }

    .headline {
      margin-top: 22px;
      font-size: 42px;
      font-weight: 800;
      line-height: 1.18;
      max-height: 206px;
      overflow: hidden;
    }

    .source {
      margin-top: 22px;
      max-width: 520px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: ${card.theme.body};
      opacity: 0.82;
      font-size: 20px;
      line-height: 1.35;
    }

    .fade {
      margin-top: 24px;
      width: 100%;
      height: 150px;
      border-top: 1px solid ${card.theme.actionBorder};
      background: linear-gradient(180deg, rgba(255,255,255,0) 0%, ${card.theme.actionBackground} 100%);
    }
  </style>
</head>
<body>
  <main class="layout">
    <section class="meta">
      <div class="pill">AI Green Wire</div>
      <div class="issue">Issue ${issueLabel}</div>
      <div class="lang">Kannada</div>
      <div class="native">ಕನ್ನಡ</div>
    </section>
    <article class="card">
      <div class="card-top">
        <div class="card-label">Card ${card.cardNumber}</div>
        <div class="tag">${safeTag}</div>
      </div>
      <div class="brand">AI Green Wire</div>
      <div class="headline">${safeHeadline}</div>
      <div class="source">${safeSourceName}</div>
      <div class="fade"></div>
    </article>
  </main>
</body>
</html>`;
}

async function renderKannadaSharePreviewImage(
  card: LanguageCardPreview
): Promise<Buffer> {
  const isLocal = process.platform !== "linux" || process.env.IS_LOCAL === "1";
  chromium.setGraphicsMode = false;

  const browser = isLocal
    ? await puppeteer.launch({
        executablePath: getLocalChromeExecutablePath(),
        headless: true,
      })
    : await puppeteer.launch({
        args: puppeteer.defaultArgs({ args: chromium.args, headless: "shell" }),
        defaultViewport: {
          width: PREVIEW_WIDTH,
          height: PREVIEW_HEIGHT,
          deviceScaleFactor: 1,
          hasTouch: false,
          isLandscape: true,
          isMobile: false,
        },
        executablePath: await chromium.executablePath(),
        headless: "shell",
      });

  try {
    const page = await browser.newPage();
    await page.setViewport({
      width: PREVIEW_WIDTH,
      height: PREVIEW_HEIGHT,
      deviceScaleFactor: 1,
    });
    await page.setContent(buildKannadaSharePreviewHtml(card), {
      waitUntil: "networkidle0",
    });
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    await page.locator(".card").wait();

    const screenshot = await page.screenshot({
      type: "png",
    });

    return Buffer.isBuffer(screenshot) ? screenshot : Buffer.from(screenshot);
  } finally {
    await browser.close();
  }
}

export async function regenerateKannadaSharePreview(
  issueId: string,
  issueNumber: number
): Promise<void> {
  await deleteStoredSharePreview(issueId, "kn");

  const firstCard = await loadFirstLanguageCardPreview(issueNumber, "kn");
  if (!firstCard) {
    return;
  }

  const imageData = await renderKannadaSharePreviewImage(firstCard);
  await upsertStoredSharePreview({
    issueId,
    issueNumber,
    language: "kn",
    sourceCardNumber: firstCard.cardNumber,
    mimeType: "image/png",
    width: PREVIEW_WIDTH,
    height: PREVIEW_HEIGHT,
    imageData,
  });
}

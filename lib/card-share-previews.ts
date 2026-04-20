import { existsSync } from "node:fs";
import { sql } from "@/lib/db";
import { type Language } from "@/lib/whatsapp-cards";

const KANNADA_LANGUAGE: Language = "kn";
const PREVIEW_CARD_NUMBER = 1;
const PNG_CONTENT_TYPE = "image/png";
const SCREENSHOT_VIEWPORT = {
  width: 1200,
  height: 630,
  deviceScaleFactor: 1,
  hasTouch: false,
  isLandscape: true,
  isMobile: false,
};
const LOCAL_CHROME_CANDIDATES = [
  process.env.PUPPETEER_EXECUTABLE_PATH?.trim() || "",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
];

type PersistedSharePreviewRow = {
  content_type: string;
  image_base64: string;
};

function normalizeOrigin(origin: string): string {
  const trimmed = origin.trim().replace(/\/+$/, "");
  if (!trimmed) {
    throw new Error("A valid origin is required for share preview generation.");
  }
  return trimmed;
}

function buildPreviewUrl(origin: string, issueNumber: number): string {
  return `${normalizeOrigin(origin)}/api/cards/preview?issue=${issueNumber}&lang=${KANNADA_LANGUAGE}&card=${PREVIEW_CARD_NUMBER}`;
}

async function launchScreenshotBrowser() {
  const [{ default: chromium }, { default: puppeteer }] = await Promise.all([
    import("@sparticuz/chromium"),
    import("puppeteer-core"),
  ]);

  chromium.setGraphicsMode = false;

  const isLocal = process.platform !== "linux" || process.env.IS_LOCAL === "1";
  const executablePath = isLocal
    ? LOCAL_CHROME_CANDIDATES.find((candidate) => candidate && existsSync(candidate))
    : await chromium.executablePath();

  if (!executablePath) {
    throw new Error("Chrome executable not found for Kannada share preview generation.");
  }

  return puppeteer.launch({
    args: isLocal ? undefined : puppeteer.defaultArgs({ args: chromium.args, headless: "shell" }),
    defaultViewport: SCREENSHOT_VIEWPORT,
    executablePath,
    headless: isLocal ? true : "shell",
  });
}

async function renderKannadaPreviewPng(origin: string, issueNumber: number): Promise<Buffer> {
  const browser = await launchScreenshotBrowser();

  try {
    const page = await browser.newPage();
    const response = await page.goto(buildPreviewUrl(origin, issueNumber), {
      timeout: 45_000,
      waitUntil: "networkidle0",
    });

    if (!response?.ok()) {
      const status = response?.status() ?? 0;
      throw new Error(
        `Kannada share preview source returned unexpected status ${status} for issue ${issueNumber}.`
      );
    }

    await page.waitForSelector("article", { timeout: 15_000 });
    await page.waitForFunction(
      () => !("fonts" in document) || document.fonts.status === "loaded",
      { timeout: 15_000 }
    );

    const screenshot = await page.screenshot({ type: "png" });
    return Buffer.from(screenshot);
  } finally {
    await browser.close();
  }
}

async function upsertPersistedSharePreview(params: {
  issueId: string;
  issueNumber: number;
  language: Language;
  contentType: string;
  imagePng: Buffer;
}) {
  await sql`
    INSERT INTO whatsapp_card_share_previews (
      issue_id,
      issue_number,
      language,
      content_type,
      image_png
    )
    VALUES (
      ${params.issueId}::uuid,
      ${params.issueNumber},
      ${params.language},
      ${params.contentType},
      decode(${params.imagePng.toString("base64")}, 'base64')
    )
    ON CONFLICT (issue_id, language)
    DO UPDATE SET
      issue_number = EXCLUDED.issue_number,
      content_type = EXCLUDED.content_type,
      image_png = EXCLUDED.image_png,
      updated_at = NOW()
  `;
}

export async function loadPersistedSharePreview(
  issueNumber: number,
  language: Language
): Promise<{ contentType: string; imagePng: Buffer } | null> {
  const rows = (await sql`
    SELECT
      content_type,
      encode(image_png, 'base64') AS image_base64
    FROM whatsapp_card_share_previews
    WHERE issue_number = ${issueNumber}
      AND language = ${language}
    ORDER BY updated_at DESC, created_at DESC
    LIMIT 1
  `) as PersistedSharePreviewRow[];

  const row = rows[0];
  if (!row) {
    return null;
  }

  return {
    contentType: row.content_type,
    imagePng: Buffer.from(row.image_base64, "base64"),
  };
}

export async function generateAndStoreKannadaSharePreview(params: {
  issueId: string;
  issueNumber: number;
  origin: string;
}): Promise<void> {
  const imagePng = await renderKannadaPreviewPng(params.origin, params.issueNumber);

  await upsertPersistedSharePreview({
    issueId: params.issueId,
    issueNumber: params.issueNumber,
    language: KANNADA_LANGUAGE,
    contentType: PNG_CONTENT_TYPE,
    imagePng,
  });
}

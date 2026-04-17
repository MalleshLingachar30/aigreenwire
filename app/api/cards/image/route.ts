import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import { NextRequest } from "next/server";
import { renderCardHTML } from "@/lib/card-renderer";
import { getStoredWhatsAppCard, isLanguage } from "@/lib/whatsapp-cards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function parseIssueNumber(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function parseCardNumber(value: string | null): 1 | 2 | 3 | null {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (parsed !== 1 && parsed !== 2 && parsed !== 3) {
    return null;
  }

  return parsed;
}

async function getExecutablePath(): Promise<string> {
  const localPath = process.env.CHROME_EXECUTABLE_PATH?.trim();
  if (localPath) {
    return localPath;
  }

  return chromium.executablePath();
}

export async function GET(request: NextRequest) {
  const issueNumber = parseIssueNumber(request.nextUrl.searchParams.get("issue"));
  const languageRaw = request.nextUrl.searchParams.get("lang");
  const cardNumber = parseCardNumber(request.nextUrl.searchParams.get("card"));

  if (!issueNumber || !isLanguage(languageRaw) || !cardNumber) {
    return new Response("Missing or invalid issue/lang/card query params.", { status: 400 });
  }

  const card = await getStoredWhatsAppCard(issueNumber, languageRaw, cardNumber);
  if (!card) {
    return new Response("Card not found.", { status: 404 });
  }

  chromium.setGraphicsMode = false;

  const browser = await puppeteer.launch({
    args: puppeteer.defaultArgs({ args: chromium.args, headless: "shell" }),
    defaultViewport: {
      width: 1080,
      height: 1920,
      deviceScaleFactor: 1,
      isMobile: false,
      hasTouch: false,
    },
    executablePath: await getExecutablePath(),
    headless: "shell",
  });

  try {
    const page = await browser.newPage();
    await page.setContent(
      renderCardHTML({
        issueNumber: card.issueNumber,
        language: card.language,
        cardNumber: card.cardNumber,
        tag: card.tag,
        headline: card.headline,
        summary: card.summary,
        actionText: card.actionText,
        sourceUrl: card.sourceUrl,
        sourceName: card.sourceName,
      }),
      { waitUntil: "networkidle0" }
    );

    await page.emulateMediaType("screen");
    await page.evaluate(async () => {
      if ("fonts" in document) {
        await (document as Document & { fonts: FontFaceSet }).fonts.ready;
      }
    });

    const png = await page.screenshot({
      type: "png",
      clip: { x: 0, y: 0, width: 1080, height: 1920 },
    });

    return new Response(Buffer.from(png), {
      status: 200,
      headers: {
        "content-type": "image/png",
        "cache-control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      },
    });
  } finally {
    await browser.close();
  }
}

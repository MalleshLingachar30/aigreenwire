import { NextRequest, NextResponse } from "next/server";
import { isAdminRequestAuthorized } from "@/lib/api-auth";
import { parseStoredIssueData } from "@/lib/citation-sanitize";
import { sql } from "@/lib/db";
import {
  generateTranslatedCards,
  upsertWhatsAppCards,
  type Language,
  type TranslatedCard,
} from "@/lib/whatsapp-cards";
import { buildAppUrl, isUuidToken } from "@/lib/subscription";

export const maxDuration = 60;

type IssueRow = {
  id: string;
  issue_number: number;
  stories_json: unknown;
};

async function findIssueById(issueId: string): Promise<IssueRow | null> {
  const rows = (await sql`
    SELECT
      id::text AS id,
      issue_number,
      stories_json
    FROM issues
    WHERE id = ${issueId}
    LIMIT 1
  `) as IssueRow[];

  return rows[0] ?? null;
}

function buildPreviewUrls(issueNumber: number, cards: TranslatedCard[]) {
  return cards.map((card) =>
    buildAppUrl("/api/cards/preview", {
      issue: String(issueNumber),
      lang: card.language,
      card: String(card.cardNumber),
    })
  );
}

function buildLanguageUrls(issueNumber: number): Record<Language, string> {
  return {
    kn: buildAppUrl("/api/cards/language", {
      issue: String(issueNumber),
      lang: "kn",
    }),
    te: buildAppUrl("/api/cards/language", {
      issue: String(issueNumber),
      lang: "te",
    }),
    ta: buildAppUrl("/api/cards/language", {
      issue: String(issueNumber),
      lang: "ta",
    }),
    hi: buildAppUrl("/api/cards/language", {
      issue: String(issueNumber),
      lang: "hi",
    }),
  };
}

async function handleGenerate(request: NextRequest) {
  if (!isAdminRequestAuthorized(request)) {
    return NextResponse.json(
      { ok: false, message: "Unauthorized admin request." },
      { status: 401 }
    );
  }

  const issueId = request.nextUrl.searchParams.get("issue_id")?.trim() ?? "";
  if (!issueId || !isUuidToken(issueId)) {
    return NextResponse.json(
      { ok: false, message: "issue_id query param must be a valid UUID." },
      { status: 400 }
    );
  }

  const issue = await findIssueById(issueId);
  if (!issue) {
    return NextResponse.json({ ok: false, message: "Issue not found." }, { status: 404 });
  }

  try {
    const issueData = parseStoredIssueData(issue.stories_json, Number(issue.issue_number));

    const cards = await generateTranslatedCards(issueData);
    await upsertWhatsAppCards(issue.id, Number(issue.issue_number), cards);

    const galleryUrl = buildAppUrl("/api/cards/gallery", {
      issue: String(issue.issue_number),
    });
    const languageUrls = buildLanguageUrls(Number(issue.issue_number));

    return NextResponse.json(
      {
        ok: true,
        issue: {
          id: issue.id,
          issueNumber: Number(issue.issue_number),
        },
        cardsGenerated: cards.length,
        previewUrls: buildPreviewUrls(Number(issue.issue_number), cards),
        languageUrls,
        galleryUrl,
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate WhatsApp cards.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return handleGenerate(request);
}

export async function POST(request: NextRequest) {
  return handleGenerate(request);
}

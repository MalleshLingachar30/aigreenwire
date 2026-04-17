import { NextRequest, NextResponse } from "next/server";
import { isAdminRequestAuthorized } from "@/lib/api-auth";
import { sql } from "@/lib/db";
import { sendWhatsAppCardsForIssue } from "@/lib/whatsapp-delivery";
import {
  generateAndStoreWhatsAppCards,
  isLanguage,
  listStoredWhatsAppCards,
} from "@/lib/whatsapp-cards";
import { isUuidToken } from "@/lib/subscription";

export const maxDuration = 60;

type SendPayload = {
  issueId?: unknown;
  issueNumber?: unknown;
  to?: unknown;
  language?: unknown;
  mode?: unknown;
};

type IssueRow = {
  id: string;
  issue_number: number;
  stories_json: unknown;
};

function parseIssueNumber(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") {
    return null;
  }

  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function parseMode(value: unknown): "template" | "session" {
  if (value === "session") {
    return "session";
  }

  return "template";
}

async function findIssue(payload: SendPayload): Promise<IssueRow | null> {
  const issueId = typeof payload.issueId === "string" ? payload.issueId.trim() : "";
  const issueNumber = parseIssueNumber(payload.issueNumber);

  if (issueId) {
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

  if (issueNumber) {
    const rows = (await sql`
      SELECT
        id::text AS id,
        issue_number,
        stories_json
      FROM issues
      WHERE issue_number = ${issueNumber}
      LIMIT 1
    `) as IssueRow[];

    return rows[0] ?? null;
  }

  return null;
}

export async function POST(request: NextRequest) {
  if (!isAdminRequestAuthorized(request)) {
    return NextResponse.json(
      { ok: false, message: "Unauthorized admin request." },
      { status: 401 }
    );
  }

  let payload: SendPayload;
  try {
    payload = (await request.json()) as SendPayload;
  } catch {
    payload = {};
  }

  const issueId = typeof payload.issueId === "string" ? payload.issueId.trim() : "";
  if (issueId && !isUuidToken(issueId)) {
    return NextResponse.json(
      { ok: false, message: "issueId must be a valid UUID." },
      { status: 400 }
    );
  }

  const issueNumber = parseIssueNumber(payload.issueNumber);
  if (!issueId && !issueNumber) {
    return NextResponse.json(
      { ok: false, message: "Provide issueId or issueNumber." },
      { status: 400 }
    );
  }

  if (issueId && issueNumber) {
    return NextResponse.json(
      { ok: false, message: "Provide either issueId or issueNumber, not both." },
      { status: 400 }
    );
  }

  const issue = await findIssue(payload);
  if (!issue) {
    return NextResponse.json({ ok: false, message: "Issue not found." }, { status: 404 });
  }

  const to = typeof payload.to === "string" ? payload.to.trim() : "";
  const language = typeof payload.language === "string" ? payload.language.trim() : null;
  const mode = parseMode(payload.mode);

  if (to && !isLanguage(language)) {
    return NextResponse.json(
      { ok: false, message: "Manual sends require a valid language." },
      { status: 400 }
    );
  }

  const existingCards = await listStoredWhatsAppCards(Number(issue.issue_number));
  if (existingCards.length === 0) {
    await generateAndStoreWhatsAppCards(issue.id, Number(issue.issue_number), issue.stories_json);
  }

  try {
    const deliveries = await sendWhatsAppCardsForIssue({
      issueId: issue.id,
      issueNumber: Number(issue.issue_number),
      trigger: "manual",
      mode,
      ...(to && isLanguage(language)
        ? {
            target: {
              to,
              language,
              label: "manual-test",
            },
          }
        : {}),
    });

    return NextResponse.json(
      {
        ok: true,
        issue: {
          id: issue.id,
          issueNumber: Number(issue.issue_number),
        },
        deliveriesCount: deliveries.length,
        deliveries,
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send WhatsApp cards.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

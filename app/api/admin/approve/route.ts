import { NextRequest, NextResponse } from "next/server";
import { isAdminRequestAuthorized } from "@/lib/api-auth";
import { sql } from "@/lib/db";
import { sendEmail } from "@/lib/resend";
import { buildAppUrl, isUuidToken, isValidEmail, normalizeEmail } from "@/lib/subscription";
import { isWhatsAppAutoSendEnabled, sendWhatsAppCardsForIssue } from "@/lib/whatsapp-delivery";
import { generateAndStoreWhatsAppCards } from "@/lib/whatsapp-cards";

type ApprovePayload = {
  issueId?: unknown;
  slug?: unknown;
  sendTo?: unknown;
};

type IssueRow = {
  id: string;
  issue_number: number;
  slug: string;
  title: string;
  subject_line: string;
  html_rendered: string;
  stories_json: unknown;
  status: string;
};

function getEditorEmail(): string {
  const value = normalizeEmail(process.env.EDITOR_EMAIL ?? "");
  if (!isValidEmail(value)) {
    throw new Error("EDITOR_EMAIL is missing or invalid.");
  }
  return value;
}

async function findIssueForApproval(
  issueId?: string,
  slug?: string
): Promise<IssueRow | null> {
  if (issueId) {
    const rows = (await sql`
      SELECT
        id::text AS id,
        issue_number,
        slug,
        title,
        subject_line,
        html_rendered,
        stories_json,
        status
      FROM issues
      WHERE id = ${issueId}
      LIMIT 1
    `) as IssueRow[];
    return rows[0] ?? null;
  }

  if (slug) {
    const rows = (await sql`
      SELECT
        id::text AS id,
        issue_number,
        slug,
        title,
        subject_line,
        html_rendered,
        stories_json,
        status
      FROM issues
      WHERE slug = ${slug}
      LIMIT 1
    `) as IssueRow[];
    return rows[0] ?? null;
  }

  const rows = (await sql`
    SELECT
      id::text AS id,
      issue_number,
      slug,
      title,
      subject_line,
      html_rendered,
      stories_json,
      status
    FROM issues
    WHERE status = 'draft'
    ORDER BY generated_at DESC
    LIMIT 1
  `) as IssueRow[];

  return rows[0] ?? null;
}

export async function POST(request: NextRequest) {
  if (!isAdminRequestAuthorized(request)) {
    return NextResponse.json(
      { ok: false, message: "Unauthorized admin request." },
      { status: 401 }
    );
  }

  let payload: ApprovePayload;
  try {
    payload = (await request.json()) as ApprovePayload;
  } catch {
    payload = {};
  }

  const issueId = typeof payload.issueId === "string" ? payload.issueId.trim() : "";
  const slug = typeof payload.slug === "string" ? payload.slug.trim() : "";

  if (issueId && !isUuidToken(issueId)) {
    return NextResponse.json(
      { ok: false, message: "issueId must be a valid UUID." },
      { status: 400 }
    );
  }

  if (issueId && slug) {
    return NextResponse.json(
      { ok: false, message: "Provide either issueId or slug, not both." },
      { status: 400 }
    );
  }

  let issue: IssueRow | null;
  try {
    issue = await findIssueForApproval(issueId || undefined, slug || undefined);
  } catch {
    return NextResponse.json(
      { ok: false, message: "Failed to load issue for approval." },
      { status: 500 }
    );
  }

  if (!issue) {
    return NextResponse.json(
      { ok: false, message: "No matching issue found." },
      { status: 404 }
    );
  }

  if (issue.status !== "draft") {
    return NextResponse.json(
      {
        ok: false,
        message: `Issue is not in draft status (current: ${issue.status}).`,
      },
      { status: 409 }
    );
  }

  const editorEmail = getEditorEmail();
  const requestedRecipient =
    typeof payload.sendTo === "string" ? normalizeEmail(payload.sendTo) : editorEmail;

  if (!isValidEmail(requestedRecipient)) {
    return NextResponse.json(
      { ok: false, message: "sendTo must be a valid email address." },
      { status: 400 }
    );
  }

  if (requestedRecipient !== editorEmail) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Stage 7 is restricted to send-to-self only. sendTo must match EDITOR_EMAIL.",
      },
      { status: 400 }
    );
  }

  const lockRows = (await sql`
    UPDATE issues
    SET
      status = 'sending',
      approved_at = COALESCE(approved_at, NOW()),
      error_log = NULL
    WHERE id = ${issue.id}
      AND status = 'draft'
    RETURNING id::text AS id
  `) as Array<{ id: string }>;

  if (!lockRows[0]) {
    return NextResponse.json(
      { ok: false, message: "Issue could not be locked for approval." },
      { status: 409 }
    );
  }

  try {
    const messageId = await sendEmail({
      to: requestedRecipient,
      subject: issue.subject_line,
      html: issue.html_rendered,
      tags: [
        { name: "flow", value: "weekly-pipeline" },
        { name: "action", value: "approved-send-self" },
        { name: "issue_id", value: issue.id },
      ],
    });

    await sql`
      UPDATE issues
      SET
        status = 'sent',
        approved_at = COALESCE(approved_at, NOW()),
        sent_at = NOW(),
        sent_count = GREATEST(sent_count, 1),
        error_log = NULL
      WHERE id = ${issue.id}
    `;

    await sql`
      INSERT INTO send_log (issue_id, email, resend_id, status)
      VALUES (${issue.id}, ${requestedRecipient}, ${messageId}, 'sent')
    `;

    let cardsGenerated = false;
    let cardsCount = 0;
    let cardsError: string | null = null;
    let whatsappAutoSent = false;
    let whatsappDeliveryCount = 0;
    let whatsappDeliveryError: string | null = null;
    const cardsGalleryUrl = buildAppUrl("/api/cards/gallery", {
      issue: String(issue.issue_number),
    });

    try {
      const translatedCards = await generateAndStoreWhatsAppCards(
        issue.id,
        Number(issue.issue_number),
        issue.stories_json
      );
      cardsGenerated = true;
      cardsCount = translatedCards.length;
    } catch (cardsFailure) {
      cardsError =
        cardsFailure instanceof Error ? cardsFailure.message : "WhatsApp card generation failed.";
      console.error("[cards] WhatsApp generation failure:", cardsFailure);
    }

    if (cardsGenerated && isWhatsAppAutoSendEnabled()) {
      try {
        const deliveries = await sendWhatsAppCardsForIssue({
          issueId: issue.id,
          issueNumber: Number(issue.issue_number),
          trigger: "approve-auto",
          mode: "template",
        });
        whatsappAutoSent = true;
        whatsappDeliveryCount = deliveries.length;
      } catch (deliveryFailure) {
        whatsappDeliveryError =
          deliveryFailure instanceof Error
            ? deliveryFailure.message
            : "WhatsApp auto-send failed.";
        console.error("[cards] WhatsApp auto-send failure:", deliveryFailure);
      }
    }

    return NextResponse.json(
      {
        ok: true,
        issue: {
          id: issue.id,
          issueNumber: Number(issue.issue_number),
          slug: issue.slug,
          title: issue.title,
          status: "sent",
        },
        delivery: {
          to: requestedRecipient,
          messageId,
          mode: "send-to-self",
        },
        cards: {
          generated: cardsGenerated,
          count: cardsCount,
          galleryUrl: cardsGalleryUrl,
          ...(cardsError ? { error: cardsError } : {}),
          autoSendEnabled: isWhatsAppAutoSendEnabled(),
          autoSent: whatsappAutoSent,
          deliveryCount: whatsappDeliveryCount,
          ...(whatsappDeliveryError ? { deliveryError: whatsappDeliveryError } : {}),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message.slice(0, 800) : "Unknown delivery error";

    await sql`
      UPDATE issues
      SET
        status = 'failed',
        error_log = ${message}
      WHERE id = ${issue.id}
    `;

    await sql`
      INSERT INTO send_log (issue_id, email, status, error)
      VALUES (${issue.id}, ${requestedRecipient}, 'failed', ${message})
    `;

    return NextResponse.json(
      {
        ok: false,
        message: "Failed to deliver approved issue email.",
      },
      { status: 502 }
    );
  }
}

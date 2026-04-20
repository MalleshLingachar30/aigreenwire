import { NextRequest } from "next/server";
import { isAdminRequestAuthorized } from "@/lib/api-auth";
import { generateAndStoreKannadaSharePreview } from "@/lib/card-share-previews";
import { parseStoredIssueData } from "@/lib/citation-sanitize";
import { sql } from "@/lib/db";
import { renderIssueForSubscriber } from "@/lib/issue-email";
import { batchSendEmails, sendEmail } from "@/lib/resend";
import { isUuidToken, isValidEmail, normalizeEmail } from "@/lib/subscription";
import {
  LANGUAGE_CONFIG,
  type Language,
  generateTranslatedCards,
  upsertWhatsAppCards,
} from "@/lib/whatsapp-cards";

export const maxDuration = 300;

const RESEND_BATCH_SIZE = 100;
const LANGUAGE_SEQUENCE: Language[] = ["kn", "te", "ta", "hi"];

type IssueRow = {
  id: string;
  issue_number: number;
  slug: string;
  title: string;
  subject_line: string;
  stories_json: unknown;
  status: string;
};

type SubscriberRow = {
  id: string;
  email: string;
  unsubscribe_token: string;
};

type SentLogEntry = {
  subscriberId: string;
  email: string;
  resendId: string | null;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getSiteUrl(): string {
  const value = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!value) {
    throw new Error("NEXT_PUBLIC_SITE_URL is missing.");
  }

  return value.replace(/\/+$/, "");
}

function getAdminPassword(): string {
  const value = process.env.ADMIN_PASSWORD;
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("ADMIN_PASSWORD is missing.");
  }

  return value;
}

function getEditorEmail(): string {
  const value = normalizeEmail(process.env.EDITOR_EMAIL ?? "");
  if (!isValidEmail(value)) {
    throw new Error("EDITOR_EMAIL is missing or invalid.");
  }

  return value;
}

function getFailureLogEmail(): string {
  const configured = normalizeEmail(process.env.EDITOR_EMAIL ?? "");
  if (isValidEmail(configured)) {
    return configured;
  }

  return "approval-failure@aigreenwire.local";
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

async function findIssueById(issueId: string): Promise<IssueRow | null> {
  const rows = (await sql`
    SELECT
      id::text AS id,
      issue_number,
      slug,
      title,
      subject_line,
      stories_json,
      status
    FROM issues
    WHERE id = ${issueId}
    LIMIT 1
  `) as IssueRow[];

  return rows[0] ?? null;
}

async function findConfirmedSubscribers(): Promise<SubscriberRow[]> {
  const rows = (await sql`
    SELECT
      id::text AS id,
      LOWER(email) AS email,
      unsubscribe_token::text AS unsubscribe_token
    FROM subscribers
    WHERE confirmed_at IS NOT NULL
      AND unsubscribed_at IS NULL
    ORDER BY subscribed_at ASC, id ASC
  `) as SubscriberRow[];

  return rows;
}

async function insertSentLogs(issueId: string, rows: SentLogEntry[]): Promise<void> {
  if (!rows.length) {
    return;
  }

  const payload = rows.map((row) => ({
    subscriber_id: row.subscriberId,
    email: row.email,
    resend_id: row.resendId,
  }));

  await sql`
    INSERT INTO send_log (issue_id, subscriber_id, email, resend_id, status)
    SELECT
      ${issueId}::uuid,
      entry.subscriber_id::uuid,
      entry.email::text,
      entry.resend_id::text,
      'sent'
    FROM jsonb_to_recordset(${JSON.stringify(payload)}::jsonb) AS entry(
      subscriber_id text,
      email text,
      resend_id text
    )
  `;
}

async function sendIssueToConfirmedSubscribers(
  issue: IssueRow,
  issueData: ReturnType<typeof parseStoredIssueData>,
  subscribers: SubscriberRow[]
): Promise<number> {
  let sentCount = 0;

  const subscriberChunks = chunkArray(subscribers, RESEND_BATCH_SIZE);
  for (const subscriberChunk of subscriberChunks) {
    const emails = subscriberChunk.map((subscriber) => ({
      to: subscriber.email,
      subject: issue.subject_line,
      html: renderIssueForSubscriber(issueData, issue.slug, subscriber.unsubscribe_token),
      tags: [
        { name: "flow", value: "weekly-pipeline" },
        { name: "action", value: "approved-send-all" },
        { name: "issue_id", value: issue.id },
      ],
    }));

    const batchResults = await batchSendEmails(emails);
    if (batchResults.length !== subscriberChunk.length) {
      throw new Error("Resend batch response count did not match subscriber batch size.");
    }

    const resendIdByEmail = new Map(
      batchResults.map((result) => [normalizeEmail(result.to), result.id])
    );

    const logs: SentLogEntry[] = subscriberChunk.map((subscriber) => ({
      subscriberId: subscriber.id,
      email: subscriber.email,
      resendId: resendIdByEmail.get(subscriber.email) ?? null,
    }));

    await insertSentLogs(issue.id, logs);
    sentCount += subscriberChunk.length;
  }

  return sentCount;
}

function buildCardPreviewLinks(
  issueNumber: number,
  siteUrl: string,
  encodedPassword: string
): Record<Language, string[]> {
  const links: Record<Language, string[]> = {
    kn: [],
    te: [],
    ta: [],
    hi: [],
  };

  for (const language of LANGUAGE_SEQUENCE) {
    for (const cardNumber of [1, 2, 3] as const) {
      links[language].push(
        `${siteUrl}/api/cards/preview?issue=${issueNumber}&lang=${language}&card=${cardNumber}&password=${encodedPassword}`
      );
    }
  }

  return links;
}

function buildCardLanguageLinks(issueNumber: number, siteUrl: string): Record<Language, string> {
  const issuePrefix = `${siteUrl}/c/${issueNumber}`;

  return {
    kn: `${issuePrefix}/kn`,
    te: `${issuePrefix}/te`,
    ta: `${issuePrefix}/ta`,
    hi: `${issuePrefix}/hi`,
  };
}

function buildCardsDeliveryEmailHtml(
  issue: IssueRow,
  linksByLanguage: Record<Language, string[]>,
  languageLinksByLanguage: Record<Language, string>,
  galleryUrl: string
): string {
  const sections = LANGUAGE_SEQUENCE.map((language) => {
    const label = `${LANGUAGE_CONFIG[language].name} (${LANGUAGE_CONFIG[language].nativeName})`;
    const languageUrl = languageLinksByLanguage[language];
    const links = linksByLanguage[language]
      .map(
        (url, index) =>
          `<li style="margin-bottom:6px;"><a href="${escapeHtml(url)}" style="color:#0f766e;text-decoration:none;">Card ${index + 1}</a><br/><span style="font-size:12px;color:#475569;">${escapeHtml(
            url
          )}</span></li>`
      )
      .join("");

    return `<section style="margin:16px 0 20px;">
      <h3 style="margin:0 0 8px;font-size:16px;color:#0f172a;">${escapeHtml(label)}</h3>
      <p style="margin:0 0 10px;font-size:13px;color:#0f172a;"><strong>Shareable 3-card reader:</strong> <a href="${escapeHtml(
        languageUrl
      )}" style="color:#0f766e;text-decoration:none;">${escapeHtml(languageUrl)}</a></p>
      <ul style="margin:0;padding-left:18px;color:#0f172a;">${links}</ul>
    </section>`;
  }).join("");

  return [
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#0f172a;line-height:1.55;">',
    `<h2 style="margin:0 0 10px;">WhatsApp cards ready · Issue ${String(issue.issue_number).padStart(
      2,
      "0"
    )}</h2>`,
    `<p style="margin:0 0 10px;">English newsletter delivery is complete. Use these links to manually review and forward cards in each language.</p>`,
    `<p style="margin:0 0 14px;"><strong>Gallery:</strong> <a href="${escapeHtml(galleryUrl)}">${escapeHtml(
      galleryUrl
    )}</a></p>`,
    sections,
    "<p style=\"margin:10px 0 0;color:#475569;\">Manual forwarding flow: open each preview link, verify copy/layout, then forward through WhatsApp manually.</p>",
    "</div>",
  ].join("");
}

function renderResultPage(params: {
  title: string;
  message: string;
  statusCode: number;
  details?: string[];
}): string {
  const detailsHtml = (params.details ?? [])
    .map((detail) => `<li style="margin-bottom:6px;">${escapeHtml(detail)}</li>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(params.title)}</title>
</head>
<body style="margin:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
  <main style="max-width:760px;margin:0 auto;padding:24px 16px;">
    <section style="background:#ffffff;border:1px solid #dbe3ee;border-radius:12px;padding:18px;">
      <p style="margin:0 0 8px;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;">Approval Result</p>
      <h1 style="margin:0 0 10px;font-size:22px;line-height:1.3;">${escapeHtml(params.title)}</h1>
      <p style="margin:0;font-size:15px;color:#334155;">${escapeHtml(params.message)}</p>
      ${
        detailsHtml
          ? `<ul style="margin:14px 0 0;padding-left:20px;font-size:14px;color:#0f172a;">${detailsHtml}</ul>`
          : ""
      }
      <p style="margin:16px 0 0;font-size:12px;color:#64748b;">HTTP status: ${params.statusCode}</p>
    </section>
  </main>
</body>
</html>`;
}

export async function GET(request: NextRequest) {
  if (!isAdminRequestAuthorized(request)) {
    const html = renderResultPage({
      title: "Unauthorized",
      message: "ADMIN_PASSWORD is missing or invalid for this request.",
      statusCode: 401,
    });
    return new Response(html, {
      status: 401,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  const issueId = request.nextUrl.searchParams.get("id")?.trim() ?? "";
  if (!isUuidToken(issueId)) {
    const html = renderResultPage({
      title: "Invalid Draft ID",
      message: "id query param must be a valid UUID.",
      statusCode: 400,
    });
    return new Response(html, {
      status: 400,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  const issue = await findIssueById(issueId);
  if (!issue) {
    const html = renderResultPage({
      title: "Draft Not Found",
      message: "No issue exists for the provided id.",
      statusCode: 404,
    });
    return new Response(html, {
      status: 404,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  if (issue.status !== "draft") {
    const html = renderResultPage({
      title: "Issue Not Draft",
      message: `Issue ${issue.slug} is already ${issue.status}.`,
      statusCode: 409,
    });
    return new Response(html, {
      status: 409,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
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
    const html = renderResultPage({
      title: "Approval Conflict",
      message: "Issue could not be locked for sending. Try refreshing the preview.",
      statusCode: 409,
    });
    return new Response(html, {
      status: 409,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  try {
    const siteUrl = getSiteUrl();
    const adminPassword = getAdminPassword();
    const encodedPassword = encodeURIComponent(adminPassword);

    const issueData = parseStoredIssueData(issue.stories_json, Number(issue.issue_number));
    const subscribers = await findConfirmedSubscribers();

    if (subscribers.length === 0) {
      throw new Error("No confirmed subscribers available for delivery.");
    }

    const sentCount = await sendIssueToConfirmedSubscribers(issue, issueData, subscribers);

    await sql`
      UPDATE issues
      SET
        status = 'sent',
        approved_at = COALESCE(approved_at, NOW()),
        sent_at = NOW(),
        sent_count = ${sentCount},
        error_log = NULL
      WHERE id = ${issue.id}
    `;

    let cardsGenerated = false;
    let cardsCount = 0;
    let cardsError: string | null = null;
    const cardsGalleryUrl = `${siteUrl}/api/cards/gallery?issue=${issue.issue_number}&password=${encodedPassword}`;

    try {
      const translatedCards = await generateTranslatedCards(issueData);
      await upsertWhatsAppCards(issue.id, Number(issue.issue_number), translatedCards);
      cardsGenerated = true;
      cardsCount = translatedCards.length;

      try {
        await generateAndStoreKannadaSharePreview({
          issueId: issue.id,
          issueNumber: Number(issue.issue_number),
          origin: request.nextUrl.origin,
        });
      } catch (previewFailure) {
        const message =
          previewFailure instanceof Error
            ? previewFailure.message
            : "Kannada short-link preview generation failed.";
        cardsError = cardsError
          ? `${cardsError} Kannada preview warning: ${message}`
          : `Kannada preview warning: ${message}`;
        console.error("[cards] Kannada share preview generation failure:", previewFailure);
      }

      const editorEmail = getEditorEmail();
      const linksByLanguage = buildCardPreviewLinks(
        Number(issue.issue_number),
        siteUrl,
        encodedPassword
      );
      const languageLinksByLanguage = buildCardLanguageLinks(Number(issue.issue_number), siteUrl);
      const cardsEmailHtml = buildCardsDeliveryEmailHtml(
        issue,
        linksByLanguage,
        languageLinksByLanguage,
        cardsGalleryUrl
      );

      await sendEmail({
        to: editorEmail,
        subject: `[Cards] Issue ${String(issue.issue_number).padStart(2, "0")} manual forwarding links`,
        html: cardsEmailHtml,
        tags: [
          { name: "flow", value: "weekly-pipeline" },
          { name: "action", value: "cards-links" },
          { name: "issue_id", value: issue.id },
        ],
      });
    } catch (cardsFailure) {
      cardsError =
        cardsFailure instanceof Error
          ? cardsFailure.message
          : "WhatsApp card generation/link email failed.";
      console.error("[cards] generation or delivery failure:", cardsFailure);
    }

    const detailLines = [
      `Issue ${String(issue.issue_number).padStart(2, "0")} (${issue.slug}) delivered to ${sentCount} confirmed subscribers.`,
      `WhatsApp cards generated: ${cardsGenerated ? "yes" : "no"}${
        cardsGenerated ? ` (${cardsCount} cards)` : ""
      }.`,
      `Cards gallery: ${cardsGalleryUrl}`,
    ];

    if (cardsError) {
      detailLines.push(`Cards warning: ${cardsError}`);
    }

    const successHtml = renderResultPage({
      title: "Approval Complete",
      message: "Newsletter send finished and issue status is now sent.",
      statusCode: 200,
      details: detailLines,
    });

    return new Response(successHtml, {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
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
      VALUES (${issue.id}, ${getFailureLogEmail()}, 'failed', ${message})
    `;

    const failureHtml = renderResultPage({
      title: "Approval Failed",
      message: "Issue send did not complete. Check logs and retry after correcting the failure.",
      statusCode: 502,
      details: [message],
    });

    return new Response(failureHtml, {
      status: 502,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}

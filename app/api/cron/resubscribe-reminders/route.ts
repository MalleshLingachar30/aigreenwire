import { NextRequest, NextResponse } from "next/server";
import { isCronRequestAuthorized } from "@/lib/api-auth";
import { sql } from "@/lib/db";
import { sendEmail } from "@/lib/resend";
import {
  buildAppUrl,
  buildResubscribeReminderEmailHtml,
  isValidEmail,
  normalizeEmail,
} from "@/lib/subscription";

type UnsubscribedSubscriberRow = {
  id: string;
  email: string;
  name: string | null;
  confirm_token: string;
  unsubscribe_token: string;
};

const DEFAULT_BATCH_LIMIT = 100;
const MAX_BATCH_LIMIT = 500;

function parseBatchLimit(request: NextRequest): number {
  const raw = request.nextUrl.searchParams.get("limit");
  if (!raw) {
    return DEFAULT_BATCH_LIMIT;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_BATCH_LIMIT;
  }

  return Math.min(parsed, MAX_BATCH_LIMIT);
}

function isDryRun(request: NextRequest): boolean {
  const value = request.nextUrl.searchParams.get("dry_run");
  return value === "1" || value === "true";
}

function parseTargetEmail(request: NextRequest): string | null {
  const raw = request.nextUrl.searchParams.get("email");
  if (!raw) {
    return null;
  }

  const email = normalizeEmail(raw);
  if (!isValidEmail(email)) {
    return null;
  }

  return email;
}

function truncateError(error: unknown): string {
  if (error instanceof Error) {
    return error.message.slice(0, 800);
  }

  return "Unknown reminder delivery error";
}

export async function GET(request: NextRequest) {
  if (!isCronRequestAuthorized(request)) {
    return NextResponse.json(
      { ok: false, message: "Unauthorized cron trigger." },
      { status: 401 }
    );
  }

  const limit = parseBatchLimit(request);
  const dryRun = isDryRun(request);
  const targetEmail = parseTargetEmail(request);

  try {
    const subscribers = (targetEmail
      ? await sql`
          SELECT
            id::text AS id,
            email,
            name,
            confirm_token::text AS confirm_token,
            unsubscribe_token::text AS unsubscribe_token
          FROM subscribers
          WHERE unsubscribed_at IS NOT NULL
            AND confirmed_at IS NOT NULL
            AND email = ${targetEmail}
            AND (
              last_resubscribe_reminder_at IS NULL
              OR last_resubscribe_reminder_at <= NOW() - INTERVAL '7 days'
            )
          ORDER BY
            COALESCE(last_resubscribe_reminder_at, TO_TIMESTAMP(0)) ASC,
            unsubscribed_at ASC
          LIMIT ${limit}
        `
      : await sql`
          SELECT
            id::text AS id,
            email,
            name,
            confirm_token::text AS confirm_token,
            unsubscribe_token::text AS unsubscribe_token
          FROM subscribers
          WHERE unsubscribed_at IS NOT NULL
            AND confirmed_at IS NOT NULL
            AND (
              last_resubscribe_reminder_at IS NULL
              OR last_resubscribe_reminder_at <= NOW() - INTERVAL '7 days'
            )
          ORDER BY
            COALESCE(last_resubscribe_reminder_at, TO_TIMESTAMP(0)) ASC,
            unsubscribed_at ASC
          LIMIT ${limit}
        `) as UnsubscribedSubscriberRow[];

    let sentCount = 0;
    let failedCount = 0;

    for (const subscriber of subscribers) {
      const email = normalizeEmail(subscriber.email);
      if (!isValidEmail(email)) {
        failedCount += 1;
        continue;
      }

      const resubscribeUrl = buildAppUrl("/api/confirm", {
        token: subscriber.confirm_token,
      });
      const unsubscribeUrl = buildAppUrl("/api/unsubscribe", {
        token: subscriber.unsubscribe_token,
      });

      try {
        const messageId = dryRun
          ? `dry-run-${subscriber.id}`
          : await sendEmail({
              to: email,
              subject: "Still want The AI Green Wire updates?",
              html: buildResubscribeReminderEmailHtml(
                resubscribeUrl,
                unsubscribeUrl,
                subscriber.name
              ),
              tags: [
                { name: "flow", value: "subscriber-lifecycle" },
                { name: "action", value: "resubscribe-reminder" },
                { name: "subscriber_id", value: subscriber.id },
              ],
            });

        await sql`
          UPDATE subscribers
          SET last_resubscribe_reminder_at = NOW()
          WHERE id = ${subscriber.id}
        `;

        await sql`
          INSERT INTO send_log (subscriber_id, email, resend_id, status)
          VALUES (${subscriber.id}, ${email}, ${messageId}, ${dryRun ? "queued" : "sent"})
        `;

        sentCount += 1;
      } catch (error) {
        const message = truncateError(error);

        await sql`
          INSERT INTO send_log (subscriber_id, email, status, error)
          VALUES (${subscriber.id}, ${email}, 'failed', ${message})
        `;

        failedCount += 1;
      }
    }

    return NextResponse.json(
      {
        ok: true,
        processed: subscribers.length,
        sent: sentCount,
        failed: failedCount,
        cooldown: "7 days",
        dryRun,
        ...(targetEmail ? { targetEmail } : {}),
      },
      { status: 200 }
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to send resubscribe reminders.";

    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

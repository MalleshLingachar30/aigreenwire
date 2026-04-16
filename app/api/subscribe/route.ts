import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { sendEmail } from "@/lib/resend";
import {
  buildAppUrl,
  buildConfirmEmailHtml,
  isValidEmail,
  normalizeEmail,
  sanitizeName,
} from "@/lib/subscription";

type SubscribePayload = {
  email?: unknown;
  name?: unknown;
};

type ExistingSubscriberRow = {
  id: string;
  confirmed_at: string | null;
  unsubscribed_at: string | null;
};

type ConfirmTokenRow = {
  confirm_token: string;
};

export async function POST(request: NextRequest) {
  let payload: SubscribePayload;

  try {
    payload = (await request.json()) as SubscribePayload;
  } catch {
    return NextResponse.json(
      { ok: false, status: "invalid_payload", message: "Invalid request body." },
      { status: 400 }
    );
  }

  const rawEmail = typeof payload.email === "string" ? payload.email : "";
  const email = normalizeEmail(rawEmail);
  const name = sanitizeName(payload.name);

  if (!isValidEmail(email)) {
    return NextResponse.json(
      {
        ok: false,
        status: "invalid_email",
        message: "Please enter a valid email address.",
      },
      { status: 400 }
    );
  }

  try {
    const existingRows = (await sql`
      SELECT
        id::text AS id,
        confirmed_at::text AS confirmed_at,
        unsubscribed_at::text AS unsubscribed_at
      FROM subscribers
      WHERE email = ${email}
      LIMIT 1
    `) as ExistingSubscriberRow[];

    const existing = existingRows[0];

    if (existing?.confirmed_at && !existing.unsubscribed_at) {
      return NextResponse.json(
        {
          ok: true,
          status: "already_subscribed",
          message: "This email is already subscribed.",
        },
        { status: 200 }
      );
    }

    let confirmToken: string | null = null;

    if (existing) {
      const updatedRows = (await sql`
        UPDATE subscribers
        SET
          name = COALESCE(${name}, name),
          source = 'landing-page',
          subscribed_at = NOW(),
          confirmed_at = NULL,
          unsubscribed_at = NULL,
          confirm_token = gen_random_uuid(),
          unsubscribe_token = gen_random_uuid()
        WHERE id = ${existing.id}
        RETURNING confirm_token::text AS confirm_token
      `) as ConfirmTokenRow[];

      confirmToken = updatedRows[0]?.confirm_token ?? null;
    } else {
      const insertedRows = (await sql`
        INSERT INTO subscribers (email, name, source)
        VALUES (${email}, ${name}, 'landing-page')
        RETURNING confirm_token::text AS confirm_token
      `) as ConfirmTokenRow[];

      confirmToken = insertedRows[0]?.confirm_token ?? null;
    }

    if (!confirmToken) {
      throw new Error("Failed to issue confirmation token.");
    }

    const confirmUrl = buildAppUrl("/api/confirm", { token: confirmToken });

    try {
      await sendEmail({
        to: email,
        subject: "Confirm your subscription to The AI Green Wire",
        html: buildConfirmEmailHtml(confirmUrl, name),
        tags: [
          { name: "flow", value: "double-opt-in" },
          { name: "action", value: "subscribe-confirm" },
        ],
      });
    } catch {
      return NextResponse.json(
        {
          ok: false,
          status: "email_delivery_failed",
          message: "Could not send confirmation email. Please try again.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        status: "pending_confirmation",
        message: "Check your inbox to confirm your subscription.",
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      {
        ok: false,
        status: "subscription_failed",
        message: "Could not start subscription. Please try again.",
      },
      { status: 500 }
    );
  }
}

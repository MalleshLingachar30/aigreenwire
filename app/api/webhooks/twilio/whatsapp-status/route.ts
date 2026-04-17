import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getTwilioStatusWebhookSecret } from "@/lib/twilio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest): boolean {
  const configuredSecret = getTwilioStatusWebhookSecret();
  if (!configuredSecret) {
    return true;
  }

  const providedSecret = request.nextUrl.searchParams.get("secret")?.trim() ?? null;
  return providedSecret === configuredSecret;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, message: "Unauthorized webhook request." }, { status: 401 });
  }

  const formData = await request.formData();
  const messageSid = String(formData.get("MessageSid") ?? "").trim();
  const messageStatus = String(formData.get("MessageStatus") ?? "").trim();
  const errorCode = String(formData.get("ErrorCode") ?? "").trim() || null;
  const errorMessage = String(formData.get("ErrorMessage") ?? "").trim() || null;

  if (!messageSid || !messageStatus) {
    return NextResponse.json(
      { ok: false, message: "Missing MessageSid or MessageStatus." },
      { status: 400 }
    );
  }

  await sql`
    UPDATE whatsapp_card_deliveries
    SET
      status = ${messageStatus},
      error_code = ${errorCode},
      error_message = ${errorMessage},
      updated_at = NOW()
    WHERE provider = 'twilio'
      AND provider_message_sid = ${messageSid}
  `;

  return NextResponse.json({ ok: true }, { status: 200 });
}

import { sql } from "@/lib/db";
import {
  getTwilioClient,
  getTwilioStatusWebhookSecret,
  getTwilioWhatsAppContentSid,
  getTwilioWhatsAppFrom,
  hasTwilioWhatsAppConfig,
} from "@/lib/twilio";
import { buildAppUrl } from "@/lib/subscription";
import {
  buildCardImagePath,
  buildCardImageUrl,
  listStoredWhatsAppCards,
  type Language,
  type StoredWhatsAppCard,
} from "@/lib/whatsapp-cards";

type DeliveryMode = "template" | "session";
type DeliveryTrigger = "approve-auto" | "manual";

export type WhatsAppDeliveryTarget = {
  to: string;
  language: Language;
  label?: string;
};

export type WhatsAppDeliveryResult = {
  recipient: string;
  language: Language;
  cardNumber: 1 | 2 | 3;
  sid: string;
  status: string;
  mode: DeliveryMode;
  mediaUrl: string;
};

function isTruthy(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function isLanguage(value: unknown): value is Language {
  return value === "kn" || value === "te" || value === "ta" || value === "hi";
}

function normalizeWhatsAppAddress(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("WhatsApp recipient is empty.");
  }

  if (trimmed.startsWith("whatsapp:+")) {
    return trimmed;
  }

  if (/^\+\d{8,15}$/.test(trimmed)) {
    return `whatsapp:${trimmed}`;
  }

  throw new Error(`Invalid WhatsApp address: ${raw}`);
}

export function isWhatsAppAutoSendEnabled(): boolean {
  return isTruthy(process.env.WHATSAPP_AUTO_SEND_ENABLED);
}

export function hasWhatsAppTemplateConfig(): boolean {
  return Boolean(process.env.TWILIO_WHATSAPP_CONTENT_SID?.trim());
}

export function getConfiguredWhatsAppTargets(): WhatsAppDeliveryTarget[] {
  const raw = process.env.WHATSAPP_RECIPIENTS_JSON?.trim();
  if (!raw) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("WHATSAPP_RECIPIENTS_JSON must be valid JSON.");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("WHATSAPP_RECIPIENTS_JSON must be a JSON array.");
  }

  return parsed.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error(`Recipient at index ${index} is invalid.`);
    }

    const value = item as Record<string, unknown>;
    if (!isLanguage(value.language)) {
      throw new Error(`Recipient at index ${index} is missing a valid language.`);
    }

    if (typeof value.to !== "string") {
      throw new Error(`Recipient at index ${index} is missing a valid 'to' value.`);
    }

    const label = typeof value.label === "string" ? value.label.trim() : undefined;

    return {
      to: normalizeWhatsAppAddress(value.to),
      language: value.language,
      ...(label ? { label } : {}),
    };
  });
}

function getStatusCallbackUrl(): string {
  const secret = getTwilioStatusWebhookSecret();
  return buildAppUrl("/api/webhooks/twilio/whatsapp-status", secret ? { secret } : undefined);
}

async function insertDeliveryLog(
  issueId: string,
  issueNumber: number,
  card: StoredWhatsAppCard,
  recipient: string,
  recipientLabel: string | null,
  mode: DeliveryMode,
  trigger: DeliveryTrigger,
  sid: string,
  status: string,
  mediaUrl: string
): Promise<void> {
  await sql`
    INSERT INTO whatsapp_card_deliveries (
      issue_id,
      issue_number,
      language,
      card_number,
      recipient,
      recipient_label,
      provider,
      provider_message_sid,
      status,
      mode,
      trigger,
      media_url
    )
    VALUES (
      ${issueId},
      ${issueNumber},
      ${card.language},
      ${card.cardNumber},
      ${recipient},
      ${recipientLabel},
      'twilio',
      ${sid},
      ${status},
      ${mode},
      ${trigger},
      ${mediaUrl}
    )
  `;
}

async function sendTemplateMessage(
  issueId: string,
  issueNumber: number,
  card: StoredWhatsAppCard,
  target: WhatsAppDeliveryTarget,
  trigger: DeliveryTrigger
): Promise<WhatsAppDeliveryResult> {
  const client = getTwilioClient();
  const from = getTwilioWhatsAppFrom();
  const contentSid = getTwilioWhatsAppContentSid();
  const mediaUrl = buildCardImageUrl(issueNumber, card.language, card.cardNumber);
  const mediaPath = buildCardImagePath(issueNumber, card.language, card.cardNumber);

  const message = await client.messages.create({
    from,
    to: target.to,
    contentSid,
    contentVariables: JSON.stringify({
      1: mediaPath,
    }),
    statusCallback: getStatusCallbackUrl(),
  });

  await insertDeliveryLog(
    issueId,
    issueNumber,
    card,
    target.to,
    target.label ?? null,
    "template",
    trigger,
    message.sid,
    message.status ?? "queued",
    mediaUrl
  );

  return {
    recipient: target.to,
    language: card.language,
    cardNumber: card.cardNumber,
    sid: message.sid,
    status: message.status ?? "queued",
    mode: "template",
    mediaUrl,
  };
}

async function sendSessionMessage(
  issueId: string,
  issueNumber: number,
  card: StoredWhatsAppCard,
  target: WhatsAppDeliveryTarget,
  trigger: DeliveryTrigger
): Promise<WhatsAppDeliveryResult> {
  const client = getTwilioClient();
  const from = getTwilioWhatsAppFrom();
  const mediaUrl = buildCardImageUrl(issueNumber, card.language, card.cardNumber);

  const message = await client.messages.create({
    from,
    to: target.to,
    body: `The AI Green Wire · Issue ${String(issueNumber).padStart(2, "0")} · ${card.language.toUpperCase()} · Card ${card.cardNumber}`,
    mediaUrl: [mediaUrl],
    statusCallback: getStatusCallbackUrl(),
  });

  await insertDeliveryLog(
    issueId,
    issueNumber,
    card,
    target.to,
    target.label ?? null,
    "session",
    trigger,
    message.sid,
    message.status ?? "queued",
    mediaUrl
  );

  return {
    recipient: target.to,
    language: card.language,
    cardNumber: card.cardNumber,
    sid: message.sid,
    status: message.status ?? "queued",
    mode: "session",
    mediaUrl,
  };
}

export async function sendWhatsAppCardsForIssue(options: {
  issueId: string;
  issueNumber: number;
  trigger: DeliveryTrigger;
  mode: DeliveryMode;
  target?: {
    to: string;
    language: Language;
    label?: string;
  };
}): Promise<WhatsAppDeliveryResult[]> {
  if (!hasTwilioWhatsAppConfig()) {
    throw new Error("Twilio WhatsApp configuration is incomplete.");
  }

  if (options.mode === "template" && !hasWhatsAppTemplateConfig()) {
    throw new Error("TWILIO_WHATSAPP_CONTENT_SID is required for template sends.");
  }

  const storedCards = await listStoredWhatsAppCards(options.issueNumber);
  if (storedCards.length === 0) {
    throw new Error(`No stored WhatsApp cards found for issue ${options.issueNumber}.`);
  }

  const targets = options.target
    ? [
        {
          to: normalizeWhatsAppAddress(options.target.to),
          language: options.target.language,
          ...(options.target.label ? { label: options.target.label } : {}),
        },
      ]
    : getConfiguredWhatsAppTargets();

  if (targets.length === 0) {
    throw new Error("No WhatsApp delivery targets are configured.");
  }

  const jobs = targets.flatMap((target) => {
    const cardsForLanguage = storedCards.filter((card) => card.language === target.language);

    return cardsForLanguage.map((card) => {
      if (options.mode === "template") {
        return sendTemplateMessage(
          options.issueId,
          options.issueNumber,
          card,
          target,
          options.trigger
        );
      }

      return sendSessionMessage(
        options.issueId,
        options.issueNumber,
        card,
        target,
        options.trigger
      );
    });
  });

  if (jobs.length === 0) {
    throw new Error(`No WhatsApp cards matched the configured targets for issue ${options.issueNumber}.`);
  }

  return Promise.all(jobs);
}

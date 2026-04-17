import twilio from "twilio";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getTwilioClient() {
  const accountSid = requireEnv("TWILIO_ACCOUNT_SID");
  const apiKey = requireEnv("TWILIO_API_KEY");
  const apiSecret = requireEnv("TWILIO_API_SECRET");

  return twilio(apiKey, apiSecret, { accountSid });
}

export function getTwilioWhatsAppFrom(): string {
  return requireEnv("TWILIO_WHATSAPP_FROM");
}

export function getTwilioWhatsAppContentSid(): string {
  return requireEnv("TWILIO_WHATSAPP_CONTENT_SID");
}

export function getTwilioStatusWebhookSecret(): string | null {
  const value = process.env.TWILIO_STATUS_WEBHOOK_SECRET?.trim();
  return value || null;
}

export function hasTwilioWhatsAppConfig(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID?.trim() &&
      process.env.TWILIO_API_KEY?.trim() &&
      process.env.TWILIO_API_SECRET?.trim() &&
      process.env.TWILIO_WHATSAPP_FROM?.trim()
  );
}

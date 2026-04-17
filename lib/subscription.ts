const DEFAULT_APP_URL = "https://aigreenwire.com";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  // Practical validation for newsletter signup forms.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function sanitizeName(rawName: unknown): string | null {
  if (typeof rawName !== "string") {
    return null;
  }

  const value = rawName.trim();
  if (!value) {
    return null;
  }

  return value.slice(0, 120);
}

export function isUuidToken(token: string | null): token is string {
  return typeof token === "string" && UUID_PATTERN.test(token);
}

export function getAppUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (!configured) {
    return DEFAULT_APP_URL;
  }

  return configured.replace(/\/+$/, "");
}

export function buildAppUrl(
  pathname: string,
  params?: Record<string, string>
): string {
  const url = new URL(pathname, getAppUrl());

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  return url.toString();
}

export function buildConfirmEmailHtml(
  confirmUrl: string,
  unsubscribeUrl: string,
  name?: string | null
): string {
  const greeting = name ? `Hi ${escapeHtml(name)},` : "Hi,";

  return [
    `<p>${greeting}</p>`,
    "<p>Thanks for subscribing to <strong>The AI Green Wire</strong>.</p>",
    "<p>Please confirm your subscription by clicking the button below:</p>",
    `<p><a href=\"${confirmUrl}\" style=\"display:inline-block;padding:10px 16px;background:#047857;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;\">Confirm Subscription</a></p>`,
    `<p>If the button does not work, copy this URL into your browser:<br/><a href=\"${confirmUrl}\">${confirmUrl}</a></p>`,
    `<p>If you want to stop now, unsubscribe in one click:<br/><a href=\"${unsubscribeUrl}\">${unsubscribeUrl}</a></p>`,
    "<p>If you did not request this, you can ignore this email.</p>",
    "<p>— Mallesh Lingachar, Editor, The AI Green Wire</p>",
  ].join("");
}

export function buildWelcomeEmailHtml(
  archiveUrl: string,
  unsubscribeUrl: string,
  name?: string | null
): string {
  const greeting = name ? `Hi ${escapeHtml(name)},` : "Hi,";

  return [
    `<p>${greeting}</p>`,
    "<p>Welcome to <strong>The AI Green Wire</strong> — you're all set!</p>",
    "<p>Every Monday morning you'll receive a concise briefing covering the week's most important developments in AI applied to farming, forestry and ecology, with special attention to India and Indian growers.</p>",
    "<p>In the meantime, you can browse every past issue in the subscriber archive:</p>",
    `<p><a href=\"${archiveUrl}\" style=\"display:inline-block;padding:10px 16px;background:#047857;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;\">Browse the archive</a></p>`,
    `<p>If the button does not work, copy this URL into your browser:<br/><a href=\"${archiveUrl}\">${archiveUrl}</a></p>`,
    "<p>Thank you for joining. I'm glad to have you here.</p>",
    "<p>— Mallesh Lingachar, Editor, The AI Green Wire</p>",
    `<hr style=\"border:none;border-top:1px solid #e5e7eb;margin:24px 0 12px;\"/>`,
    `<p style=\"font-size:12px;color:#888;\"><a href=\"${unsubscribeUrl}\" style=\"color:#888;\">Unsubscribe</a></p>`,
  ].join("");
}

export function buildResubscribeReminderEmailHtml(
  resubscribeUrl: string,
  unsubscribeUrl: string,
  name?: string | null
): string {
  const greeting = name ? `Hi ${escapeHtml(name)},` : "Hi,";

  return [
    `<p>${greeting}</p>`,
    "<p>You previously unsubscribed from <strong>The AI Green Wire</strong>.</p>",
    "<p>We send one reminder per week in case you want to join again.</p>",
    `<p><a href=\"${resubscribeUrl}\" style=\"display:inline-block;padding:10px 16px;background:#047857;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;\">Resubscribe</a></p>`,
    `<p>If the button does not work, copy this URL into your browser:<br/><a href=\"${resubscribeUrl}\">${resubscribeUrl}</a></p>`,
    `<p>If you still prefer not to receive these reminders, you can stay unsubscribed here:<br/><a href=\"${unsubscribeUrl}\">${unsubscribeUrl}</a></p>`,
    "<p>— Mallesh Lingachar, Editor, The AI Green Wire</p>",
  ].join("");
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

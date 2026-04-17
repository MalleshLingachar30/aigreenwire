import { anthropic, type IssueData, type Story } from "@/lib/claude";
import { sql } from "@/lib/db";

export type Language = "kn" | "te" | "ta" | "hi";

export const LANGUAGE_CONFIG: Record<
  Language,
  {
    name: string;
    nativeName: string;
    readMoreText: string;
    weeklyBriefText: string;
    issueText: string;
    sourceText: string;
    actionText: string;
  }
> = {
  kn: {
    name: "Kannada",
    nativeName: "ಕನ್ನಡ",
    readMoreText: "ಇನ್ನಷ್ಟು ಓದಿ →",
    weeklyBriefText: "ವಾರದ ಸಂಕ್ಷಿಪ್ತ",
    issueText: "ಸಂಚಿಕೆ",
    sourceText: "ಮೂಲ",
    actionText: "ನೀವು ಏನು ಮಾಡಬಹುದು",
  },
  te: {
    name: "Telugu",
    nativeName: "తెలుగు",
    readMoreText: "మరింత చదవండి →",
    weeklyBriefText: "వారపు సారాంశం",
    issueText: "సంచిక",
    sourceText: "మూలం",
    actionText: "మీరు ఏమి చేయవచ్చు",
  },
  ta: {
    name: "Tamil",
    nativeName: "தமிழ்",
    readMoreText: "மேலும் படிக்க →",
    weeklyBriefText: "வாராந்திர சுருக்கம்",
    issueText: "இதழ்",
    sourceText: "ஆதாரம்",
    actionText: "நீங்கள் என்ன செய்யலாம்",
  },
  hi: {
    name: "Hindi",
    nativeName: "हिन्दी",
    readMoreText: "और पढ़ें →",
    weeklyBriefText: "साप्ताहिक सारांश",
    issueText: "अंक",
    sourceText: "स्रोत",
    actionText: "आप क्या कर सकते हैं",
  },
};

const LANGUAGE_LIST: Language[] = ["kn", "te", "ta", "hi"];
const TRANSLATION_MODEL = "claude-sonnet-4-20250514";
const TRANSLATION_MAX_TOKENS_SINGLE = 900;
const TRANSLATION_TIMEOUT_MS = 25_000;
const TRANSLATION_MAX_ATTEMPTS = 3;

type BaseCard = {
  cardNumber: 1 | 2 | 3;
  tag: string;
  headline: string;
  summary: string;
  actionText: string;
  sourceUrl: string | null;
  sourceName: string | null;
};

type TranslatedCardText = {
  cardNumber: 1 | 2 | 3;
  headline: string;
  summary: string;
  actionText: string;
};

export type TranslatedCard = {
  language: Language;
  cardNumber: 1 | 2 | 3;
  tag: string;
  headline: string;
  summary: string;
  actionText: string;
  sourceUrl: string | null;
  sourceName: string | null;
};

class TranslationParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TranslationParseError";
  }
}

function sanitizeLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function getFirstParagraph(story: Story): string {
  const firstParagraph = story.paragraphs[0] ?? "";
  return sanitizeLine(firstParagraph);
}

function getActionLine(story: Story): string {
  if (story.action && story.action.trim()) {
    return sanitizeLine(story.action);
  }

  return "Read the full update and discuss practical next steps with your local farming network.";
}

export function isLanguage(value: string | null): value is Language {
  if (!value) {
    return false;
  }

  return LANGUAGE_LIST.includes(value as Language);
}

export function selectTopStories(data: IssueData): [Story, Story, Story] {
  const indiaStories = data.stories.filter((story) => story.section === "india");
  const forestryStories = data.stories.filter((story) => story.section === "forestry");
  const studentStories = data.stories.filter((story) => story.section === "students");

  const primaryIndia = indiaStories[0];
  const primaryForestry = forestryStories[0];
  const flexStory = indiaStories[1] ?? forestryStories[1] ?? studentStories[0];

  if (!primaryIndia || !primaryForestry || !flexStory) {
    throw new Error("Issue data does not include enough stories for WhatsApp card selection.");
  }

  return [primaryIndia, primaryForestry, flexStory];
}

function buildBaseCards(data: IssueData): BaseCard[] {
  const topStories = selectTopStories(data);

  return topStories.map((story, index) => {
    const primarySource = story.sources[0];
    const cardNumber = (index + 1) as 1 | 2 | 3;

    return {
      cardNumber,
      tag: sanitizeLine(story.tag),
      headline: sanitizeLine(story.headline),
      summary: getFirstParagraph(story),
      actionText: getActionLine(story),
      sourceUrl: primarySource?.url?.trim() || null,
      sourceName: primarySource?.name?.trim() || null,
    };
  });
}

function extractTextFromAnthropicResponse(response: any): string {
  const textBlocks = response.content.filter((block: any) => block.type === "text");
  const lastText = textBlocks[textBlocks.length - 1]?.text;
  if (typeof lastText !== "string" || !lastText.trim()) {
    throw new TranslationParseError("Claude returned no text for WhatsApp card translation.");
  }

  return lastText.replace(/```json\s*/g, "").replace(/```/g, "").trim();
}

function parseJsonLikeText(rawResponse: string): unknown {
  const jsonCandidate = (() => {
    const trimmed = rawResponse.replace(/```json\s*/g, "").replace(/```/g, "").trim();
    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");

    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return trimmed.slice(firstBrace, lastBrace + 1);
    }

    return trimmed;
  })();

  try {
    return JSON.parse(jsonCandidate);
  } catch {
    throw new TranslationParseError("Claude returned invalid JSON for WhatsApp card translation.");
  }
}

function parseTranslatedCards(payload: unknown, baseCards: BaseCard[]): TranslatedCardText[] {
  const parsed = payload && typeof payload === "object" ? payload : null;
  if (!parsed) {
    throw new TranslationParseError("Translated payload must be an object.");
  }

  const cards = (parsed as { cards?: unknown }).cards;
  if (!Array.isArray(cards) || cards.length !== baseCards.length) {
    throw new TranslationParseError("Translated payload must contain 3 cards.");
  }

  return cards.map((card, index) => {
    if (!card || typeof card !== "object") {
      throw new TranslationParseError(`Translated card at index ${index} is invalid.`);
    }

    const value = card as Record<string, unknown>;
    const expectedCardNumber = baseCards[index]!.cardNumber;
    const cardNumberCandidate = Number(value.cardNumber);
    const cardNumber = Number.isInteger(cardNumberCandidate)
      ? (cardNumberCandidate as 1 | 2 | 3)
      : expectedCardNumber;

    if (cardNumber !== expectedCardNumber) {
      throw new TranslationParseError(
        `Translated card number mismatch at index ${index}: expected ${expectedCardNumber}, got ${cardNumber}.`
      );
    }

    const sourceCard = baseCards[index]!;
    const headline =
      typeof value.headline === "string" && sanitizeLine(value.headline)
        ? sanitizeLine(value.headline)
        : sourceCard.headline;
    const summary =
      typeof value.summary === "string" && sanitizeLine(value.summary)
        ? sanitizeLine(value.summary)
        : sourceCard.summary;
    const actionText =
      typeof value.actionText === "string" && sanitizeLine(value.actionText)
        ? sanitizeLine(value.actionText)
        : sourceCard.actionText;

    if (!headline || !summary || !actionText) {
      throw new TranslationParseError(`Translated card at index ${index} has empty fields.`);
    }

    return {
      cardNumber: expectedCardNumber,
      headline,
      summary,
      actionText,
    };
  });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isRetryableStatus(status: number | undefined): boolean {
  if (typeof status !== "number") {
    return false;
  }

  return status === 408 || status === 409 || status === 429 || status >= 500;
}

function parseRetryAfterSeconds(value: unknown): number | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const asNumber = Number.parseFloat(value);
  if (Number.isFinite(asNumber) && asNumber >= 0) {
    return asNumber;
  }

  const asDate = Date.parse(value);
  if (Number.isNaN(asDate)) {
    return null;
  }

  const ms = asDate - Date.now();
  return ms > 0 ? ms / 1000 : 0;
}

function getHeaderValue(headers: unknown, key: string): string | null {
  if (!headers) {
    return null;
  }

  if (headers instanceof Headers) {
    return headers.get(key);
  }

  if (Array.isArray(headers)) {
    const entry = headers.find(([name]) => name.toLowerCase() === key.toLowerCase());
    return entry ? String(entry[1]) : null;
  }

  if (typeof headers === "object") {
    const record = headers as Record<string, unknown>;
    const direct = record[key] ?? record[key.toLowerCase()];
    return typeof direct === "string" ? direct : null;
  }

  return null;
}

function getErrorStatus(error: unknown): number | undefined {
  if (!isObject(error)) {
    return undefined;
  }

  const status = error.status;
  return typeof status === "number" ? status : undefined;
}

function getRetryAfterMs(error: unknown): number {
  if (!isObject(error)) {
    return 0;
  }

  const retryAfter = parseRetryAfterSeconds(getHeaderValue(error.headers, "retry-after"));
  if (retryAfter !== null) {
    return Math.max(250, Math.min(5_000, Math.round(retryAfter * 1_000)));
  }

  const resetAt = getHeaderValue(error.headers, "anthropic-ratelimit-output-tokens-reset");
  if (resetAt) {
    const resetMs = Date.parse(resetAt) - Date.now();
    if (Number.isFinite(resetMs) && resetMs > 0) {
      return Math.max(250, Math.min(5_000, resetMs));
    }
  }

  return 0;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(error: unknown): boolean {
  if (isRetryableStatus(getErrorStatus(error))) {
    return true;
  }

  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return (
    message.includes("connection error") ||
    message.includes("network") ||
    message.includes("timed out") ||
    message.includes("econnreset")
  );
}

async function createTranslationMessage(params: any) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= TRANSLATION_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await anthropic.messages.create(params, {
        timeout: TRANSLATION_TIMEOUT_MS,
        maxRetries: 0,
      });
    } catch (error) {
      lastError = error;
      if (!isRetryableError(error) || attempt >= TRANSLATION_MAX_ATTEMPTS) {
        throw error;
      }

      const retryAfterMs = getRetryAfterMs(error);
      const backoffMs = 500 * attempt;
      await sleep(Math.max(backoffMs, retryAfterMs));
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Translation request failed.");
}

async function translateCardsForLanguage(
  baseCards: BaseCard[],
  language: Language
): Promise<TranslatedCard[]> {
  const translatedCards: TranslatedCard[] = [];

  for (const baseCard of baseCards) {
    const translated = await translateSingleCardForLanguage(baseCard, language);
    translatedCards.push({
      language,
      cardNumber: translated.cardNumber,
      tag: baseCard.tag,
      headline: translated.headline,
      summary: translated.summary,
      actionText: translated.actionText,
      sourceUrl: baseCard.sourceUrl,
      sourceName: baseCard.sourceName,
    });
  }

  return translatedCards;
}

async function translateSingleCardForLanguage(
  baseCard: BaseCard,
  language: Language
): Promise<TranslatedCardText> {
  const languageMeta = LANGUAGE_CONFIG[language];
  const prompt = [
    `Translate one WhatsApp news card into ${languageMeta.name} (${languageMeta.nativeName}).`,
    "Use simple, grower-friendly language suitable for Indian farmers.",
    "Keep these terms in English exactly as-is when present: AI, GPS, satellite, drone, carbon credit.",
    "Keep proper nouns and institution names in English.",
    "Do not add or remove facts.",
    "Every output field must be non-empty. If translation is uncertain, keep the original English phrase instead of leaving blank text.",
    "Return only one translated JSON object with cardNumber, headline, summary, actionText.",
    "Input card JSON:",
    JSON.stringify(baseCard),
  ].join("\n");

  for (let parseAttempt = 1; parseAttempt <= 3; parseAttempt += 1) {
    try {
      const response = await createTranslationMessage({
        model: TRANSLATION_MODEL,
        max_tokens: TRANSLATION_MAX_TOKENS_SINGLE,
        tools: [
          {
            name: "store_single_translation",
            description: "Save one translated WhatsApp card with strict JSON fields.",
            input_schema: {
              type: "object",
              properties: {
                cardNumber: { type: "integer", enum: [1, 2, 3] },
                headline: { type: "string" },
                summary: { type: "string" },
                actionText: { type: "string" },
              },
              required: ["cardNumber", "headline", "summary", "actionText"],
            },
          },
        ],
        tool_choice: {
          type: "tool",
          name: "store_single_translation",
        },
        messages: [{ role: "user", content: prompt }],
      } as any);

      const toolBlock = (response.content as any[]).find(
        (block) => block.type === "tool_use" && block.name === "store_single_translation"
      ) as { input?: unknown } | undefined;

      const payload =
        toolBlock && typeof toolBlock.input === "object"
          ? toolBlock.input
          : parseJsonLikeText(extractTextFromAnthropicResponse(response));
      const cards = parseTranslatedCards({ cards: [payload] }, [baseCard]);
      return cards[0]!;
    } catch (error) {
      if (!(error instanceof TranslationParseError) || parseAttempt >= 3) {
        throw error;
      }
    }
  }

  throw new Error(`Failed to translate card ${baseCard.cardNumber} for ${languageMeta.name}.`);
}

export async function generateTranslatedCards(data: IssueData): Promise<TranslatedCard[]> {
  const baseCards = buildBaseCards(data);
  const translatedByLanguage = await Promise.all(
    LANGUAGE_LIST.map((language) => translateCardsForLanguage(baseCards, language))
  );

  return translatedByLanguage.flat();
}

export async function upsertWhatsAppCards(
  issueId: string,
  issueNumber: number,
  cards: TranslatedCard[]
): Promise<void> {
  await Promise.all(
    cards.map((card) =>
      sql`
        INSERT INTO whatsapp_cards (
          issue_id,
          issue_number,
          language,
          card_number,
          headline,
          summary,
          action_text,
          tag,
          source_url,
          source_name
        )
        VALUES (
          ${issueId},
          ${issueNumber},
          ${card.language},
          ${card.cardNumber},
          ${card.headline},
          ${card.summary},
          ${card.actionText},
          ${card.tag || null},
          ${card.sourceUrl},
          ${card.sourceName}
        )
        ON CONFLICT (issue_id, language, card_number)
        DO UPDATE SET
          headline = EXCLUDED.headline,
          summary = EXCLUDED.summary,
          action_text = EXCLUDED.action_text,
          tag = EXCLUDED.tag,
          source_url = EXCLUDED.source_url,
          source_name = EXCLUDED.source_name
      `
    )
  );
}

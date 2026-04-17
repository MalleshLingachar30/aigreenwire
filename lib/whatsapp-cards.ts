import { anthropic, type IssueData, type Story } from "@/lib/claude";
import { sql } from "@/lib/db";
import { buildAppUrl } from "@/lib/subscription";

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

export type StoredWhatsAppCard = TranslatedCard & {
  issueId: string;
  issueNumber: number;
  createdAt: string | null;
};

function sanitizeLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function parseCardNumber(value: number): 1 | 2 | 3 {
  if (value !== 1 && value !== 2 && value !== 3) {
    throw new Error(`Invalid WhatsApp card number: ${value}`);
  }

  return value;
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

export function parseStoredIssueData(raw: unknown, issueNumber: number): IssueData {
  let payload = raw;

  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload);
    } catch {
      throw new Error("stories_json contains invalid JSON.");
    }
  }

  if (!payload || typeof payload !== "object") {
    throw new Error("stories_json is missing.");
  }

  const issueData = payload as Partial<IssueData>;
  if (!Array.isArray(issueData.stories)) {
    throw new Error("stories_json has no stories array.");
  }

  issueData.issue_number = issueNumber;
  return issueData as IssueData;
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
    throw new Error("Claude returned no text for WhatsApp card translation.");
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
    throw new Error("Claude returned invalid JSON for WhatsApp card translation.");
  }
}

function parseTranslatedCards(payload: unknown, baseCards: BaseCard[]): TranslatedCardText[] {
  const parsed = payload && typeof payload === "object" ? payload : null;
  if (!parsed) {
    throw new Error("Translated payload must be an object.");
  }

  const cards = (parsed as { cards?: unknown }).cards;
  if (!Array.isArray(cards) || cards.length !== baseCards.length) {
    throw new Error("Translated payload must contain 3 cards.");
  }

  return cards.map((card, index) => {
    if (!card || typeof card !== "object") {
      throw new Error(`Translated card at index ${index} is invalid.`);
    }

    const value = card as Record<string, unknown>;
    const cardNumber = Number(value.cardNumber);
    const expectedCardNumber = baseCards[index]!.cardNumber;
    if (cardNumber !== expectedCardNumber) {
      throw new Error(
        `Translated card number mismatch at index ${index}: expected ${expectedCardNumber}, got ${cardNumber}.`
      );
    }

    const headline = typeof value.headline === "string" ? sanitizeLine(value.headline) : "";
    const summary = typeof value.summary === "string" ? sanitizeLine(value.summary) : "";
    const actionText = typeof value.actionText === "string" ? sanitizeLine(value.actionText) : "";

    if (!headline || !summary || !actionText) {
      throw new Error(`Translated card at index ${index} has empty fields.`);
    }

    return {
      cardNumber: expectedCardNumber,
      headline,
      summary,
      actionText,
    };
  });
}

async function translateCardsForLanguage(
  baseCards: BaseCard[],
  language: Language
): Promise<TranslatedCard[]> {
  const languageMeta = LANGUAGE_CONFIG[language];

  const prompt = [
    `Translate 3 WhatsApp news cards into ${languageMeta.name} (${languageMeta.nativeName}).`,
    "Use simple, grower-friendly language suitable for Indian farmers.",
    "Keep these terms in English exactly as-is when present: AI, GPS, satellite, drone, carbon credit.",
    "Keep proper nouns and institution names in English.",
    "Do not add new facts, numbers, or claims. Translate only the provided text.",
    "Return only valid JSON using this exact shape:",
    '{"cards":[{"cardNumber":1,"headline":"...","summary":"...","actionText":"..."}]}',
    "Input cards JSON:",
    JSON.stringify(baseCards),
  ].join("\n");

  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await anthropic.messages.create({
        model: TRANSLATION_MODEL,
        max_tokens: 2000,
        tools: [
          {
            name: "store_translation",
            description: "Save translated WhatsApp cards with strict JSON fields.",
            input_schema: {
              type: "object",
              properties: {
                cards: {
                  type: "array",
                  minItems: 3,
                  maxItems: 3,
                  items: {
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
              },
              required: ["cards"],
            },
          },
        ],
        tool_choice: {
          type: "tool",
          name: "store_translation",
        },
        messages: [{ role: "user", content: prompt }],
      } as any);

      const toolBlock = (response.content as any[]).find(
        (block) => block.type === "tool_use" && block.name === "store_translation"
      ) as { input?: unknown } | undefined;
      const translatedPayload =
        toolBlock && typeof toolBlock.input === "object"
          ? toolBlock.input
          : parseJsonLikeText(extractTextFromAnthropicResponse(response));
      const translatedText = parseTranslatedCards(translatedPayload, baseCards);

      return translatedText.map((translated, index) => {
        const source = baseCards[index]!;

        return {
          language,
          cardNumber: translated.cardNumber,
          tag: source.tag,
          headline: translated.headline,
          summary: translated.summary,
          actionText: translated.actionText,
          sourceUrl: source.sourceUrl,
          sourceName: source.sourceName,
        };
      });
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Failed to translate cards for ${languageMeta.name}.`);
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
    "Input card JSON:",
    JSON.stringify(baseCard),
  ].join("\n");

  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await anthropic.messages.create({
        model: TRANSLATION_MODEL,
        max_tokens: 800,
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
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Failed to translate card ${baseCard.cardNumber} for ${languageMeta.name}.`);
}

export async function generateTranslatedCards(data: IssueData): Promise<TranslatedCard[]> {
  const baseCards = buildBaseCards(data);
  const translatedByLanguage = await Promise.all(
    LANGUAGE_LIST.map(async (language) => {
      try {
        return await translateCardsForLanguage(baseCards, language);
      } catch {
        const fallbackCards = await Promise.all(
          baseCards.map((baseCard) => translateSingleCardForLanguage(baseCard, language))
        );

        return fallbackCards.map((translated, index) => {
          const source = baseCards[index]!;
          return {
            language,
            cardNumber: translated.cardNumber,
            tag: source.tag,
            headline: translated.headline,
            summary: translated.summary,
            actionText: translated.actionText,
            sourceUrl: source.sourceUrl,
            sourceName: source.sourceName,
          };
        });
      }
    })
  );

  return translatedByLanguage.flat();
}

export async function generateAndStoreWhatsAppCards(
  issueId: string,
  issueNumber: number,
  storiesJson: unknown
): Promise<TranslatedCard[]> {
  const issueData = parseStoredIssueData(storiesJson, issueNumber);
  const cards = await generateTranslatedCards(issueData);
  await upsertWhatsAppCards(issueId, issueNumber, cards);
  return cards;
}

export function buildCardPreviewUrl(
  issueNumber: number,
  language: Language,
  cardNumber: 1 | 2 | 3
): string {
  return buildAppUrl("/api/cards/preview", {
    issue: String(issueNumber),
    lang: language,
    card: String(cardNumber),
  });
}

export function buildCardImageUrl(
  issueNumber: number,
  language: Language,
  cardNumber: 1 | 2 | 3
): string {
  return buildAppUrl("/api/cards/image", {
    issue: String(issueNumber),
    lang: language,
    card: String(cardNumber),
  });
}

export function buildCardImagePath(
  issueNumber: number,
  language: Language,
  cardNumber: 1 | 2 | 3
): string {
  return `/api/cards/image?issue=${issueNumber}&lang=${language}&card=${cardNumber}`;
}

export async function listStoredWhatsAppCards(issueNumber: number): Promise<StoredWhatsAppCard[]> {
  const rows = (await sql`
    SELECT
      issue_id::text AS issue_id,
      issue_number,
      language,
      card_number,
      headline,
      summary,
      action_text,
      tag,
      source_url,
      source_name,
      created_at::text AS created_at
    FROM whatsapp_cards
    WHERE issue_number = ${issueNumber}
    ORDER BY language, card_number
  `) as Array<{
    issue_id: string;
    issue_number: number;
    language: Language;
    card_number: number;
    headline: string;
    summary: string;
    action_text: string;
    tag: string | null;
    source_url: string | null;
    source_name: string | null;
    created_at: string | null;
  }>;

  return rows.map((row) => ({
    issueId: row.issue_id,
    issueNumber: Number(row.issue_number),
    language: row.language,
    cardNumber: parseCardNumber(Number(row.card_number)),
    tag: row.tag ?? "",
    headline: row.headline,
    summary: row.summary,
    actionText: row.action_text,
    sourceUrl: row.source_url,
    sourceName: row.source_name,
    createdAt: row.created_at,
  }));
}

export async function getStoredWhatsAppCard(
  issueNumber: number,
  language: Language,
  cardNumber: 1 | 2 | 3
): Promise<StoredWhatsAppCard | null> {
  const rows = (await sql`
    SELECT
      issue_id::text AS issue_id,
      issue_number,
      language,
      card_number,
      headline,
      summary,
      action_text,
      tag,
      source_url,
      source_name,
      created_at::text AS created_at
    FROM whatsapp_cards
    WHERE issue_number = ${issueNumber}
      AND language = ${language}
      AND card_number = ${cardNumber}
    LIMIT 1
  `) as Array<{
    issue_id: string;
    issue_number: number;
    language: Language;
    card_number: number;
    headline: string;
    summary: string;
    action_text: string;
    tag: string | null;
    source_url: string | null;
    source_name: string | null;
    created_at: string | null;
  }>;

  const row = rows[0];
  if (!row) {
    return null;
  }

  return {
    issueId: row.issue_id,
    issueNumber: Number(row.issue_number),
    language: row.language,
    cardNumber: parseCardNumber(Number(row.card_number)),
    tag: row.tag ?? "",
    headline: row.headline,
    summary: row.summary,
    actionText: row.action_text,
    sourceUrl: row.source_url,
    sourceName: row.source_name,
    createdAt: row.created_at,
  };
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

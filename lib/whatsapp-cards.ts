import { anthropic, type IssueData, type Story } from "@/lib/claude";
import { stripCitationMarkup } from "@/lib/citation-sanitize";
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
const CARD_HEADLINE_FALLBACK = "AI Green Wire Update";
const CARD_SUMMARY_FALLBACK = "Latest agriculture and forestry AI update for Indian growers.";
const CARD_ACTION_FALLBACK =
  "Read the full update and discuss practical next steps with your local farming network.";

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

function sanitizeLine(value: string): string {
  return stripCitationMarkup(value).replace(/\s+/g, " ").trim();
}

function normalizeSourceUrl(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

function firstNonEmptyLine(lines: string[]): string {
  for (const line of lines) {
    const sanitized = sanitizeLine(line);
    if (sanitized) {
      return sanitized;
    }
  }

  return "";
}

function getHeadline(story: Story): string {
  return firstNonEmptyLine([story.headline]) || CARD_HEADLINE_FALLBACK;
}

function getSummary(story: Story): string {
  return firstNonEmptyLine(story.paragraphs) || getHeadline(story) || CARD_SUMMARY_FALLBACK;
}

function getActionLine(story: Story): string {
  if (story.action && story.action.trim()) {
    return sanitizeLine(story.action);
  }

  return CARD_ACTION_FALLBACK;
}

function getTag(story: Story): string {
  return firstNonEmptyLine([story.tag]) || story.section.toUpperCase();
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
      tag: getTag(story),
      headline: getHeadline(story),
      summary: getSummary(story),
      actionText: getActionLine(story),
      sourceUrl: normalizeSourceUrl(primarySource?.url),
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
  if (!Array.isArray(cards)) {
    throw new Error("Translated payload must include a cards array.");
  }

  return baseCards.map((baseCard, index) => {
    const card = cards[index];
    const value = card && typeof card === "object" ? (card as Record<string, unknown>) : {};

    const headline =
      (typeof value.headline === "string" ? sanitizeLine(value.headline) : "") || baseCard.headline;
    const summary =
      (typeof value.summary === "string" ? sanitizeLine(value.summary) : "") || baseCard.summary;
    const actionText =
      (typeof value.actionText === "string" ? sanitizeLine(value.actionText) : "") ||
      baseCard.actionText;

    if (!headline || !summary || !actionText) {
      throw new Error(`Translated card at index ${index} has empty fields after fallback.`);
    }

    return {
      cardNumber: baseCard.cardNumber,
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
        max_tokens: 1600,
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

export async function upsertWhatsAppCards(
  issueId: string,
  issueNumber: number,
  cards: TranslatedCard[]
): Promise<void> {
  await Promise.all(
    cards.map((card) => {
      const sanitizedHeadline = sanitizeLine(card.headline) || CARD_HEADLINE_FALLBACK;
      const sanitizedSummary = sanitizeLine(card.summary) || CARD_SUMMARY_FALLBACK;
      const sanitizedActionText = sanitizeLine(card.actionText) || CARD_ACTION_FALLBACK;
      const sanitizedSourceUrl = normalizeSourceUrl(card.sourceUrl);

      return sql`
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
          ${sanitizedHeadline},
          ${sanitizedSummary},
          ${sanitizedActionText},
          ${card.tag || null},
          ${sanitizedSourceUrl},
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
    })
  );
}

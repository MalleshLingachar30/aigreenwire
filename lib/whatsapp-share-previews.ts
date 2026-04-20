import { sql } from "@/lib/db";
import { type Language } from "@/lib/whatsapp-cards";

type StoredPreviewRow = {
  mime_type: string;
  image_width: number;
  image_height: number;
  image_base64: string;
};

export type StoredSharePreview = {
  mimeType: string;
  width: number;
  height: number;
  imageData: Buffer;
};

export async function loadStoredSharePreview(
  issueNumber: number,
  language: Language
): Promise<StoredSharePreview | null> {
  let rows: StoredPreviewRow[];

  try {
    rows = (await sql`
      SELECT
        mime_type,
        image_width,
        image_height,
        encode(image_data, 'base64') AS image_base64
      FROM whatsapp_card_share_previews
      WHERE issue_number = ${issueNumber}
        AND language = ${language}
      LIMIT 1
    `) as StoredPreviewRow[];
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes('relation "whatsapp_card_share_previews" does not exist')) {
      return null;
    }

    throw error;
  }

  const row = rows[0];
  if (!row) {
    return null;
  }

  return {
    mimeType: row.mime_type,
    width: Number(row.image_width),
    height: Number(row.image_height),
    imageData: Buffer.from(row.image_base64, "base64"),
  };
}

export async function deleteStoredSharePreview(
  issueId: string,
  language: Language
): Promise<void> {
  await sql`
    DELETE FROM whatsapp_card_share_previews
    WHERE issue_id = ${issueId}
      AND language = ${language}
  `;
}

export async function upsertStoredSharePreview(params: {
  issueId: string;
  issueNumber: number;
  language: Language;
  sourceCardNumber: 1 | 2 | 3;
  mimeType: string;
  width: number;
  height: number;
  imageData: Buffer;
}): Promise<void> {
  const encodedImage = params.imageData.toString("base64");

  await sql`
    INSERT INTO whatsapp_card_share_previews (
      issue_id,
      issue_number,
      language,
      source_card_number,
      mime_type,
      image_width,
      image_height,
      image_data
    )
    VALUES (
      ${params.issueId},
      ${params.issueNumber},
      ${params.language},
      ${params.sourceCardNumber},
      ${params.mimeType},
      ${params.width},
      ${params.height},
      decode(${encodedImage}, 'base64')
    )
    ON CONFLICT (issue_id, language)
    DO UPDATE SET
      source_card_number = EXCLUDED.source_card_number,
      mime_type = EXCLUDED.mime_type,
      image_width = EXCLUDED.image_width,
      image_height = EXCLUDED.image_height,
      image_data = EXCLUDED.image_data,
      updated_at = NOW()
  `;
}

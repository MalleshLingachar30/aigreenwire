import { NextRequest, NextResponse } from "next/server";
import { isCronRequestAuthorized } from "@/lib/api-auth";
import { sql } from "@/lib/db";

export const maxDuration = 60;

type PendingCountRow = {
  pending_count: number | string;
};

type UpdatedSubscriberRow = {
  id: string;
  email: string;
};

export async function GET(request: NextRequest) {
  if (!isCronRequestAuthorized(request)) {
    return NextResponse.json(
      { ok: false, message: "Unauthorized cron trigger." },
      { status: 401 }
    );
  }

  try {
    const pendingRows = (await sql`
      SELECT COUNT(*)::int AS pending_count
      FROM subscribers
      WHERE confirmed_at IS NULL
        AND unsubscribed_at IS NULL
    `) as PendingCountRow[];

    const pendingCount = Number(pendingRows[0]?.pending_count ?? 0);

    const updatedRows = (await sql`
      UPDATE subscribers
      SET
        confirmed_at = NOW(),
        unsubscribe_token = COALESCE(unsubscribe_token, gen_random_uuid()),
        confirm_token = COALESCE(confirm_token, gen_random_uuid())
      WHERE confirmed_at IS NULL
        AND unsubscribed_at IS NULL
      RETURNING id::text AS id, email
    `) as UpdatedSubscriberRow[];

    return NextResponse.json(
      {
        ok: true,
        pendingBefore: pendingCount,
        confirmedNow: updatedRows.length,
        emails: updatedRows.map((row) => row.email),
      },
      { status: 200 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to confirm pending subscribers.";

    console.error(
      "[cron] confirm pending subscribers failed",
      JSON.stringify({
        message,
        error:
          error instanceof Error
            ? {
                name: error.name,
                message: error.message,
                stack: error.stack,
              }
            : error,
      })
    );

    return NextResponse.json(
      {
        ok: false,
        message,
      },
      { status: 500 }
    );
  }
}

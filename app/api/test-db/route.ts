import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

type NowRow = {
  time: string | Date;
};

export async function GET() {
  try {
    const rows = (await sql`SELECT NOW() AS time`) as NowRow[];
    const time = rows[0]?.time ?? null;

    return NextResponse.json({ ok: true, time });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown database error";

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

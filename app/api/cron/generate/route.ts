import { NextResponse } from "next/server";

export async function GET() {
  // TODO: Stage 4 — Monday cron, Claude generation
  return NextResponse.json({ message: "Cron generate placeholder" }, { status: 200 });
}

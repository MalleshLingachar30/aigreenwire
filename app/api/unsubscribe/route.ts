import { NextResponse } from "next/server";

export async function GET() {
  // TODO: Stage 2 — unsubscribe logic
  return NextResponse.json({ message: "Unsubscribe endpoint placeholder" }, { status: 200 });
}

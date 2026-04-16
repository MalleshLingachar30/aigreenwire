import { NextResponse } from "next/server";

export async function GET() {
  // TODO: Stage 2 — double opt-in confirmation
  return NextResponse.json({ message: "Confirm endpoint placeholder" }, { status: 200 });
}

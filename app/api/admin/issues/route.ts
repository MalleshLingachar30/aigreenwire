import { NextResponse } from "next/server";

export async function GET() {
  // TODO: Stage 5 — list drafts and issues
  return NextResponse.json({ message: "Admin issues placeholder" }, { status: 200 });
}

import { NextResponse } from "next/server";
import { isDatabaseConfigured } from "@everyskill/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const dbOk = isDatabaseConfigured();
  if (!dbOk) {
    return NextResponse.json({ status: "unhealthy", db: false }, { status: 503 });
  }
  return NextResponse.json({ status: "healthy", db: true });
}

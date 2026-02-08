import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@everyskill/db/services/api-keys";

/**
 * POST /api/auth/validate-key
 *
 * Validates an API key and returns the associated userId.
 * This route does NOT require an Auth.js session -- middleware
 * already allows all /api/auth/* paths through unauthenticated.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { key } = body as { key?: unknown };

  if (!key || typeof key !== "string") {
    return NextResponse.json({ error: "Missing key" }, { status: 400 });
  }

  const result = await validateApiKey(key);

  if (!result) {
    return NextResponse.json({ error: "Invalid or revoked key" }, { status: 401 });
  }

  return NextResponse.json(
    {
      userId: result.userId,
      keyId: result.keyId,
      tenantId: result.tenantId,
      isExpired: result.isExpired,
    },
    { status: 200 }
  );
}

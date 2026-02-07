import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@everyskill/db/services/api-keys";
import { incrementSkillUses } from "@everyskill/db/services/skill-metrics";
import { db } from "@everyskill/db";
import { usageEvents } from "@everyskill/db/schema";

// TODO: Replace with dynamic tenant resolution when multi-tenant routing is implemented
const DEFAULT_TENANT_ID = "default-tenant-000-0000-000000000000";

/**
 * POST /api/install-callback
 *
 * Records an install_confirmed usage event when a skill is installed.
 * This route does NOT require an Auth.js session -- middleware
 * exempts /api/install-callback from authentication.
 *
 * Accepts JSON: { key, skillId, platform, os, clientVersion }
 * - key: optional API key to resolve userId (anonymous installs are valid)
 * - skillId: optional skill identifier
 * - platform/os/clientVersion: optional metadata
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { key, skillId, platform, os, clientVersion } = body as {
    key?: unknown;
    skillId?: unknown;
    platform?: unknown;
    os?: unknown;
    clientVersion?: unknown;
  };

  // Resolve userId from API key if provided (anonymous installs are valid)
  let userId: string | null = null;
  if (key && typeof key === "string") {
    try {
      const result = await validateApiKey(key);
      userId = result?.userId ?? null;
    } catch {
      // Invalid key is not an error — treat as anonymous
      userId = null;
    }
  }

  const resolvedSkillId = skillId && typeof skillId === "string" ? skillId : null;

  try {
    if (!db) {
      console.warn("Database not configured, skipping install-callback recording");
      return NextResponse.json({ ok: true });
    }

    await db.insert(usageEvents).values({
      tenantId: DEFAULT_TENANT_ID,
      toolName: "install_confirmed",
      skillId: resolvedSkillId,
      userId,
      metadata: {
        platform: typeof platform === "string" ? platform : undefined,
        os: typeof os === "string" ? os : undefined,
        clientVersion: typeof clientVersion === "string" ? clientVersion : undefined,
        source: "install-script",
      },
    });

    // Increment skill usage counter if skillId provided
    if (resolvedSkillId) {
      await incrementSkillUses(resolvedSkillId);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to record install event:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

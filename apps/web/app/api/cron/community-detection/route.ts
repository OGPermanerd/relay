import { NextRequest, NextResponse } from "next/server";
import { detectCommunities } from "@everyskill/db";
import { generateAndPersistCommunityLabels } from "@/lib/community-label-generator";

const DEFAULT_TENANT_ID = "default-tenant-000-0000-000000000000";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json({ skipped: true, reason: "CRON_SECRET not configured" });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = request.nextUrl.searchParams.get("tenantId") ?? DEFAULT_TENANT_ID;

  try {
    const result = await detectCommunities(tenantId);

    console.log(
      `[COMMUNITY DETECTION] ${result.communities} communities detected, modularity=${result.modularity.toFixed(3)}, skills=${result.skills}, edges=${result.edges}${result.skipped ? ` (skipped: ${result.skipped})` : ""}`
    );

    // Generate AI labels for detected communities
    let labelsGenerated = 0;
    if (!result.skipped && result.communities > 0) {
      labelsGenerated = await generateAndPersistCommunityLabels(tenantId);
      console.log(`[COMMUNITY DETECTION] Generated labels for ${labelsGenerated} communities`);
    }

    return NextResponse.json({ ...result, labelsGenerated });
  } catch (err) {
    console.error("[COMMUNITY DETECTION] Failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

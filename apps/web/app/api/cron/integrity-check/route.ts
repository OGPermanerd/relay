import { NextRequest, NextResponse } from "next/server";
import { runIntegrityCheck } from "@everyskill/db/services/integrity-check";
import { writeAuditLog } from "@everyskill/db";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json({ skipped: true, reason: "CRON_SECRET not configured" });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const autoRepair = request.nextUrl.searchParams.get("repair") === "true";

  try {
    const report = await runIntegrityCheck({ autoRepair });

    await writeAuditLog({
      action: "integrity_check.run",
      resourceType: "system",
      metadata: {
        checks: report.checks,
        issueCount: report.issues.length,
        repaired: report.repaired,
        duration: report.duration,
        autoRepair,
      },
    });

    console.log(
      `[INTEGRITY CHECK] ${report.issues.length} issues found, ${report.repaired} repaired in ${report.duration}ms`
    );

    return NextResponse.json(report);
  } catch (err) {
    console.error("[INTEGRITY CHECK] Failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

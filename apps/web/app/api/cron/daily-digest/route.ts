import { NextRequest, NextResponse } from "next/server";
import { db } from "@everyskill/db";
import { skills, notificationPreferences, users } from "@everyskill/db/schema";
import { createNotification } from "@everyskill/db";
import { sendEmail } from "@/lib/email";
import { render } from "@react-email/render";
import TrendingDigestEmail from "@/emails/trending-digest";
import { eq, desc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  // If CRON_SECRET not configured, skip gracefully
  if (!cronSecret) {
    return NextResponse.json({ skipped: true, reason: "CRON_SECRET not configured" });
  }

  // Verify authorization
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!db) {
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  }

  try {
    // Get top 10 trending skills by total uses
    const trendingSkills = await db
      .select({
        name: skills.name,
        slug: skills.slug,
        totalUses: skills.totalUses,
      })
      .from(skills)
      .orderBy(desc(skills.totalUses))
      .limit(10);

    if (trendingSkills.length === 0) {
      console.log("[DAILY DIGEST] No skills found, skipping");
      return NextResponse.json({ sent: 0, reason: "No skills found" });
    }

    // Find users with daily trending digest preference
    const dailyUsers = await db
      .select({
        userId: notificationPreferences.userId,
        tenantId: notificationPreferences.tenantId,
        userName: users.name,
        userEmail: users.email,
      })
      .from(notificationPreferences)
      .innerJoin(users, eq(notificationPreferences.userId, users.id))
      .where(eq(notificationPreferences.trendingDigest, "daily"));

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://everyskill.ai";
    let sent = 0;
    const errors: string[] = [];

    for (const user of dailyUsers) {
      try {
        // Create in-app notification
        await createNotification({
          tenantId: user.tenantId,
          userId: user.userId,
          type: "trending_digest",
          title: "Daily Trending Skills",
          message: `Top ${trendingSkills.length} trending skills for today`,
          actionUrl: "/skills",
          metadata: { skills: trendingSkills.map((s) => s.name), period: "daily" },
        });

        // Render and send email
        const html = await render(
          TrendingDigestEmail({
            recipientName: user.userName || "there",
            skills: trendingSkills.map((s) => ({
              name: s.name,
              uses: s.totalUses,
              slug: s.slug,
            })),
            period: "daily",
            baseUrl,
          })
        );

        await sendEmail({
          to: user.userEmail,
          subject: "Daily Trending Skills",
          html,
        });

        sent++;
      } catch (err) {
        errors.push(
          `Failed for user ${user.userId}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    console.log(
      `[DAILY DIGEST] Sent ${sent}/${dailyUsers.length} digests. Errors: ${errors.length}`
    );

    return NextResponse.json({
      sent,
      total: dailyUsers.length,
      errors: errors.length,
      skillCount: trendingSkills.length,
    });
  } catch (err) {
    console.error("[DAILY DIGEST] Failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

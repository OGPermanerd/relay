"use server";

import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { createNotification, getOrCreatePreferences, getUsersInTenant } from "@everyskill/db";
import { sendEmail } from "@/lib/email";
import { render } from "@react-email/render";
import PlatformUpdateEmail from "@/emails/platform-update";

export type SendPlatformUpdateState = {
  success?: boolean;
  sent?: number;
  error?: string;
};

/**
 * Send a platform update notification to all users in the tenant.
 * Creates in-app notification if platformUpdatesInApp is enabled.
 * Sends email if platformUpdatesEmail is enabled.
 * Admin-only action.
 */
export async function sendPlatformUpdate(
  _prevState: SendPlatformUpdateState,
  formData: FormData
): Promise<SendPlatformUpdateState> {
  const session = await auth();
  if (!session?.user?.id || !isAdmin(session)) {
    return { error: "Unauthorized" };
  }

  const tenantId = session.user.tenantId;
  if (!tenantId) {
    return { error: "No tenant context" };
  }

  const title = (formData.get("title") as string)?.trim();
  const description = (formData.get("description") as string)?.trim();
  const version = (formData.get("version") as string)?.trim() || undefined;

  if (!title || !description) {
    return { error: "Title and description are required" };
  }

  try {
    const tenantUsers = await getUsersInTenant(tenantId);

    if (tenantUsers.length === 0) {
      return { success: true, sent: 0 };
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://everyskill.ai";
    let sent = 0;
    const errors: string[] = [];

    for (const user of tenantUsers) {
      try {
        // Get or create preferences for this user
        const prefs = await getOrCreatePreferences(user.id, tenantId);

        // Create in-app notification if enabled (default true)
        if (!prefs || prefs.platformUpdatesInApp) {
          await createNotification({
            tenantId,
            userId: user.id,
            type: "platform_update",
            title,
            message: description,
            metadata: version ? { version } : undefined,
          });
        }

        // Send email if enabled (default true)
        if (!prefs || prefs.platformUpdatesEmail) {
          const html = await render(
            PlatformUpdateEmail({
              recipientName: user.name || "there",
              title,
              description,
              version,
              actionUrl: baseUrl,
            })
          );

          await sendEmail({
            to: user.email,
            subject: version
              ? `Platform Update v${version}: ${title}`
              : `Platform Update: ${title}`,
            html,
          });
        }

        sent++;
      } catch (err) {
        errors.push(
          `Failed for user ${user.id}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    if (errors.length > 0) {
      console.error(
        `[PLATFORM UPDATE] ${errors.length} errors sending to ${tenantUsers.length} users:`,
        errors
      );
    }

    return { success: true, sent };
  } catch (err) {
    console.error("[PLATFORM UPDATE] Failed:", err);
    return { error: "Failed to send platform update" };
  }
}

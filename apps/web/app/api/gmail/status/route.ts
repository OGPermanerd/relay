import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasActiveGmailConnection, getSiteSettings } from "@everyskill/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || !session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if the feature is enabled for this tenant
  const settings = await getSiteSettings(session.user.tenantId);
  if (!settings?.gmailDiagnosticEnabled) {
    return NextResponse.json({ enabled: false, connected: false });
  }

  // Check if the user has an active Gmail connection
  const connected = await hasActiveGmailConnection(session.user.id);

  return NextResponse.json({ enabled: true, connected });
}

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createGmailOAuth2Client } from "@/lib/gmail-oauth";
import { getSiteSettings } from "@everyskill/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || !session?.user?.tenantId) {
    return NextResponse.redirect(new URL("/login", process.env.NEXTAUTH_URL!));
  }

  // Check admin toggle -- feature must be enabled for this tenant
  const settings = await getSiteSettings(session.user.tenantId);
  if (!settings?.gmailDiagnosticEnabled) {
    return NextResponse.redirect(
      new URL("/settings/connections?error=feature_disabled", process.env.NEXTAUTH_URL!)
    );
  }

  // Generate state token with CSRF protection
  const state = Buffer.from(
    JSON.stringify({
      userId: session.user.id,
      csrf: crypto.randomUUID(),
    })
  ).toString("base64url");

  // Create OAuth client and generate authorization URL
  const oauth2Client = createGmailOAuth2Client();
  const authorizeUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/gmail.readonly"],
    state,
    login_hint: session.user.email ?? undefined,
    include_granted_scopes: false,
  });

  // Set state cookie for CSRF verification in callback
  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set("gmail_oauth_state", state, {
    httpOnly: true,
    maxAge: 600, // 10 minutes
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  return response;
}

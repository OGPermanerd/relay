import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createGmailOAuth2Client } from "@/lib/gmail-oauth";
import { upsertGmailTokens } from "@everyskill/db";

const BASE_REDIRECT = "/settings/connections";

function redirectWithError(error: string): NextResponse {
  return NextResponse.redirect(
    new URL(`${BASE_REDIRECT}?error=${encodeURIComponent(error)}`, process.env.NEXTAUTH_URL!)
  );
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !session?.user?.tenantId) {
    return NextResponse.redirect(new URL("/login", process.env.NEXTAUTH_URL!));
  }

  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const scope = searchParams.get("scope");

  // Verify state matches the cookie (CSRF protection)
  const storedState = request.cookies.get("gmail_oauth_state")?.value;
  if (!state || state !== storedState) {
    return redirectWithError("invalid_state");
  }

  // Check if Google returned an error or no code
  if (error || !code) {
    return redirectWithError(error || "no_code");
  }

  // Verify the granted scope includes gmail.readonly
  if (!scope || !scope.includes("gmail.readonly")) {
    return redirectWithError("gmail_scope_denied");
  }

  // Exchange authorization code for tokens
  try {
    const oauth2Client = createGmailOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    // Store encrypted tokens in the database
    await upsertGmailTokens({
      userId: session.user.id,
      tenantId: session.user.tenantId,
      accessToken: tokens.access_token!,
      refreshToken: tokens.refresh_token!,
      expiresAt: new Date(tokens.expiry_date!),
      scope: tokens.scope!,
    });

    // Clear the state cookie
    const response = NextResponse.redirect(
      new URL(`${BASE_REDIRECT}?connected=true`, process.env.NEXTAUTH_URL!)
    );
    response.cookies.delete("gmail_oauth_state");
    return response;
  } catch (err) {
    console.error("Gmail OAuth token exchange failed:", err);
    return redirectWithError("token_exchange_failed");
  }
}

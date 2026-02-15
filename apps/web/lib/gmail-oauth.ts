import { OAuth2Client } from "google-auth-library";

/**
 * Get the Gmail OAuth callback redirect URI.
 * Uses NEXTAUTH_URL as the base URL.
 */
export function getGmailRedirectUri(): string {
  const baseUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL;
  if (!baseUrl) {
    throw new Error("AUTH_URL or NEXTAUTH_URL environment variable is not set");
  }
  return `${baseUrl}/api/gmail/callback`;
}

/**
 * Create a Google OAuth2 client configured for Gmail operations.
 * Uses the same Google OAuth credentials as Auth.js sign-in.
 */
export function createGmailOAuth2Client(): OAuth2Client {
  const clientId = process.env.AUTH_GOOGLE_ID;
  const clientSecret = process.env.AUTH_GOOGLE_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET must be set");
  }

  return new OAuth2Client(clientId, clientSecret, getGmailRedirectUri());
}

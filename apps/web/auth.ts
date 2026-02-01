import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db, isDatabaseConfigured } from "@relay/db";
import { users, accounts, sessions, verificationTokens } from "@relay/db/schema";
import authConfig from "./auth.config";

const ALLOWED_DOMAIN = process.env.AUTH_ALLOWED_DOMAIN || "company.com";

/**
 * Create Auth.js configuration
 * Database is required for adapter - will throw if DATABASE_URL is not set
 */
function createAuthConfig(): NextAuthConfig {
  if (!db) {
    throw new Error("Database not configured. Set DATABASE_URL environment variable.");
  }

  return {
    ...authConfig,
    trustHost: true,
    adapter: DrizzleAdapter(db, {
      usersTable: users,
      accountsTable: accounts,
      sessionsTable: sessions,
      verificationTokensTable: verificationTokens,
    }),
    session: { strategy: "jwt" }, // Required for Edge middleware
    callbacks: {
      ...authConfig.callbacks,
      async signIn({ account, profile }) {
        // Security validation - cannot be bypassed
        if (account?.provider === "google") {
          const isVerified = profile?.email_verified === true;
          const isAllowedDomain = profile?.email?.endsWith(`@${ALLOWED_DOMAIN}`);
          return isVerified && !!isAllowedDomain;
        }
        return false; // Reject non-Google providers
      },
      async jwt({ token, user }) {
        // Add user id to token on first sign in
        if (user) {
          token.id = user.id;
        }
        return token;
      },
      async session({ session, token }) {
        // Add user id to session
        if (session.user && token.id) {
          session.user.id = token.id as string;
        }
        return session;
      },
    },
  };
}

// Initialize auth with configuration
// Note: This will throw at runtime if DATABASE_URL is not set
const authResult = isDatabaseConfigured() ? NextAuth(createAuthConfig()) : null;

// Export auth functions (will throw if used without database)
export const handlers = authResult?.handlers ?? {
  GET: () => {
    throw new Error("Database not configured. Set DATABASE_URL environment variable.");
  },
  POST: () => {
    throw new Error("Database not configured. Set DATABASE_URL environment variable.");
  },
};
export const auth = authResult?.auth ?? (() => Promise.resolve(null));
export const signIn =
  authResult?.signIn ??
  (() => {
    throw new Error("Database not configured. Set DATABASE_URL environment variable.");
  });
export const signOut =
  authResult?.signOut ??
  (() => {
    throw new Error("Database not configured. Set DATABASE_URL environment variable.");
  });

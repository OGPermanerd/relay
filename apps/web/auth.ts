import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import { db, isDatabaseConfigured } from "@everyskill/db";
import { users, accounts, sessions, verificationTokens } from "@everyskill/db/schema";
import { getTenantByDomain } from "@everyskill/db/services/tenant";
import { isFirstUserInTenant, getUserRole, setUserRole } from "@everyskill/db";
import authConfig from "./auth.config";

const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "everyskill.ai";

/**
 * Create Auth.js configuration
 * Database is required for adapter - will throw if DATABASE_URL is not set
 *
 * Phase 26: Multi-tenant auth — signIn validates email domain against tenants
 * table, jwt injects tenantId, session exposes it, redirect allows subdomains.
 */
function createAuthConfig(): NextAuthConfig {
  if (!db) {
    throw new Error("Database not configured. Set DATABASE_URL environment variable.");
  }

  return {
    ...authConfig,
    adapter: DrizzleAdapter(db, {
      usersTable: users,
      accountsTable: accounts,
      sessionsTable: sessions,
      verificationTokensTable: verificationTokens,
    }),
    callbacks: {
      ...authConfig.callbacks,
      async signIn({ account, profile }) {
        if (account?.provider !== "google") return false;
        if (!profile?.email_verified) return false;

        const emailDomain = profile.email?.split("@")[1];
        if (!emailDomain) return false;

        // Look up tenant by email domain
        const tenant = await getTenantByDomain(emailDomain);
        if (!tenant) return false; // No tenant for this email domain

        return true;
      },
      async jwt({ token, user, account, profile }) {
        if (user) {
          token.id = user.id;
        }

        // On initial sign-in (account present), resolve and inject tenantId + role
        if (account && profile?.email) {
          const emailDomain = profile.email.split("@")[1];
          const tenant = await getTenantByDomain(emailDomain);
          if (tenant) {
            token.tenantId = tenant.id;

            // Update user's tenantId in DB if it doesn't match
            // (handles first sign-in where DrizzleAdapter used default tenant)
            if (user?.id) {
              try {
                await db!.update(users).set({ tenantId: tenant.id }).where(eq(users.id, user.id));

                // First-user-admin: if this is the first user in the tenant, promote to admin
                const isFirst = await isFirstUserInTenant(tenant.id);
                const role = isFirst ? ("admin" as const) : ("member" as const);
                await setUserRole(user.id, role);
                token.role = role;
              } catch (e) {
                console.error("Failed to update user tenantId/role:", e);
              }
            }
          }
        }

        // Lazy-migrate existing sessions: if tenantId not in JWT, read from DB
        if (!token.tenantId && token.id) {
          try {
            const [dbUser] = await db!
              .select({ tenantId: users.tenantId })
              .from(users)
              .where(eq(users.id, token.id as string))
              .limit(1);
            if (dbUser?.tenantId) {
              token.tenantId = dbUser.tenantId;
            }
          } catch {
            // Non-fatal — next request will retry
          }
        }

        // Lazy-load role for existing sessions that don't have it yet
        if (!token.role && token.id) {
          try {
            const role = await getUserRole(token.id as string);
            if (role) {
              token.role = role;
            }
          } catch {
            // Non-fatal — next request will retry
          }
        }

        return token;
      },
      async session({ session, token }) {
        if (session.user && token.id) {
          session.user.id = token.id as string;
        }
        if (token.tenantId) {
          session.user.tenantId = token.tenantId as string;
        }
        if (token.role) {
          session.user.role = token.role as "admin" | "member";
        }
        return session;
      },
      async redirect({ url, baseUrl }) {
        // Allow redirects to any subdomain of the root domain
        try {
          const urlObj = new URL(url);
          if (urlObj.hostname.endsWith(rootDomain)) {
            return url;
          }
        } catch {
          // Invalid URL — fall through to default handling
        }
        // Allow relative URLs
        if (url.startsWith("/")) return `${baseUrl}${url}`;
        return baseUrl;
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

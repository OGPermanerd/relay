import Google from "next-auth/providers/google";
import type { NextAuthConfig } from "next-auth";

/**
 * Edge-compatible auth configuration
 * Used by middleware - no database imports allowed
 *
 * Changes in Phase 26:
 * - Removed Google hd restriction (multi-tenant = multiple email domains)
 * - Added JWT session strategy with 8h maxAge (SOC2-04 compliance)
 * - Added domain-scoped cookies for cross-subdomain session sharing
 * - Added trustHost for header-based host derivation
 */

const isSecure = process.env.NODE_ENV === "production";
const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "everyskill.ai";

export default {
  trustHost: true,
  providers: [
    Google({
      // No hd restriction -- multi-tenant supports any email domain.
      // Domain-based tenant matching happens in the signIn callback (auth.ts).
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 hours = 28800 seconds (SOC2-04)
  },
  pages: {
    signIn: "/login",
    error: "/login", // Redirect auth errors to login page
  },
  cookies: {
    sessionToken: {
      name: isSecure ? "__Secure-authjs.session-token" : "authjs.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        domain: isSecure ? `.${rootDomain}` : undefined,
        secure: isSecure,
      },
    },
    callbackUrl: {
      name: isSecure ? "__Secure-authjs.callback-url" : "authjs.callback-url",
      options: {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        domain: isSecure ? `.${rootDomain}` : undefined,
        secure: isSecure,
      },
    },
    csrfToken: {
      // No __Secure- prefix: CSRF tokens must be readable by client JS
      name: "authjs.csrf-token",
      options: {
        httpOnly: false,
        sameSite: "lax" as const,
        path: "/",
        domain: isSecure ? `.${rootDomain}` : undefined,
        secure: isSecure,
      },
    },
  },
  callbacks: {
    authorized: async ({ auth }) => {
      // Used by middleware to check authentication
      return !!auth;
    },
  },
} satisfies NextAuthConfig;

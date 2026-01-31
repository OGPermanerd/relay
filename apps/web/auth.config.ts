import Google from "next-auth/providers/google";
import type { NextAuthConfig } from "next-auth";

/**
 * Edge-compatible auth configuration
 * Used by middleware - no database imports allowed
 */
export default {
  providers: [
    Google({
      authorization: {
        params: {
          // Restrict Google picker to company domain (UX only, not security)
          hd: process.env.AUTH_ALLOWED_DOMAIN || "company.com",
        },
      },
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login", // Redirect auth errors to login page
  },
  callbacks: {
    authorized: async ({ auth }) => {
      // Used by middleware to check authentication
      return !!auth;
    },
  },
} satisfies NextAuthConfig;

/**
 * Playwright Authentication Setup
 *
 * Seeds a test user and creates a valid JWT session for authenticated E2E tests.
 * Runs before other tests via the "setup" project in playwright.config.ts.
 */
import { test as setup } from "@playwright/test";
import { encode } from "next-auth/jwt";
import { db, users } from "@everyskill/db";

// TODO: Replace with dynamic tenant resolution when multi-tenant routing is implemented
const DEFAULT_TENANT_ID = "default-tenant-000-0000-000000000000";

// Test user constants
const TEST_USER = {
  id: "e2e-test-user",
  email: "e2e-test@company.com", // Must match AUTH_ALLOWED_DOMAIN
  name: "E2E Test User",
};

// Storage state file path
const AUTH_FILE = "playwright/.auth/user.json";

setup("authenticate", async ({ page }) => {
  // Get required environment variables
  const authSecret = process.env.AUTH_SECRET;

  if (!authSecret) {
    throw new Error("AUTH_SECRET environment variable is required for E2E tests");
  }

  if (!db) {
    throw new Error("DATABASE_URL environment variable is required for E2E tests");
  }

  // 1. Seed test user in database
  await db
    .insert(users)
    .values({
      tenantId: DEFAULT_TENANT_ID,
      id: TEST_USER.id,
      email: TEST_USER.email,
      name: TEST_USER.name,
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        email: TEST_USER.email,
        name: TEST_USER.name,
        updatedAt: new Date(),
      },
    });

  console.log(`[auth.setup] Seeded test user: ${TEST_USER.email}`);

  // 2. Create a valid JWT session token
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + 24 * 60 * 60; // 24 hours from now

  const token = await encode({
    token: {
      id: TEST_USER.id,
      email: TEST_USER.email,
      name: TEST_USER.name,
      sub: TEST_USER.id,
      iat: now,
      exp: expiresAt,
    },
    secret: authSecret,
    salt: "authjs.session-token",
  });

  console.log(`[auth.setup] Created JWT session token`);

  // 3. Store session cookie in Playwright storageState
  // NextAuth v5 uses "authjs.session-token" for the cookie name in development
  await page.context().addCookies([
    {
      name: "authjs.session-token",
      value: token,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      secure: false, // false for localhost
      sameSite: "Lax",
    },
  ]);

  // 4. Save the storage state to file for reuse by other tests
  await page.context().storageState({ path: AUTH_FILE });

  console.log(`[auth.setup] Saved storageState to ${AUTH_FILE}`);
});

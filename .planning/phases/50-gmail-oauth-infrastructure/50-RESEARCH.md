# Phase 50: Gmail OAuth Infrastructure - Research

**Researched:** 2026-02-14
**Domain:** Google OAuth2 for Gmail API access, AES-256-GCM token encryption, token lifecycle management
**Confidence:** HIGH

## Summary

Phase 50 builds a standalone Gmail OAuth flow that is entirely separate from the existing Auth.js login. This separation is the single most important architectural decision: Auth.js v5 does NOT support incremental OAuth scopes, and bundling `gmail.readonly` into the login provider would force ALL users through re-consent on every login, breaking existing sessions and requiring users to grant Gmail access just to use the skill marketplace.

The implementation requires: (1) two custom API routes (`/api/gmail/connect` and `/api/gmail/callback`) that handle Google OAuth2 directly using `google-auth-library`, (2) a `gmail_tokens` table with AES-256-GCM encryption for tokens at rest, (3) a token refresh service with in-memory mutex to prevent race conditions, (4) a `gmailDiagnosticEnabled` boolean on the existing `site_settings` table for admin control, and (5) a settings sub-page at `/settings/connections` showing connect/disconnect UI.

The project already has extensive v4.0 milestone research (in `.planning/research/gmail-diagnostic/`) that validates the key decisions: separate OAuth flow, `gmail.readonly` scope (NOT `gmail.metadata` -- because `gmail.metadata` cannot use the `q` date-filter parameter on `messages.list`), encrypted dedicated token table, and internal OAuth consent screen type. This phase-specific research focuses on the concrete implementation patterns, library APIs, and code structure needed to plan tasks.

**Primary recommendation:** Use `google-auth-library` directly (not `@googleapis/gmail` which is for later phases) with two API routes for the OAuth flow, Node.js `crypto` for AES-256-GCM encryption, and database-level mutex via `refreshing_at` timestamp column for race-safe token refresh.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `google-auth-library` | ^10.5.0 | OAuth2Client for token exchange, refresh, and revocation | Google's official auth library for Node.js. Handles OAuth2 token exchange, auto-refresh with `tokens` event, revocation endpoint. Already a transitive dep of `@googleapis/gmail` (Phase 51) |
| Node.js `crypto` (built-in) | N/A | AES-256-GCM encryption/decryption for token storage | Zero dependencies. Built into Node.js. Standard for symmetric encryption at rest |
| `drizzle-orm` | ^0.42.0 (existing) | Schema definition and queries for `gmail_tokens` table | Already the project's ORM. New table follows established patterns |
| `next-auth` | 5.0.0-beta.30 (existing) | Existing login auth -- NOT used for Gmail OAuth | Gmail flow is separate. Auth.js provides session context (userId, tenantId) only |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` | ^3.25.0 (existing) | Validate OAuth callback parameters and encrypted token format | Input validation on callback route, schema for token service |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `google-auth-library` (direct) | `@googleapis/gmail` (includes auth) | Phase 51 will need `@googleapis/gmail` for API calls. Phase 50 only needs auth. Installing the full Gmail API client now adds unnecessary weight. Install `google-auth-library` directly now; Phase 51 adds `@googleapis/gmail` which shares the dep |
| Node.js `crypto` | `@noble/ciphers` or `aes-256-gcm` npm | No benefit. Node.js crypto is battle-tested, zero-dependency, and sufficient for server-side encryption |
| Database mutex (`refreshing_at` column) | Redis distributed lock | Overkill. Single Node.js instance. No Redis in the stack. Database UPDATE with WHERE clause provides sufficient atomicity |

**Installation:**
```bash
pnpm --filter web add google-auth-library
```

**Environment variables to add:**
```bash
GMAIL_ENCRYPTION_KEY=  # 32-byte hex string (64 chars) for AES-256-GCM
```

## Architecture Patterns

### Recommended Project Structure
```
packages/db/src/
  schema/
    gmail-tokens.ts          # gmail_tokens table definition
  services/
    gmail-tokens.ts          # CRUD + encryption/decryption service
  migrations/
    0028_add_gmail_tokens.sql # Migration for new table
  lib/
    crypto.ts                # AES-256-GCM encrypt/decrypt utilities

apps/web/
  app/
    api/
      gmail/
        connect/route.ts     # GET: Initiate OAuth flow (redirect to Google)
        callback/route.ts    # GET: Handle OAuth callback (exchange code, store tokens)
        disconnect/route.ts  # POST: Revoke tokens + delete from DB
        status/route.ts      # GET: Check if user has active Gmail connection
    (protected)/
      settings/
        connections/
          page.tsx           # Gmail connection UI (settings sub-page)
          gmail-connection-card.tsx  # Connect/disconnect card component
        settings-nav.tsx     # Updated with "Connections" tab
    actions/
      gmail-connection.ts    # Server action for disconnect (form action)
  lib/
    gmail-oauth.ts           # OAuth2Client factory, URL generation
```

### Pattern 1: Separate OAuth Flow (Custom API Routes)
**What:** Two API routes that handle Google OAuth2 independently from Auth.js. The connect route redirects to Google with Gmail-specific scopes. The callback route exchanges the authorization code for tokens and stores them encrypted.
**When to use:** Any time you need OAuth scopes beyond what Auth.js manages (Gmail, Drive, Calendar).
**Example:**
```typescript
// apps/web/app/api/gmail/connect/route.ts
// Source: Google OAuth2 Web Server Flow docs
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { OAuth2Client } from "google-auth-library";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const oauth2Client = new OAuth2Client(
    process.env.AUTH_GOOGLE_ID,
    process.env.AUTH_GOOGLE_SECRET,
    `${process.env.NEXTAUTH_URL}/api/gmail/callback`
  );

  // Generate state parameter with userId for CSRF protection
  const state = Buffer.from(JSON.stringify({
    userId: session.user.id,
    csrf: crypto.randomUUID(),
  })).toString("base64url");

  // Store state in httpOnly cookie for verification in callback
  const authorizeUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",     // Required for refresh_token
    prompt: "consent",          // Force consent to always get refresh_token
    scope: ["https://www.googleapis.com/auth/gmail.readonly"],
    state,
    login_hint: session.user.email ?? undefined,
    include_granted_scopes: false, // Separate from login scopes
  });

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set("gmail_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  });
  return response;
}
```

```typescript
// apps/web/app/api/gmail/callback/route.ts
// Source: Google OAuth2 Web Server Flow docs
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { OAuth2Client } from "google-auth-library";
import { upsertGmailTokens } from "@everyskill/db/services/gmail-tokens";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !session?.user?.tenantId) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // Verify state matches cookie
  const storedState = request.cookies.get("gmail_oauth_state")?.value;
  if (!state || state !== storedState) {
    return NextResponse.redirect(new URL("/settings/connections?error=invalid_state", request.url));
  }

  if (error || !code) {
    return NextResponse.redirect(
      new URL(`/settings/connections?error=${error || "no_code"}`, request.url)
    );
  }

  // Check granted scopes -- user may have unchecked Gmail via granular consent
  const scope = searchParams.get("scope") ?? "";
  if (!scope.includes("gmail.readonly")) {
    return NextResponse.redirect(
      new URL("/settings/connections?error=gmail_scope_denied", request.url)
    );
  }

  const oauth2Client = new OAuth2Client(
    process.env.AUTH_GOOGLE_ID,
    process.env.AUTH_GOOGLE_SECRET,
    `${process.env.NEXTAUTH_URL}/api/gmail/callback`
  );

  const { tokens } = await oauth2Client.getToken(code);

  // Store encrypted tokens
  await upsertGmailTokens({
    userId: session.user.id,
    tenantId: session.user.tenantId,
    accessToken: tokens.access_token!,
    refreshToken: tokens.refresh_token!,
    expiresAt: new Date(tokens.expiry_date!),
    scope: tokens.scope!,
  });

  const response = NextResponse.redirect(
    new URL("/settings/connections?connected=true", request.url)
  );
  response.cookies.delete("gmail_oauth_state");
  return response;
}
```

### Pattern 2: AES-256-GCM Token Encryption
**What:** Encrypt tokens before database INSERT, decrypt after SELECT. Each encryption uses a unique random IV. Output format: `{iv_hex}:{auth_tag_hex}:{ciphertext_hex}`.
**When to use:** Any sensitive credential stored in the database (OAuth tokens, API secrets).
**Example:**
```typescript
// packages/db/src/lib/crypto.ts
// Source: Node.js crypto docs + verified AES-256-GCM gist pattern
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits -- standard for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits

function getEncryptionKey(): Buffer {
  const keyHex = process.env.GMAIL_ENCRYPTION_KEY;
  if (!keyHex || keyHex.length !== 64) {
    throw new Error("GMAIL_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)");
  }
  return Buffer.from(keyHex, "hex");
}

export function encryptToken(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:ciphertext (all hex)
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

export function decryptToken(encryptedStr: string): string {
  const key = getEncryptionKey();
  const [ivHex, authTagHex, ciphertext] = encryptedStr.split(":");

  if (!ivHex || !authTagHex || !ciphertext) {
    throw new Error("Invalid encrypted token format");
  }

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
```

### Pattern 3: Race-Condition-Safe Token Refresh
**What:** Use a `refreshing_at` timestamp column as a database-level mutex. Before refreshing, atomically claim the lock with an UPDATE...WHERE. If 0 rows affected, another process is refreshing -- poll for completion.
**When to use:** Any OAuth token refresh where concurrent requests may detect expiry simultaneously.
**Example:**
```typescript
// packages/db/src/services/gmail-tokens.ts (partial -- refresh logic)
import { OAuth2Client } from "google-auth-library";
import { eq, and, or, lt, isNull, sql } from "drizzle-orm";

const REFRESH_BUFFER_MS = 5 * 60 * 1000; // Refresh 5 min before expiry
const LOCK_TIMEOUT_MS = 30 * 1000; // Lock expires after 30s

export async function getValidGmailToken(userId: string): Promise<DecryptedGmailToken> {
  const token = await getGmailTokenDecrypted(userId);
  if (!token) throw new GmailNotConnectedError();

  // Check if token is still valid (with 5-min buffer)
  if (token.expiresAt.getTime() > Date.now() + REFRESH_BUFFER_MS) {
    return token; // Still valid
  }

  // Attempt to acquire refresh lock
  const lockResult = await db!
    .update(gmailTokens)
    .set({ refreshingAt: new Date() })
    .where(
      and(
        eq(gmailTokens.userId, userId),
        or(
          isNull(gmailTokens.refreshingAt),
          lt(gmailTokens.refreshingAt, new Date(Date.now() - LOCK_TIMEOUT_MS))
        )
      )
    )
    .returning();

  if (lockResult.length === 0) {
    // Another process is refreshing -- wait and retry
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return getValidGmailToken(userId); // Recursive retry (will get fresh token)
  }

  // We hold the lock -- perform refresh
  try {
    const oauth2Client = new OAuth2Client(
      process.env.AUTH_GOOGLE_ID,
      process.env.AUTH_GOOGLE_SECRET
    );
    oauth2Client.setCredentials({ refresh_token: token.refreshToken });

    const { credentials } = await oauth2Client.refreshAccessToken();

    await updateGmailTokens(userId, {
      accessToken: credentials.access_token!,
      refreshToken: credentials.refresh_token ?? token.refreshToken,
      expiresAt: new Date(credentials.expiry_date!),
      refreshingAt: null, // Release lock
    });

    return {
      ...token,
      accessToken: credentials.access_token!,
      refreshToken: credentials.refresh_token ?? token.refreshToken,
      expiresAt: new Date(credentials.expiry_date!),
    };
  } catch (err: unknown) {
    // Release lock on failure
    await db!.update(gmailTokens)
      .set({ refreshingAt: null })
      .where(eq(gmailTokens.userId, userId));

    // Handle revoked tokens
    if (err instanceof Error && err.message.includes("invalid_grant")) {
      await deleteGmailTokens(userId);
      throw new GmailTokenRevokedError();
    }
    throw err;
  }
}
```

### Pattern 4: Token Revocation on Disconnect
**What:** When a user disconnects Gmail, revoke the token with Google AND delete from the database. This ensures both sides are synchronized.
**When to use:** Any disconnect/revoke flow for third-party OAuth.
**Example:**
```typescript
// apps/web/app/api/gmail/disconnect/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getGmailTokenDecrypted, deleteGmailTokens } from "@everyskill/db/services/gmail-tokens";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = await getGmailTokenDecrypted(session.user.id);
  if (token) {
    // Revoke with Google (best-effort -- don't fail if Google is unreachable)
    try {
      await fetch(
        `https://oauth2.googleapis.com/revoke?token=${token.accessToken}`,
        { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" } }
      );
    } catch {
      // Non-fatal: tokens will expire naturally if revocation fails
    }

    // Delete from database (this is the authoritative action)
    await deleteGmailTokens(session.user.id);
  }

  return NextResponse.json({ disconnected: true });
}
```

### Anti-Patterns to Avoid
- **Bundling Gmail scope into Auth.js provider:** Forces ALL users through re-consent. Breaks existing sessions. Use separate OAuth flow.
- **Storing Gmail tokens in the Auth.js `accounts` table:** Couples Gmail lifecycle with login lifecycle. Revoking Gmail should not invalidate login. Use dedicated `gmail_tokens` table.
- **Storing tokens unencrypted:** Refresh tokens grant perpetual email access. A DB breach exposes all users' Gmail. Use AES-256-GCM.
- **Adding Gmail connection status to JWT:** Bloats JWT cookie (4KB limit). Adds DB query to every request. Check connection status only on pages that need it.
- **Refreshing tokens without a mutex:** Two concurrent requests both detect expired token, both refresh, one overwrites the other's new refresh token. Use database-level lock.
- **Using `gmail.metadata` scope:** Cannot use `q` parameter for date filtering on `messages.list`. Use `gmail.readonly` + `format: 'metadata'` instead.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OAuth2 token exchange | Manual HTTP to `oauth2.googleapis.com/token` | `google-auth-library` OAuth2Client `.getToken()` | Handles error codes, token format validation, retry logic |
| Token refresh | Manual HTTP POST with refresh_token | OAuth2Client `.refreshAccessToken()` | Handles edge cases: missing refresh_token in response, error parsing |
| AES-256-GCM IV generation | Fixed IV or counter-based IV | `crypto.randomBytes(12)` | GCM REQUIRES unique IV per encryption. Reused IV = broken encryption. Random is simplest correct approach |
| CSRF protection on OAuth | Custom token generation | Cookie-based state parameter with `crypto.randomUUID()` | Standard OAuth2 CSRF prevention. Cookie ensures same browser |

**Key insight:** The OAuth2 protocol has many edge cases (expired auth codes, revoked refresh tokens, partial scope grants from granular consent). `google-auth-library` handles these. The encryption is simple enough for Node.js `crypto` but the IV/authTag management must be exact.

## Common Pitfalls

### Pitfall 1: Auth.js Scope Escalation Breaks All Users' Login
**What goes wrong:** Adding `gmail.readonly` to the Google provider in `auth.config.ts` forces every user through re-consent, including users who do not want Gmail features. Users who decline are locked out entirely.
**Why it happens:** Auth.js v5 has one Google provider config. It seems like a one-line scope addition.
**How to avoid:** SEPARATE OAuth flow via custom API routes. Never modify `auth.config.ts` for Gmail.
**Warning signs:** If a PR modifies `auth.config.ts` to add Gmail scopes, reject it immediately.

### Pitfall 2: Granular Consent Allows Users to Uncheck Gmail
**What goes wrong:** Since Nov 2025, Google shows per-scope checkboxes. User completes OAuth flow but unchecks Gmail. Callback receives a code, but the granted scopes don't include `gmail.readonly`. App assumes connection succeeded.
**Why it happens:** OAuth callback only checks for `code` presence, not `scope` content.
**How to avoid:** Parse the `scope` parameter in the callback URL. Verify `gmail.readonly` is included. Show clear error if missing.
**Warning signs:** User shows as "connected" but all Gmail API calls fail with 403.

### Pitfall 3: Plaintext Tokens in Database
**What goes wrong:** Refresh tokens grant perpetual Gmail access. A database breach exposes every user's email.
**Why it happens:** Existing `accounts` table stores tokens in plaintext. Developers copy the pattern.
**How to avoid:** AES-256-GCM encryption. GMAIL_ENCRYPTION_KEY in env vars, never in DB.
**Warning signs:** Query `gmail_tokens` directly. If access_token looks like `ya29.a0AfH6SM...` it's plaintext.

### Pitfall 4: Race Condition on Token Refresh Invalidates Refresh Token
**What goes wrong:** Two concurrent requests detect expired access token. Both call Google's refresh endpoint. Google returns a new refresh token with each response. The second response overwrites the first's refresh token. The first's refresh token is now invalid. Next refresh attempt fails with `invalid_grant`.
**Why it happens:** Google sometimes rotates refresh tokens during refresh. Single-use refresh tokens mean the old one is invalidated.
**How to avoid:** Database-level mutex using `refreshing_at` timestamp. Only one process refreshes at a time.
**Warning signs:** Users intermittently get "Gmail disconnected" errors after initial connection works fine.

### Pitfall 5: Missing Redirect URI Configuration
**What goes wrong:** Gmail OAuth callback returns error because the redirect URI is not registered in Google Cloud Console.
**Why it happens:** The existing Google OAuth for login uses `/api/auth/callback/google` (managed by Auth.js). The new Gmail flow uses `/api/gmail/callback` which must be separately registered.
**How to avoid:** Add to Google Cloud Console > Credentials > OAuth 2.0 Client IDs > Authorized redirect URIs: `https://everyskill.ai/api/gmail/callback` and `http://localhost:2002/api/gmail/callback`.
**Warning signs:** OAuth redirect immediately fails with "redirect_uri_mismatch".

### Pitfall 6: Gmail API Not Enabled in Google Cloud Console
**What goes wrong:** OAuth flow succeeds (tokens are granted) but subsequent Gmail API calls in Phase 51 fail with "Gmail API has not been used in project X before or it is disabled."
**Why it happens:** OAuth scopes and API enablement are separate configurations in Google Cloud Console.
**How to avoid:** Pre-implementation checklist: enable Gmail API in APIs & Services > Library.
**Warning signs:** Tokens stored successfully but Phase 51 API calls fail.

## Code Examples

### gmail_tokens Table Schema
```typescript
// packages/db/src/schema/gmail-tokens.ts
// Follows established table patterns: tenantId FK, RLS policy, UUID primary key
import {
  pgTable,
  text,
  timestamp,
  index,
  pgPolicy,
  integer,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { tenants } from "./tenants";
import { users } from "./users";

export const gmailTokens = pgTable(
  "gmail_tokens",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" })
      .unique(), // One Gmail connection per user
    // Encrypted with AES-256-GCM. Format: iv_hex:authTag_hex:ciphertext_hex
    encryptedAccessToken: text("encrypted_access_token").notNull(),
    encryptedRefreshToken: text("encrypted_refresh_token").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    scope: text("scope").notNull(), // Granted scopes string
    keyVersion: integer("key_version").notNull().default(1), // For key rotation
    refreshingAt: timestamp("refreshing_at", { withTimezone: true }), // Mutex for refresh
    connectedAt: timestamp("connected_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("gmail_tokens_user_id_idx").on(table.userId),
    index("gmail_tokens_tenant_id_idx").on(table.tenantId),
    pgPolicy("tenant_isolation", {
      as: "restrictive",
      for: "all",
      using: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
    }),
  ]
);

export type GmailToken = typeof gmailTokens.$inferSelect;
export type NewGmailToken = typeof gmailTokens.$inferInsert;
```

### Admin Toggle: Add Column to site_settings
```sql
-- packages/db/src/migrations/0028_add_gmail_tokens.sql

-- 1. Create gmail_tokens table
CREATE TABLE IF NOT EXISTS gmail_tokens (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  encrypted_access_token TEXT NOT NULL,
  encrypted_refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  scope TEXT NOT NULL,
  key_version INTEGER NOT NULL DEFAULT 1,
  refreshing_at TIMESTAMPTZ,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT gmail_tokens_user_id_unique UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS gmail_tokens_user_id_idx ON gmail_tokens(user_id);
CREATE INDEX IF NOT EXISTS gmail_tokens_tenant_id_idx ON gmail_tokens(tenant_id);

-- Enable RLS
ALTER TABLE gmail_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON gmail_tokens
  AS RESTRICTIVE FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

-- 2. Add admin toggle to site_settings
ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS gmail_diagnostic_enabled BOOLEAN NOT NULL DEFAULT false;
```

### Middleware Exemption for Gmail OAuth Routes
```typescript
// In apps/web/middleware.ts -- add to exempt paths
if (
  pathname.startsWith("/api/auth") ||
  pathname.startsWith("/api/gmail") ||  // Gmail OAuth callback must be accessible
  // ... existing exemptions
) {
  return NextResponse.next();
}
```

**Important caveat:** The `/api/gmail/connect` route needs session access (to get userId), so it should NOT be fully exempt. Only `/api/gmail/callback` needs exemption because Google redirects the user's browser there. The connect route is navigated to by an authenticated user. The disconnect and status routes require authentication.

Revised approach: Only exempt `/api/gmail/callback`:
```typescript
if (
  pathname.startsWith("/api/auth") ||
  pathname === "/api/gmail/callback" ||  // Only callback needs exemption
  // ... existing exemptions
) {
  return NextResponse.next();
}
```

### Settings Nav Update
```typescript
// apps/web/app/(protected)/settings/settings-nav.tsx
const tabs = [
  { label: "Preferences", href: "/settings/preferences" },
  { label: "Connections", href: "/settings/connections" },  // NEW
  { label: "Notifications", href: "/settings/notifications" },
  { label: "Export", href: "/settings/export" },
];
```

### Connection Status Check Pattern
```typescript
// apps/web/app/api/gmail/status/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasActiveGmailConnection } from "@everyskill/db/services/gmail-tokens";
import { getSiteSettings } from "@everyskill/db/services/site-settings";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || !session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check admin toggle first
  const settings = await getSiteSettings(session.user.tenantId);
  if (!settings?.gmailDiagnosticEnabled) {
    return NextResponse.json({ enabled: false, connected: false });
  }

  const connected = await hasActiveGmailConnection(session.user.id);
  return NextResponse.json({ enabled: true, connected });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Bundle all scopes in Auth.js provider | Separate OAuth flow for extended scopes | Auth.js v5 (2024) never added incremental auth | Must build custom OAuth routes |
| Google shows single consent screen | Google granular consent with per-scope checkboxes | Nov 2025 | Must check `scope` in callback, handle partial grants |
| `gmail.metadata` for metadata-only access | `gmail.readonly` + `format: 'metadata'` | Always (scope limitation) | `gmail.metadata` cannot use `q` parameter. Use `gmail.readonly` with metadata format |
| Self-scan CASA assessment (Tier 2) | Paid third-party assessor only | 2025 | Internal app type bypasses entirely. Critical for avoiding assessment cost/delay |
| `google-auth-library` v9 | v10.5.0 | Late 2025 | Minor API surface changes, same OAuth2Client pattern |

**Deprecated/outdated:**
- `googleapis` monolithic package (200MB) -- use individual packages like `@googleapis/gmail` instead
- Auth.js `include_granted_scopes` approach -- does not work reliably for incremental authorization
- `gmail.metadata` scope for any use case requiring date filtering -- use `gmail.readonly` instead

## Open Questions

1. **Encryption key generation and storage**
   - What we know: AES-256 needs a 32-byte key stored as 64-char hex in `GMAIL_ENCRYPTION_KEY` env var
   - What's unclear: Whether to use a shared key across environments or per-environment keys
   - Recommendation: Generate unique key per environment with `openssl rand -hex 32`. Document in deployment checklist. Add to `.env.local`, `.env.staging`, `.env.production`

2. **Google Cloud Console redirect URI for production subdomains**
   - What we know: Multi-tenant uses subdomains (`acme.everyskill.ai`). OAuth callback must handle any subdomain.
   - What's unclear: Whether Google accepts wildcard redirect URIs
   - Recommendation: Google does NOT accept wildcards. Register the apex domain callback `https://everyskill.ai/api/gmail/callback` and ensure the connect route uses the apex domain for the redirect_uri, regardless of which subdomain the user is on. The callback redirects back to the user's subdomain after processing.

3. **Key rotation procedure**
   - What we know: `keyVersion` column enables rotation without re-encrypting all at once
   - What's unclear: Exact rotation procedure (decrypt old, re-encrypt new in batch? or lazy on next read?)
   - Recommendation: Lazy rotation on read. When decrypting, check `keyVersion`. If old, decrypt with old key, re-encrypt with new key, update row. Store old key in `GMAIL_ENCRYPTION_KEY_V1` during rotation period.

## Sources

### Primary (HIGH confidence)
- **Codebase audit (2026-02-14):**
  - `apps/web/auth.ts` -- Auth.js config, JWT callbacks, session handling, tenantId injection
  - `apps/web/auth.config.ts` -- Google provider setup, no explicit scopes, JWT strategy
  - `packages/db/src/schema/auth.ts` -- accounts table with plaintext token columns
  - `packages/db/src/schema/site-settings.ts` -- tenant-scoped settings table pattern
  - `packages/db/src/schema/users.ts` -- user table with tenantId FK and RLS policy
  - `packages/db/src/services/site-settings.ts` -- getSiteSettings/updateSiteSettings pattern
  - `packages/db/src/client.ts` -- DEFAULT_TENANT_ID, connection-level tenant context
  - `packages/db/src/relations/index.ts` -- existing relation patterns for new table
  - `apps/web/middleware.ts` -- exempt path patterns, cookie-based auth check
  - `apps/web/app/(protected)/settings/` -- existing settings layout, nav, sub-pages
  - `apps/web/app/actions/admin-settings.ts` -- admin action pattern with isAdmin check
- **v4.0 milestone research (`.planning/research/gmail-diagnostic/`):**
  - `PITFALLS.md` -- 16 pitfalls documented, especially Pitfall 1 (scope escalation), Pitfall 2 (plaintext tokens), Pitfall 3 (token expiry), Pitfall 11 (gmail.metadata limitation)
  - `STACK.md` -- Full stack analysis confirming `google-auth-library`, encryption approach, scope selection
  - `ARCHITECTURE.md` -- Component boundaries, data flow, token refresh with persistence pattern
- [Google OAuth2 Web Server Flow](https://developers.google.com/identity/protocols/oauth2/web-server) -- Authorization URL parameters, token exchange, refresh, revocation endpoints
- [Gmail API Scopes](https://developers.google.com/workspace/gmail/api/auth/scopes) -- `gmail.readonly` (restricted), `gmail.metadata` (restricted, no `q` parameter)
- [Google OAuth Revocation](https://developers.google.com/identity/protocols/oauth2/web-server#tokenrevoke) -- POST to `https://oauth2.googleapis.com/revoke`
- [Node.js crypto documentation](https://nodejs.org/api/crypto.html) -- `createCipheriv`, `createDecipheriv` for AES-256-GCM

### Secondary (MEDIUM confidence)
- [google-auth-library npm](https://www.npmjs.com/package/google-auth-library) -- v10.5.0 current. OAuth2Client, `generateAuthUrl`, `getToken`, `refreshAccessToken`, `tokens` event
- [Nango: Concurrency with OAuth Token Refreshes](https://nango.dev/blog/concurrency-with-oauth-token-refreshes) -- In-memory and distributed lock patterns for token refresh
- [AES-256-GCM Node.js Gist](https://gist.github.com/rjz/15baffeab434b8125ca4d783f4116d81) -- Reference implementation for encrypt/decrypt with IV and authTag
- [Google OAuth Consent Screen Configuration](https://developers.google.com/workspace/guides/configure-oauth-consent) -- Internal user type bypasses restricted scope verification

### Tertiary (LOW confidence)
- [Google CASA Security Assessment 2025](https://deepstrike.io/blog/google-casa-security-assessment-2025) -- Paid assessor required, $500-$4,500. Internal apps exempt. Policy could change.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- `google-auth-library` is Google's official library, Node.js `crypto` is built-in, patterns verified against official docs
- Architecture: HIGH -- Separate OAuth flow decision validated extensively in v4.0 research, confirmed Auth.js v5 limitation
- Schema design: HIGH -- Follows established project patterns (tenantId FK, RLS, UUID PK), encryption format is standard
- Token refresh: HIGH -- Mutex pattern verified against multiple sources, `google-auth-library` refresh API confirmed
- Pitfalls: HIGH -- All 6 pitfalls verified against official Google docs and codebase audit
- Admin toggle: HIGH -- Simple boolean column on existing table, follows established admin settings pattern
- Middleware exemption: HIGH -- Verified against existing middleware.ts exempt path patterns

**Research date:** 2026-02-14
**Valid until:** 2026-03-14 (stable domain -- Google OAuth2 and Node.js crypto APIs are well-established)

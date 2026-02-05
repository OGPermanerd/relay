# Phase 20: API Key Management - Research

**Researched:** 2026-02-05
**Domain:** API key generation, hashing, validation, and management with Drizzle ORM + Next.js Server Actions
**Confidence:** HIGH

## Summary

This phase adds personal API key management for employees, enabling identity-aware MCP usage. The implementation involves four interconnected areas: (1) a new `api_keys` database table with SHA-256 hash storage, (2) Server Actions for key generation and revocation, (3) a public validation endpoint for the MCP server to resolve keys to userIds, and (4) UI components on the profile page and an admin interface.

The standard approach is well-established: generate a cryptographically random key with an identifiable prefix (`rlk_`), hash it with SHA-256 before storage, show the raw key exactly once to the user, and validate incoming keys by hashing and looking up the hash. The project already uses Drizzle ORM for schema management, Next.js Server Actions for mutations, and Node.js built-in `crypto` for hashing. No new external dependencies are needed for this phase -- `crypto.createHash` and `crypto.randomBytes` are built into Node.js 22+.

Key rotation is handled by allowing multiple active keys per user with configurable expiry. When a user generates a new key, the old key gets an `expiresAt` timestamp set to `now + grace period`, allowing both keys to work during transition. There is no admin role system in the codebase yet; the simplest approach is an environment variable allowlist (`ADMIN_EMAILS`) checked against the session user's email.

**Primary recommendation:** Use Node.js built-in `crypto` for all key operations (randomBytes for generation, createHash for SHA-256 hashing), store only hashes in the database, and implement the validation endpoint as a Next.js Route Handler at `/api/auth/validate-key` that is excluded from the Auth.js middleware.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js `crypto` | built-in (Node 22+) | `randomBytes` for key generation, `createHash('sha256')` for hashing, `timingSafeEqual` for hash comparison | Built into Node.js runtime, no dependency needed, cryptographically secure |
| Drizzle ORM | ^0.38.0 (existing) | Schema definition for `api_keys` table, queries for CRUD operations | Already used project-wide for all database access |
| Next.js Server Actions | built-in (Next 16.1.6) | `generateApiKey`, `revokeApiKey`, `listApiKeys` mutations | Already the project pattern for authenticated mutations (see `apps/web/app/actions/`) |
| Next.js Route Handlers | built-in | `/api/auth/validate-key` endpoint for MCP server key validation | Project already uses route handlers at `app/api/auth/[...nextauth]/route.ts` |
| zod | ^3.25.0 (existing) | Input validation for server actions and route handler | Already used throughout the project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `crypto.timingSafeEqual` | built-in | Timing-safe hash comparison during validation | Every key validation request -- prevents timing attacks on hash comparison |
| `drizzle-kit` | ^0.31.8 (existing) | Generate SQL migration for the new `api_keys` table | One-time during schema creation: `pnpm db:generate` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `crypto.randomBytes` + hex | `nanoid` with base62 alphabet | nanoid provides unbiased base62 encoding but adds a dependency; hex encoding from randomBytes is simpler, longer but perfectly safe |
| SHA-256 | bcrypt | bcrypt is intentionally slow (good for passwords) but overkill for high-entropy API keys; SHA-256 is fast enough for per-request validation |
| Server Actions | tRPC mutations | tRPC would add a dependency; Server Actions are the existing project pattern |
| Environment variable admin check | Role column on users table | A role column is more robust long-term but the codebase has no admin concept yet; env var is simplest for now |

**Installation:**
```bash
# No new packages needed -- all tools are built-in or already installed
```

## Architecture Patterns

### Recommended Project Structure
```
packages/db/src/
  schema/
    api-keys.ts              # New table schema definition
  services/
    api-keys.ts              # Database service layer (CRUD, validation)

apps/web/
  app/
    actions/
      api-keys.ts            # Server Actions: generate, revoke, list
    api/
      auth/
        validate-key/
          route.ts            # Public POST endpoint for MCP key validation
    (protected)/
      profile/
        page.tsx              # Add "API Keys" section (employee self-service)
  lib/
    api-key-crypto.ts         # Key generation and hashing utilities
    admin.ts                  # Admin check utility (isAdmin helper)
```

### Pattern 1: Show-Once Key Generation
**What:** Generate key server-side, return plaintext exactly once, store only the hash
**When to use:** Every key generation flow (both employee self-service and admin generation)
**Example:**
```typescript
// Source: Node.js crypto docs + project pattern from apps/web/app/actions/skills.ts
import { randomBytes, createHash } from "crypto";

const KEY_PREFIX = "rlk_";
const KEY_BYTE_LENGTH = 32; // 256 bits of entropy

export function generateRawApiKey(): string {
  // Generate 32 random bytes, encode as hex (64 chars)
  const random = randomBytes(KEY_BYTE_LENGTH).toString("hex");
  return `${KEY_PREFIX}${random}`;
}

export function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

export function extractPrefix(rawKey: string): string {
  // Store first 12 chars for identification: "rlk_" + first 8 of random
  return rawKey.substring(0, 12);
}
```

### Pattern 2: Timing-Safe Hash Validation
**What:** Compare hashes using constant-time comparison to prevent timing attacks
**When to use:** Every key validation request in the `/api/auth/validate-key` endpoint
**Example:**
```typescript
// Source: Node.js crypto.timingSafeEqual docs
import { createHash, timingSafeEqual } from "crypto";

export function validateKeyHash(incomingKey: string, storedHash: string): boolean {
  const incomingHash = createHash("sha256").update(incomingKey).digest();
  const storedHashBuf = Buffer.from(storedHash, "hex");
  // Both are SHA-256 digests = 32 bytes, guaranteed equal length
  return timingSafeEqual(incomingHash, storedHashBuf);
}
```

### Pattern 3: Grace Period Key Rotation
**What:** When generating a new key, set expiresAt on old keys rather than revoking immediately
**When to use:** KEY-06 requirement -- employee generates new key while old remains valid
**Example:**
```typescript
// Grace period: both old and new keys work during transition
const GRACE_PERIOD_HOURS = 24; // Configurable

async function rotateKey(userId: string, newKeyName: string) {
  // 1. Set expiresAt on all active keys for this user
  const gracePeriodEnd = new Date(Date.now() + GRACE_PERIOD_HOURS * 60 * 60 * 1000);
  await db
    .update(apiKeys)
    .set({ expiresAt: gracePeriodEnd })
    .where(
      and(
        eq(apiKeys.userId, userId),
        isNull(apiKeys.revokedAt),
        isNull(apiKeys.expiresAt)
      )
    );

  // 2. Generate and store new key (no expiresAt = permanent until next rotation)
  const rawKey = generateRawApiKey();
  const keyHash = hashApiKey(rawKey);
  await db.insert(apiKeys).values({
    userId,
    keyHash,
    keyPrefix: extractPrefix(rawKey),
    name: newKeyName,
  });

  return rawKey; // Returned once, never stored
}
```

### Pattern 4: Validation Endpoint (Public Route)
**What:** POST endpoint that accepts a raw key, returns userId if valid
**When to use:** Called by MCP server (stdio) to resolve RELAY_API_KEY to a userId
**Example:**
```typescript
// apps/web/app/api/auth/validate-key/route.ts
// This route must be EXCLUDED from Auth.js middleware
import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@relay/db/services/api-keys";

export async function POST(req: NextRequest) {
  const { key } = await req.json();
  if (!key || typeof key !== "string") {
    return NextResponse.json({ error: "Missing key" }, { status: 400 });
  }

  const result = await validateApiKey(key);
  if (!result) {
    return NextResponse.json({ error: "Invalid key" }, { status: 401 });
  }

  return NextResponse.json({ userId: result.userId, keyId: result.keyId });
}
```

### Pattern 5: Admin Check via Environment Variable
**What:** Check if current user is admin using email allowlist in env var
**When to use:** Admin-only operations (generate key for other users, revoke any key, view all keys)
**Example:**
```typescript
// apps/web/lib/admin.ts
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "").split(",").map(e => e.trim()).filter(Boolean);

export function isAdmin(userEmail: string | null | undefined): boolean {
  if (!userEmail) return false;
  return ADMIN_EMAILS.includes(userEmail);
}
```

### Anti-Patterns to Avoid
- **Storing raw keys in the database:** Never persist the plaintext key. Only store SHA-256 hashes. The raw key is returned once at generation time and never again.
- **Using `Math.random()` for key generation:** Always use `crypto.randomBytes()` for cryptographically secure random data.
- **Comparing hashes with `===`:** Use `crypto.timingSafeEqual` to prevent timing attacks. Since we compare SHA-256 digests (fixed 32 bytes), the equal-length requirement is always satisfied.
- **Making the validation endpoint require Auth.js session:** The MCP stdio server calls this endpoint without a browser session. It must be a public route, authenticated only by the API key itself.
- **Naive modulo for base62 encoding:** If using base62, do not use `randomBytes[i] % 62` as it introduces bias. Use hex encoding (built-in, no bias) or nanoid's `customAlphabet` (handles bias correctly).

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cryptographic random bytes | Custom PRNG or `Math.random()` | `crypto.randomBytes(32)` | Cryptographic security requires OS-level entropy source |
| SHA-256 hashing | Manual hash implementation | `crypto.createHash('sha256')` | Built-in, audited, hardware-accelerated on modern CPUs |
| Timing-safe comparison | `===` on hash strings | `crypto.timingSafeEqual` on Buffers | Prevents timing side-channel attacks on hash comparison |
| Database migrations | Manual SQL files | `drizzle-kit generate` then `drizzle-kit migrate` | Existing project workflow, tracks migration state, generates SQL from schema diff |
| Input validation | Manual type checks | `zod` schemas | Already used throughout the project, provides type inference |
| Unbiased random strings | `randomBytes[i] % alphabetSize` | hex encoding (built-in) or `nanoid.customAlphabet` | Modulo bias makes some characters more likely than others |

**Key insight:** The entire crypto pipeline for API key management is built into Node.js. The only decisions are encoding format (hex vs base62) and where to put the code. No external crypto libraries are needed.

## Common Pitfalls

### Pitfall 1: Forgetting to Exclude Validation Endpoint from Auth Middleware
**What goes wrong:** The `/api/auth/validate-key` endpoint returns 302 redirects to `/login` because the middleware requires Auth.js session for all routes.
**Why it happens:** The current middleware in `apps/web/middleware.ts` redirects unauthenticated users to `/login` for everything except `/api/auth` and `/api/dev-login`. The validate-key endpoint IS under `/api/auth/` so it WILL match the current `isAuthApi` check (`req.nextUrl.pathname.startsWith("/api/auth")`).
**How to avoid:** Verify the middleware allows the validate-key route through. The current middleware already allows `/api/auth` paths, so `/api/auth/validate-key` should work without changes. BUT test this explicitly.
**Warning signs:** MCP stdio server gets HTML login page instead of JSON response when calling validate-key.

### Pitfall 2: Base62 Does Not Exist in Node.js Buffer
**What goes wrong:** Code like `randomBytes(32).toString("base62")` throws an error because "base62" is not a valid Buffer encoding.
**Why it happens:** The STACK.md research noted "base62 encoding" with a pseudo-code comment, but Node.js only supports `hex`, `base64`, `base64url`, `utf8`, `latin1`, and `ascii` as Buffer encodings.
**How to avoid:** Use hex encoding (`randomBytes(32).toString("hex")`) which produces a 64-character string. The key format becomes `rlk_` + 64 hex chars = 68 chars total. This is longer than base62 (which would be ~43 chars) but perfectly functional and requires zero additional code.
**Warning signs:** Runtime error on first key generation attempt.

### Pitfall 3: Not Handling Race Conditions in Key Generation
**What goes wrong:** Two simultaneous key generation requests could create duplicate keys (astronomically unlikely with 256-bit entropy) or fail the unique constraint on `key_hash`.
**Why it happens:** SHA-256 hash collisions on 256-bit random inputs are practically impossible (2^128 collision resistance), but the unique constraint on `key_hash` means a database error could occur.
**How to avoid:** Wrap the insert in a try-catch. On unique constraint violation, regenerate and retry (once). This is defense-in-depth, not a practical concern.
**Warning signs:** Unique constraint violation errors in logs.

### Pitfall 4: Exposing Key List with Full Hashes
**What goes wrong:** API key list endpoint returns `keyHash` field to the client, leaking hash values.
**Why it happens:** Using `select *` or not explicitly excluding `keyHash` from query results.
**How to avoid:** Always use explicit column selection in Drizzle queries. Only return `id`, `keyPrefix`, `name`, `lastUsedAt`, `createdAt`, `revokedAt`, `expiresAt` to the UI. Never return `keyHash`.
**Warning signs:** Network tab shows `keyHash` in response payload.

### Pitfall 5: Admin Authorization Without Role System
**What goes wrong:** Any authenticated user can generate keys for other users or revoke other users' keys.
**Why it happens:** The codebase has no role/permission system. The `ai-review.ts` action explicitly notes "admin system doesn't exist yet."
**How to avoid:** Use an `ADMIN_EMAILS` environment variable as a simple allowlist. Check `isAdmin(session.user.email)` before admin operations. Document this as a known limitation for future improvement.
**Warning signs:** Non-admin user successfully calls admin-only server action.

### Pitfall 6: Key Validation Not Updating lastUsedAt
**What goes wrong:** The `lastUsedAt` timestamp never gets updated, making key audit impossible.
**Why it happens:** Forgetting to add the update query after successful validation, or updating synchronously (slowing down every MCP request).
**How to avoid:** Fire-and-forget async update of `lastUsedAt` after successful validation. Do not await it -- it should not block the validation response.
**Warning signs:** `lastUsedAt` is always NULL in the database even after extensive key usage.

### Pitfall 7: Expired/Revoked Keys Still Validated
**What goes wrong:** A revoked or expired key continues to authenticate successfully.
**Why it happens:** The validation query only checks `keyHash` match but forgets to filter out `revokedAt IS NOT NULL` and `expiresAt < NOW()`.
**How to avoid:** Include both conditions in the validation query: `WHERE key_hash = $1 AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > NOW())`.
**Warning signs:** Revoked keys still work in MCP sessions.

## Code Examples

Verified patterns from official sources and existing codebase:

### API Keys Schema Definition (Drizzle ORM)
```typescript
// packages/db/src/schema/api-keys.ts
// Source: Existing schema patterns in packages/db/src/schema/users.ts, usage-events.ts
import { pgTable, text, timestamp, uuid, index } from "drizzle-orm/pg-core";
import { users } from "./users";

export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  keyHash: text("key_hash").notNull().unique(),      // SHA-256 hex digest
  keyPrefix: text("key_prefix").notNull(),            // "rlk_" + first 8 hex chars for display
  name: text("name").notNull().default("Default"),    // User-assigned name
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  revokedAt: timestamp("revoked_at"),                 // null = active, set = revoked
  expiresAt: timestamp("expires_at"),                 // null = no expiry, set = expires after grace
}, (table) => [
  index("api_keys_key_hash_idx").on(table.keyHash),
  index("api_keys_user_id_idx").on(table.userId),
]);

export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
```

### Key Generation Server Action
```typescript
// apps/web/app/actions/api-keys.ts
// Source: Follows pattern from apps/web/app/actions/skills.ts
"use server";

import { auth } from "@/auth";
import { db } from "@relay/db";
import { apiKeys } from "@relay/db/schema/api-keys";
import { generateRawApiKey, hashApiKey, extractPrefix } from "@/lib/api-key-crypto";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const generateKeySchema = z.object({
  name: z.string().min(1).max(100),
  forUserId: z.string().optional(), // Only admins can set this
});

export async function generateApiKey(formData: FormData): Promise<{
  key?: string;
  error?: string;
}> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };
  if (!db) return { error: "Database not configured" };

  const parsed = generateKeySchema.safeParse({
    name: formData.get("name"),
    forUserId: formData.get("forUserId"),
  });
  if (!parsed.success) return { error: "Invalid input" };

  const targetUserId = parsed.data.forUserId || session.user.id;

  // Admin check if generating for another user
  if (targetUserId !== session.user.id) {
    const { isAdmin } = await import("@/lib/admin");
    if (!isAdmin(session.user.email)) {
      return { error: "Only admins can generate keys for other users" };
    }
  }

  const rawKey = generateRawApiKey();
  const keyHash = hashApiKey(rawKey);
  const keyPrefix = extractPrefix(rawKey);

  await db.insert(apiKeys).values({
    userId: targetUserId,
    keyHash,
    keyPrefix,
    name: parsed.data.name,
  });

  revalidatePath("/profile");
  return { key: rawKey }; // Returned ONCE, never stored in plaintext
}
```

### Key Validation Service
```typescript
// packages/db/src/services/api-keys.ts
// Source: Pattern from packages/db/src/services/skill-metrics.ts
import { eq, and, isNull, or, gt, sql } from "drizzle-orm";
import { createHash, timingSafeEqual } from "crypto";
import { db } from "../client";
import { apiKeys } from "../schema/api-keys";

export async function validateApiKey(rawKey: string): Promise<{
  userId: string;
  keyId: string;
} | null> {
  if (!db) return null;

  const keyHash = createHash("sha256").update(rawKey).digest("hex");

  const result = await db.query.apiKeys.findFirst({
    where: and(
      eq(apiKeys.keyHash, keyHash),
      isNull(apiKeys.revokedAt),
      or(
        isNull(apiKeys.expiresAt),
        gt(apiKeys.expiresAt, new Date())
      )
    ),
    columns: {
      id: true,
      userId: true,
      keyHash: true,
    },
  });

  if (!result) return null;

  // Timing-safe comparison of the hash (defense in depth)
  const incomingHashBuf = createHash("sha256").update(rawKey).digest();
  const storedHashBuf = Buffer.from(result.keyHash, "hex");
  if (!timingSafeEqual(incomingHashBuf, storedHashBuf)) return null;

  // Fire-and-forget: update lastUsedAt (non-blocking)
  db.update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, result.id))
    .then(() => {})
    .catch((err) => console.error("Failed to update lastUsedAt:", err));

  return { userId: result.userId, keyId: result.id };
}
```

### Migration Generation
```bash
# After creating packages/db/src/schema/api-keys.ts and adding export to index.ts:
cd packages/db && pnpm db:generate
# This produces a new SQL migration file in packages/db/src/migrations/
# Then apply:
pnpm db:migrate
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Store API keys in plaintext | SHA-256 hash storage, show-once | Long-established (Stripe, GitHub, AWS pattern) | Database compromise does not leak raw keys |
| bcrypt for all secrets | SHA-256 for high-entropy keys, bcrypt for passwords | Best practice clarification ~2020 | SHA-256 is fast enough for 256-bit random keys since brute-force is infeasible |
| Single active key per user | Multiple keys with names and expiry | Modern API platforms (GitHub PATs, Stripe API keys) | Better rotation, auditability, and multi-device support |
| String equality for hash comparison | `crypto.timingSafeEqual` | Node.js 6+ (2016) but adoption still growing | Prevents timing side-channel attacks |

**Deprecated/outdated:**
- `crypto.createCipher` / `crypto.createDecipher`: Deprecated, use `createCipheriv` / `createDecipheriv` if encryption is needed (not needed for our hash-only approach)
- Storing "last 4 characters" of the key: The `rlk_` prefix + first 8 hex chars is more identifiable and follows the GitHub/Stripe pattern

## Open Questions

Things that couldn't be fully resolved:

1. **Admin role system scope**
   - What we know: The codebase has no admin concept. The `ai-review.ts` action notes "admin system doesn't exist yet."
   - What's unclear: Whether to add a `role` column to the users table or use environment variable allowlist.
   - Recommendation: Use `ADMIN_EMAILS` env var for Phase 20. It's the minimum viable admin check and avoids schema changes to the users table. A proper role system can be added in a future phase if needed.

2. **Key format: hex (64 chars) vs base62 (43 chars)**
   - What we know: STACK.md specifies "base62" but Node.js has no built-in base62 encoding. Hex encoding is built-in and produces longer but functional keys.
   - What's unclear: Whether the extra length matters for user experience (copying/pasting keys).
   - Recommendation: Use hex encoding. The full key is `rlk_` + 64 hex chars = 68 chars total. This is comparable to GitHub PATs (40+ chars) and Stripe keys (40+ chars). Users copy-paste keys once; length is not a UX concern. If base62 is strongly desired, add `nanoid` dependency and use `customAlphabet`.

3. **Grace period default duration**
   - What we know: KEY-06 requires "configurable grace period." The industry standard ranges from 1 hour to 30 days.
   - What's unclear: What default is appropriate for this internal tool.
   - Recommendation: Default to 24 hours. This gives employees a full work day to update their MCP configuration after rotation. Make it configurable via an environment variable (`API_KEY_GRACE_PERIOD_HOURS`).

4. **Rate limiting on validation endpoint**
   - What we know: The validation endpoint is public (no Auth.js session required). Without rate limiting, it could be brute-forced.
   - What's unclear: Whether to add rate limiting in this phase or defer.
   - Recommendation: Defer to a future phase. With 256-bit entropy (64 hex chars), brute-force is computationally infeasible (~2^256 attempts needed). Log failed validations for monitoring.

## Sources

### Primary (HIGH confidence)
- Node.js `crypto` module documentation (v25.6.0) -- `randomBytes`, `createHash`, `timingSafeEqual` APIs verified via official docs
- Node.js `Buffer` documentation (v25.6.0) -- confirmed valid encoding options (hex, base64, base64url; NOT base62)
- Existing codebase analysis -- `packages/db/src/schema/*.ts`, `apps/web/app/actions/*.ts`, `apps/web/middleware.ts`, `apps/web/auth.ts`
- STACK.md (`/home/dev/projects/relay/.planning/research/STACK.md`) -- API key design decisions, table schema, validation patterns

### Secondary (MEDIUM confidence)
- [Zuplo API Key Authentication Best Practices](https://zuplo.com/blog/2022/12/01/api-key-authentication) -- SHA-256 hashing, prefix patterns, rotation
- [Bomberbot: Best Practices for Building Secure API Keys](https://www.bomberbot.com/api/best-practices-for-building-secure-api-keys-a-comprehensive-guide/) -- Hash storage, show-once pattern
- [TokenMetrics: API Key Rotation Without Downtime](https://www.tokenmetrics.com/blog/seamless-api-key-rotation-without-downtime) -- Grace period / overlapping validity pattern
- [nanoid GitHub](https://github.com/ai/nanoid) -- Custom alphabet for unbiased base62 encoding (if needed)
- [Drizzle ORM: drizzle-kit generate](https://orm.drizzle.team/docs/drizzle-kit-generate) -- Migration generation workflow

### Tertiary (LOW confidence)
- [DEV.to: API Key Security Best Practices for 2026](https://dev.to/alixd/api-key-security-best-practices-for-2026-1n5d) -- Community article, patterns align with primary sources
- [MakerKit: Next.js Server Actions Security](https://makerkit.dev/blog/tutorials/secure-nextjs-server-actions) -- Server Action vulnerability patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All tools are built-in Node.js crypto or existing project dependencies (Drizzle, zod, Next.js). No new dependencies needed.
- Architecture: HIGH -- Patterns directly follow existing codebase conventions (schema files, service layer, server actions, route handlers). All verified against actual source files.
- Pitfalls: HIGH -- Verified against actual middleware code, Buffer encoding docs, and existing codebase patterns. The base62 non-existence is confirmed via official Node.js docs.

**Research date:** 2026-02-05
**Valid until:** 2026-03-07 (30 days -- stable domain, no fast-moving dependencies)

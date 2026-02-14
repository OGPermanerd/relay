# Domain Pitfalls: Gmail Workflow Diagnostic

**Domain:** Adding Gmail integration and AI-powered email pattern analysis to an existing multi-tenant Next.js/Auth.js skill marketplace
**Project:** EverySkill v4.0 Gmail Workflow Diagnostic
**Researched:** 2026-02-14
**Overall confidence:** HIGH (codebase audit of auth flow + verified Google API docs + Auth.js GitHub issues)

---

## Critical Pitfalls

Mistakes that break existing authentication, leak email data, or require architectural rewrites.

---

### Pitfall 1: Gmail Scope Escalation Triggers Re-Consent for ALL Existing Users

**What goes wrong:** The v4.0 plan calls for "Gmail connector via extended Google OAuth (readonly scope on existing sign-in)." The current Google provider in `apps/web/auth.config.ts` uses default scopes (openid, email, profile) with no explicit `authorization.params.scope`. Adding `https://www.googleapis.com/auth/gmail.readonly` to the Google provider configuration means EVERY user sees Google's "Additional access required" consent screen on their next login -- not just users who want Gmail analysis.

Three compounding problems:

1. **Consent screen shows ALL scopes, not just new ones.** Google's incremental authorization is misleading. Even with `include_granted_scopes=true`, the consent screen re-displays previously granted scopes alongside new ones. Users see "EverySkill wants to: View your email messages and settings, See your personal info, See your email address" -- the first item is alarming. GMass documented this extensively: users who already granted basic access are re-asked for everything, making the app "look dumb."

2. **Users who decline lose access entirely.** If a user clicks "Cancel" on the re-consent screen, Auth.js v5 treats it as a failed login. The user is redirected to `/login` with no session. They cannot use EverySkill at all until they accept the new scopes -- even if they only want to browse skills, not analyze Gmail.

3. **Granular consent allows users to uncheck Gmail.** Since November 2025, Google shows checkboxes for individual scopes. Users can uncheck Gmail while keeping sign-in scopes. If the app assumes Gmail access was granted without checking `account.scope`, all Gmail API calls fail with 403.

4. **Both `gmail.readonly` and `gmail.metadata` are restricted scopes.** Google classifies these as restricted, which triggers verification requirements and a scary "This app hasn't been verified" warning for external user types.

**Why it happens:** The v4.0 feature description says "readonly scope on existing sign-in." This implies modifying the existing Google provider's scope parameter. It seems like a one-line change. But Auth.js v5 has a single Google provider configuration per app -- you cannot have "basic scopes for login" and "extended scopes for Gmail analysis" as two configurations of the same provider.

**Consequences:**
- Every existing user is forced through a re-consent flow on next login. Users who don't understand why will be confused or will decline.
- Users who decline are locked out of the entire app, not just Gmail features.
- The SOC2-04 compliant 8-hour JWT session (`auth.config.ts` line 28) means this hits every user within 8 hours of deployment.
- If the OAuth consent screen is "External" type, Google shows an "unverified app" warning until restricted scope verification is completed (2-6 months for CASA assessment at $500-$4,500).

**Prevention:**

1. **Use a SEPARATE OAuth flow for Gmail access, completely outside Auth.js.** Build custom API routes (`/api/gmail/connect` and `/api/gmail/callback`) that handle a second Google OAuth flow with Gmail scopes. This flow is opt-in -- only triggered when a user clicks "Connect Gmail" on the diagnostic page. The existing login flow in `auth.config.ts` remains untouched.

2. **Store Gmail tokens separately from the Auth.js `accounts` table.** Create a `gmail_tokens` table with `userId`, `tenantId`, `accessToken` (encrypted), `refreshToken` (encrypted), `expiresAt`, `scope`, `connectedAt`, `revokedAt`. The Auth.js DrizzleAdapter manages the `accounts` table -- never store Gmail tokens there. This separation ensures revoking Gmail access does not invalidate the user's login session.

3. **Implement the separate OAuth flow with `access_type: "offline"` and `prompt: "consent"`.** This ensures Google issues a refresh token. The `prompt: "consent"` is acceptable here because this is a one-time opt-in action, not a login flow.

4. **Mark the OAuth consent screen as "Internal" user type in Google Cloud Console.** For apps used only by people in your Google Workspace organization, restricted scopes do NOT require Google verification, CASA security assessment, or the "unverified app" warning screen. Since EverySkill is an enterprise internal tool with Google Workspace SSO, the "Internal" user type is correct. This eliminates the verification timeline blocker entirely.

5. **Always check granted scopes after OAuth callback.** Parse the `scope` field in the token response. If `gmail.readonly` is not present (user unchecked it via granular consent), show: "Gmail access was not granted. Please try again and check the Gmail permission."

**Detection:** Deploy the change. Log in as an existing user. If a re-consent screen appears that includes Gmail scopes, the implementation is wrong -- Gmail scope escalation has leaked into the login flow. The existing login should show zero consent screens for returning users.

**Phase:** Must be the FIRST thing designed. The entire Gmail integration architecture cascades from this OAuth decision.

**Confidence:** HIGH -- verified against [Auth.js v5 Google provider docs](https://authjs.dev/getting-started/providers/google), [Google OAuth incremental authorization behavior](https://www.gmass.co/blog/oauth-incremental-authorization-is-useless/), [Gmail API scope classification](https://developers.google.com/workspace/gmail/api/auth/scopes), [OAuth consent screen internal user type](https://developers.google.com/workspace/guides/configure-oauth-consent), [GitHub NextAuth discussions #6227, #2066](https://github.com/nextauthjs/next-auth/discussions/6227), [Google Granular OAuth Consent](https://workspaceupdates.googleblog.com/2025/11/granular-oauth-consent-in-webapps.html).

---

### Pitfall 2: OAuth Tokens Stored in Plaintext in the Database

**What goes wrong:** The current `accounts` table (`packages/db/src/schema/auth.ts`) stores `access_token` and `refresh_token` as plaintext `text()` columns. The DrizzleAdapter writes these directly as received from Google. If a new `gmail_tokens` table follows the same pattern, Gmail OAuth tokens -- which grant access to read a user's entire email history -- sit unencrypted in PostgreSQL.

A database breach (SQL injection, backup exposure, unprotected snapshot, compromised admin credentials) exposes tokens that can read every user's Gmail. This is orders of magnitude worse than leaking profile information -- it is full email access.

**Why it happens:** The Auth.js DrizzleAdapter schema stores tokens in plaintext by default. The existing `accounts` table was created this way for basic login (where the access token has limited scope and expires in 1 hour). Developers carry this pattern forward to the Gmail tokens table because "that's how the existing table works."

**Consequences:**
- A database backup stored on an unencrypted volume exposes Gmail refresh tokens for every connected user.
- Refresh tokens do not expire until explicitly revoked. A leaked refresh token grants perpetual Gmail access.
- Under Google's Workspace API User Data Policy, apps that store restricted scope data on servers must undergo security assessment (CASA). Plaintext token storage would fail this assessment.
- Under GDPR, email data is personal data. Inadequate security measures (unencrypted tokens) constitute a violation.

**Prevention:**

1. **Encrypt Gmail tokens at rest using AES-256-GCM before storing.** Use a symmetric encryption key stored in an environment variable (`GMAIL_TOKEN_ENCRYPTION_KEY`), NOT in the database. Encrypt `accessToken` and `refreshToken` before INSERT, decrypt after SELECT.

2. **Implement an encryption service module.** Create `packages/db/src/lib/crypto.ts` with `encryptToken(plaintext: string): string` and `decryptToken(ciphertext: string): string`. Use Node.js `crypto.createCipheriv('aes-256-gcm', key, iv)` with a random IV per encryption. Store as `{iv}:{authTag}:{ciphertext}` in a single text column.

3. **Do NOT retroactively encrypt the existing `accounts` table tokens.** The existing login tokens (openid/email/profile scopes) are low-risk and managed by DrizzleAdapter. Encrypting them would break Auth.js token rotation. Focus encryption on the new Gmail tokens only.

4. **Add key rotation support from day one.** Store a `keyVersion` column alongside encrypted tokens. When rotating the encryption key, decrypt with old key, re-encrypt with new key. This avoids a "big bang" re-encryption migration.

5. **Set token expiry and cleanup.** Gmail access tokens expire in 1 hour. Store `expiresAt` and refresh proactively. If a refresh token is revoked by the user in Google Account settings, detect the 401 error, mark the token as revoked in the database, and prompt re-authorization.

**Detection:** Query the `gmail_tokens` table directly. If you can read the access_token value in plaintext, encryption is not working. Encrypted tokens should look like `a3b2c1:d4e5f6:7g8h9i...` (IV:tag:ciphertext), not `ya29.a0AfH6SM...`.

**Phase:** Token storage design. Must be implemented before any Gmail API calls are made.

**Confidence:** HIGH -- [Google Authorization best practices](https://developers.google.com/identity/protocols/oauth2/resources/best-practices) require encrypted token storage. [CASA assessment](https://deepstrike.io/blog/google-casa-security-assessment-2025) would fail on plaintext tokens.

---

### Pitfall 3: Access Token Expiry Causes Silent Gmail API Failures

**What goes wrong:** Google access tokens expire after exactly 1 hour (3600 seconds). The existing Auth.js setup uses JWT sessions with an 8-hour maxAge. A user connects Gmail, the access token is stored, and the diagnostic page works. One hour later, the user returns to the diagnostic page and every Gmail API call returns 401 Unauthorized. The UI either shows a spinner forever, displays a cryptic error, or shows stale cached data without indicating it is outdated.

Auth.js v5 does NOT implement automatic token refresh. This is documented across multiple GitHub issues (#3016, #8205, #408). The official Auth.js docs provide a manual refresh token rotation pattern, but it has a critical race condition: "refresh_tokens are usually only usable once. Meaning that after a successful refresh, the refresh_token will be invalidated and cannot be used again." If two concurrent requests both detect an expired token and attempt to refresh, only one succeeds -- the other gets an `invalid_grant` error and the user's Gmail connection is permanently broken until they re-authorize.

**Why it happens:** Developers test Gmail features within the first hour after connecting. Everything works. They don't test what happens after the access token expires because the development cycle is shorter than 1 hour. The token refresh code path is untested.

**Consequences:**
- Users see "Gmail analysis failed" errors with no explanation or recovery path.
- Concurrent requests (e.g., diagnostic page loading multiple data sections in parallel) trigger a race condition on token refresh, potentially invalidating the refresh token.
- The 8-hour JWT session outlives the 1-hour access token by 7 hours. For 7 out of 8 hours of a session, the stored Gmail token is expired.

**Prevention:**

1. **Implement proactive token refresh, not reactive.** Before making any Gmail API call, check if `expiresAt < Date.now() + 300000` (5 minutes before expiry). If so, refresh BEFORE the API call, not after a 401.

2. **Use a database-level mutex for token refresh to prevent race conditions.** In the `gmail_tokens` table, add a `refreshingAt` timestamp column. Before refreshing, SET `refreshingAt = NOW()` with a WHERE clause `refreshingAt IS NULL OR refreshingAt < NOW() - INTERVAL '30 seconds'`. If the UPDATE affects 0 rows, another request is refreshing -- wait and retry.

3. **Store the NEW refresh token after each refresh.** Google sometimes (but not always) returns a new refresh token alongside the new access token. If present, store it. If absent, keep the existing refresh token. The Auth.js refresh token rotation guide specifically warns: "If the response does not include a new refresh_token, the existing one must be preserved."

4. **Handle the `invalid_grant` error gracefully.** If a refresh attempt returns `invalid_grant`, the refresh token has been revoked (user revoked in Google settings, admin revoked, or race condition consumed it). Mark the Gmail connection as disconnected (`revokedAt = NOW()`), clear the tokens, and show the user: "Your Gmail connection has expired. Please reconnect."

5. **Wrap all Gmail API calls in a retry-with-refresh helper.**
   ```
   async function withGmailToken(userId, fn) {
     let token = await getValidGmailToken(userId); // refreshes if needed
     try { return await fn(token.accessToken); }
     catch (err) {
       if (err.status === 401) {
         token = await forceRefreshGmailToken(userId);
         return await fn(token.accessToken);
       }
       throw err;
     }
   }
   ```

**Detection:** Connect Gmail. Wait 61 minutes. Navigate to the diagnostic page. It should work without re-authorization. Check the `gmail_tokens` table -- `expiresAt` should be in the future (proactive refresh occurred).

**Phase:** Gmail connector phase. Token refresh must be implemented alongside the initial connection flow, not as a follow-up.

**Confidence:** HIGH -- [Auth.js refresh token rotation guide](https://authjs.dev/guides/refresh-token-rotation) documents the race condition. [Google OAuth token lifecycle](https://developers.google.com/identity/protocols/oauth2/web-server) confirms 1-hour access token expiry. [GitHub NextAuth Issue #8205](https://github.com/nextauthjs/next-auth/issues/8205) -- Google refresh token not provided after first sign-in.

---

### Pitfall 4: Email Data Retained After Analysis Creates Compliance Liability

**What goes wrong:** The v4.0 spec says "Privacy-first: analyze and discard raw data, persist only summary/recommendations." But the implementation path makes it easy to accidentally persist email data:

1. **Temporary storage becomes permanent.** Raw email headers are fetched from Gmail API, processed by Claude for analysis, and the analysis results are stored. But if the raw headers are stored in a database table for "batch processing" or "queued analysis," they persist until explicitly deleted. A crash during analysis leaves raw data in the database indefinitely.

2. **LLM prompts containing email data are logged.** If the Anthropic SDK logging is enabled, or if a general request logger captures outgoing API calls, the LLM prompt -- which contains email subjects, senders, and timestamps -- is written to application logs.

3. **Error stack traces capture email data.** If an error occurs during analysis, the error handler may include the email data in the error message or stack trace.

4. **Browser DevTools network tab shows email data.** If the API response includes intermediate email data, it is visible in the browser's network tab.

**Why it happens:** Developers focus on the happy path: fetch emails, analyze, store summary, delete raw data. Edge cases (crashes, errors, logging, caching) create unintentional data retention.

**Consequences:**
- A user disconnects Gmail expecting their email data is gone. Raw email headers sit in a temp table, error logs, or LLM API logs.
- Under GDPR, the user has a right to erasure. If email data is scattered, complete erasure is infeasible.
- Under Google's Workspace API User Data Policy, apps must limit data use to the stated purpose. Retaining raw data contradicts "analyze and discard."
- Enterprise security teams auditing EverySkill discover email data in logs. Trust is broken.

**Prevention:**

1. **Process email data entirely in-memory, never in the database.** The Gmail API response goes into a JavaScript object, is transformed into analysis input, sent to Claude, and the response is stored. At no point should raw email headers touch a database table.

2. **Sanitize LLM prompts before sending.** The Claude prompt should receive AGGREGATED data, not raw email headers. Instead of sending "Subject: Q4 Revenue Report, From: cfo@company.com", send "Category: Financial Reports, Count: 47, Avg per week: 3.4, Response rate: 23%." The LLM never sees actual email subjects, senders, or recipients.

3. **Never send raw email subjects to the AI.** Email subjects frequently contain PII (names), financial data, legal matters, health information, and privileged communications. Classify emails based on structural features: sender domain type (internal vs external), presence of List-Unsubscribe header, thread depth, reply pattern, time-of-day, label names. If subject classification is needed, strip PII first: remove names, numbers, and specific terms.

4. **Disable request logging for Gmail analysis endpoints.** Exclude `/api/gmail/*` routes from body logging. Log only request path, status code, and duration.

5. **Add a data deletion endpoint.** When a user disconnects Gmail or deletes their account, delete: `gmail_tokens` row, all `gmail_analyses` (stored summaries), and any cached recommendations linked to Gmail data.

**Detection:** Connect Gmail, run analysis, then disconnect. Query ALL tables for the user's ID. No email-related data should remain except the analysis summary (which contains no raw email content). Check application logs for the analysis time window -- no email subjects or sender addresses should appear.

**Phase:** Privacy architecture must be designed BEFORE any Gmail API calls are implemented.

**Confidence:** HIGH -- [Google Workspace API User Data Policy](https://developers.google.com/workspace/workspace-api-user-data-developer-policy) requires data minimization. GDPR right-to-erasure requirements verified via [Google Workspace GDPR guides](https://measuredcollective.com/gdpr-google-workspace-how-to-stay-compliant-with-gdpr/).

---

### Pitfall 5: Large Mailbox Analysis Causes Timeout and Memory Exhaustion

**What goes wrong:** An active enterprise user has 20,000-100,000+ emails. Analyzing email patterns requires fetching message metadata via the Gmail API. The API returns a maximum of 500 messages per `messages.list` call (5 quota units per call). Fetching metadata for each message requires a `messages.get` call (5 quota units each). For 50,000 messages:

- **100 `messages.list` calls** to get all message IDs: 500 quota units
- **50,000 `messages.get` calls** to get headers: 250,000 quota units
- **Per-user rate limit:** 15,000 quota units per minute
- **Time to fetch all headers:** 250,000 / 15,000 = ~17 minutes minimum

The Next.js API route will timeout. Even if the timeout is extended, holding a Node.js process for 17 minutes blocks event loop capacity.

**Why it happens:** Developers test with their own mailbox (500-2000 messages). It works in 30 seconds. In production, a user with 50,000+ messages triggers a completely different performance profile.

**Consequences:**
- Diagnostic page shows a spinner for 17+ minutes, then times out.
- If the user navigates away, the analysis restarts from scratch.
- Multiple users running simultaneously multiply API calls and memory usage.
- Gmail API rate limits are hit, causing cascading failures for all users in the same Google Cloud project.

**Prevention:**

1. **Use batch requests.** The Gmail API supports batching up to 100 requests per batch call. Instead of 50,000 individual `messages.get` calls, make 500 batch requests of 100 each. This reduces HTTP overhead by 99%.

2. **Limit analysis scope with date filtering.** Analyze only the last 90 days. Use `q=after:2025/11/16` on `messages.list`. For 90 days of an active user (~50 emails/day = 4,500 messages), total quota: ~23,000 quota units = under 2 minutes.

3. **CRITICAL: Use `gmail.readonly` scope, NOT `gmail.metadata`.** The `gmail.metadata` scope does NOT support the `q` (query) parameter on `messages.list`. Without date filtering, you must fetch ALL message IDs in the entire mailbox. Use `gmail.readonly` scope but request `format: 'metadata'` on each `messages.get` call -- this gives you headers without bodies while preserving the ability to filter by date.

4. **Implement a background job architecture.** When the user clicks "Run Diagnostic": create a `gmail_analyses` record with status `queued`, return immediately with a job ID. A background worker processes the analysis. The diagnostic page polls for completion. Store progress: `{ status: 'processing', messagesAnalyzed: 2500, totalMessages: 4500 }`.

5. **Sample instead of exhaustive analysis.** For large mailboxes, fetch a representative sample. Get message IDs for the last 90 days, then randomly sample 2,000-3,000 messages for detailed header analysis. Statistical patterns are valid from a 2,000-message sample.

6. **Implement exponential backoff for rate limits.** When the Gmail API returns 429, back off with exponential delay: 1s, 2s, 4s, 8s, max 60s. Resume from the last processed page.

7. **Set hard limits.** Cap at 5,000 messages per analysis. If the mailbox has more, analyze the most recent 5,000. Show a notice: "Analysis covers your last 5,000 emails (approximately 90 days)."

**Detection:** Create a test user with 10,000+ messages. Run the diagnostic. It should complete within 5 minutes. Monitor quota usage in Google Cloud Console.

**Phase:** Gmail analysis implementation phase. Architecture the background job system BEFORE building the analysis logic.

**Confidence:** HIGH -- [Gmail API quota limits](https://developers.google.com/workspace/gmail/api/reference/quota) verified: `messages.list` = 5 units, `messages.get` = 5 units, per-user limit = 15,000 units/minute. [Batch requests](https://developers.google.com/workspace/gmail/api/guides/batch): max 100 per batch. [gmail.metadata scope restrictions](https://developers.google.com/workspace/gmail/api/auth/scopes): no `q` parameter on `messages.list`.

---

## Moderate Pitfalls

---

### Pitfall 6: AI Analysis Hallucinating Email Pattern Insights

**What goes wrong:** Claude receives aggregated email statistics and generates a "workflow diagnostic" with recommendations. Three hallucination modes:

1. **Fabricated patterns.** Claude generates "You spend 3.2 hours per day on recruitment emails" when the data only shows email categories and counts, not time-per-email.

2. **Non-existent skill recommendations.** The diagnostic recommends "Deploy the Recruitment Email Drafter skill" when no such skill exists in the tenant's catalog.

3. **Over-confident specificity.** "Your email patterns suggest you could save 12.7 hours per week" when the data quality only supports ranges.

**Why it happens:** LLMs generate confident, specific, plausible-sounding analysis. The existing `ai-review.ts` uses structured Zod output, but the diagnostic has a richer output space where hallucination has more room to hide.

**Consequences:**
- Users make workflow decisions based on fabricated insights.
- Skill recommendations linking to non-existent skills destroy trust.
- Over-specific time savings estimates set unrealistic expectations.
- Enterprise decision-makers cite fabricated figures in presentations.

**Prevention:**

1. **Ground time estimates in explicit formulas, not AI inference.** Define: "Average email handling time: 2 minutes for read-only, 5 minutes for reply-required, 10 minutes for complex thread." Compute time from category counts using these fixed multipliers. Show the formula. The AI formats results -- it does NOT compute estimates.

2. **Match recommendations ONLY to existing skills.** Before generating, query the tenant's skill catalog. Pass actual skill names, descriptions, and slugs to Claude. Constrain output with Zod schema: `recommendations: [{ skillSlug: z.string(), skillName: z.string(), reason: z.string() }]`. Validate every `skillSlug` exists before rendering. Drop recommendations referencing non-existent skills.

3. **Use ranges, not point estimates.** "Could save 8-15 hours/week" not "12.7 hours/week." Show confidence level.

4. **Separate AI-generated text from computed metrics.** Dashboard shows computed metrics as hard numbers. AI-generated portion is visually distinct and provides qualitative insights, not quantitative claims.

5. **Follow the existing `ai-review.ts` pattern: structured JSON output with Zod validation.**

**Detection:** Run diagnostic with a test mailbox. Verify every skill recommendation links to an existing skill page. Verify time estimates match documented formula.

**Phase:** AI analysis implementation phase. Define output schema and grounding rules BEFORE building the analysis prompt.

**Confidence:** HIGH -- hallucination patterns consistent with existing v3.0 PITFALLS.md Pitfall 3; verified against RAG grounding literature.

---

### Pitfall 7: User Revokes Gmail Access but App Doesn't Detect It

**What goes wrong:** A user connects Gmail in EverySkill, then goes to [Google Account > Security > Third-party apps](https://myaccount.google.com/permissions) and revokes access. The refresh token is now invalid, but EverySkill doesn't know until the next API call fails.

1. **Stale "Connected" status.** Diagnostic page shows "Gmail Connected" because `gmail_tokens.revokedAt IS NULL`.
2. **Scheduled re-analysis fails silently.** A cron job hits 401, logs an error, moves on. User sees stale data.
3. **Two disconnection paths.** Disconnecting in EverySkill vs disconnecting in Google have different behaviors.

**Why it happens:** Google does not send a webhook when a user revokes an app's access. Detection only happens when an API call fails with `invalid_grant` or 401.

**Prevention:**

1. **Check token validity on diagnostic page load.** Make a lightweight `users.getProfile` call (1 quota unit) before displaying. If it fails, update UI to "Gmail disconnected."

2. **Handle `invalid_grant` at the refresh layer.** Set `gmail_tokens.revokedAt = NOW()` and clear tokens. Return clear error state.

3. **Show "Last synced: 2 days ago" timestamps.** Users can see staleness and re-connect.

4. **The "Disconnect Gmail" button should also revoke with Google.** Call `https://oauth2.googleapis.com/revoke?token={accessToken}` to synchronize both sides.

**Detection:** Connect Gmail. Revoke in Google Account settings. Return to diagnostic page. It should show "Gmail disconnected" within one page load.

**Phase:** Gmail connector phase. Revocation handling is part of the connection lifecycle.

**Confidence:** HIGH -- Google does not provide revocation webhooks ([verified via OAuth docs](https://developers.google.com/identity/protocols/oauth2/web-server)).

---

### Pitfall 8: Auth.js v5 JWT Callback Bloat from Gmail Token Management

**What goes wrong:** The existing JWT callback in `apps/web/auth.ts` (lines 48-107) already does significant work: injects `tenantId`, lazy-migrates sessions, lazy-loads roles. Developers may add Gmail connection status to the JWT callback since "everything auth-related goes there."

1. **JWT size bloat.** The JWT is stored in an encrypted cookie. Browsers have a ~4KB cookie limit. Adding Gmail token metadata could exceed this, causing silent session failures.

2. **Database queries on every request.** The JWT callback runs on EVERY authenticated request. Adding a Gmail token check means a DB query to `gmail_tokens` on every page load, even pages unrelated to Gmail.

**Prevention:**

1. **Do NOT store Gmail token status in the JWT.** JWT contains only identity: `id`, `tenantId`, `role`.

2. **Check Gmail connection status only on pages that need it.** The diagnostic page server component queries `gmail_tokens` directly.

3. **If "connected" indicator needed in nav:** fetch via client-side API call (`/api/gmail/status`) cached for 5 minutes.

4. **Keep the JWT callback lean.** Do not add feature-specific state.

**Detection:** After Gmail integration, measure JWT cookie size. It should not grow. Log JWT callback execution time -- it should not increase.

**Phase:** Architecture decision during Gmail connector design.

**Confidence:** HIGH -- Auth.js v5 JWT cookie size limits documented; existing callback complexity verified from `apps/web/auth.ts`.

---

### Pitfall 9: Multi-Tenant Gmail Analysis Leaks Cross-Tenant Patterns

**What goes wrong:** Gmail analysis introduces new cross-tenant risk. If analysis summaries are stored without `tenantId`, or if diagnostic queries lack tenant scoping, one tenant's email analysis could leak to another.

Specific risks:
- `db` client sets `app.current_tenant_id` to `DEFAULT_TENANT_ID` at connection level. Gmail analysis queries running without correct tenant context either see no data or all data.
- Background workers (for async analysis per Pitfall 5) may not have session context to resolve `tenantId`.

**Prevention:**

1. **Every Gmail table MUST have `tenantId` NOT NULL FK with RLS policy.** Includes: `gmail_tokens`, `gmail_analyses`, `gmail_recommendations`. Follow pattern from `skills.ts`.

2. **Background workers receive `tenantId` as required parameter.** Use `withTenant(tenantId, async () => { ... })` from `packages/db/src/tenant-context.ts`.

3. **Aggregate diagnostic statistics are per-tenant only.** No cross-tenant aggregation.

4. **DEFAULT_TENANT_ID cleanup should happen BEFORE Gmail features are built**, not alongside them. New code must use `session.user.tenantId`.

**Detection:** Create analysis results for two tenants. Query as tenant A. Verify zero results from tenant B appear.

**Phase:** Enforced from the first Gmail table migration.

**Confidence:** HIGH -- verified from codebase analysis. DEFAULT_TENANT_ID in 18+ files per project memory. RLS patterns established in Phase 25.

---

### Pitfall 10: Consent Fatigue -- "Why Does a Skill Marketplace Need My Email?"

**What goes wrong:** EverySkill is a skill marketplace. Adding a "Connect your Gmail" prompt creates a jarring context switch. Users ask: "Why does a tool catalog need to read my email?" Enterprise users are wary and may report the permission request to IT.

UX failure modes:
1. **Aggressive prompting kills adoption.** Full-screen overlay on the diagnostic page drives users away.
2. **Insufficient explanation.** A bare "Connect Gmail" button gives no reason to grant access.
3. **No value preview.** Users must grant access on faith.
4. **Irreversible-feeling permission.** Users worry about permanent email access.

**Consequences:**
- Low adoption rate (<10% of users connect Gmail).
- IT receives reports about the tool requesting email access.
- The feature investment delivers minimal value.

**Prevention:**

1. **Show value BEFORE asking for access.** Display a demo diagnostic using mock data. Show what the analysis looks like. Then offer "Connect your Gmail to see YOUR diagnostic."

2. **Use progressive disclosure.** Don't show "Connect Gmail" on homepage or nav. Place it on a dedicated "Workflow Diagnostic" page users navigate to intentionally.

3. **Explicitly state privacy guarantees ON the connection prompt:**
   - "EverySkill reads email headers only (subject, sender, date) -- not email bodies"
   - "Raw email data is analyzed in real-time and never stored"
   - "You can disconnect at any time in Settings"
   - "Analysis covers your last 90 days only"

4. **Make disconnection prominent and immediate.** Red "Disconnect Gmail" button. When clicked, revoke with Google AND delete local tokens.

5. **Get admin buy-in first.** Have the tenant admin explicitly enable Gmail diagnostic feature. If admin hasn't enabled it, hide from users entirely.

**Detection:** Show the diagnostic page to a non-technical user. If they hesitate about email access, the UX needs more value demonstration.

**Phase:** UX design phase, before implementation.

**Confidence:** MEDIUM -- UX patterns based on general OAuth consent best practices and enterprise user behavior.

---

## Minor Pitfalls

---

### Pitfall 11: gmail.metadata Scope Cannot Use Query Parameter

**What goes wrong:** The `gmail.metadata` scope seems more privacy-friendly than `gmail.readonly` (no body access). However, when using `gmail.metadata`, the `messages.list` endpoint does NOT support the `q` (query) parameter. You cannot filter by date, sender, or subject server-side.

To analyze only the last 90 days, you must fetch ALL message IDs in the entire mailbox, then filter by date in application code. For a 100,000-message mailbox, this is impractical.

**Prevention:**

1. **Use `gmail.readonly` instead of `gmail.metadata`.** Despite the broader scope name, `gmail.readonly` is necessary to use the `q` parameter for date filtering.

2. **Commit to NOT reading message bodies.** Add `format: 'metadata'` to every `messages.get` call. Request only specific headers via `metadataHeaders: ['Subject', 'From', 'To', 'Date', 'Message-ID']`. Same data as `gmail.metadata` scope but with `q` parameter support.

3. **Document this scope choice in the privacy notice.** Explain that `gmail.readonly` is required for date filtering but bodies are never accessed.

**Detection:** Test with `gmail.metadata` scope. If `messages.list` with `q` returns 0 results regardless of query, the scope restriction is blocking.

**Phase:** OAuth scope decision during Gmail connector design.

**Confidence:** HIGH -- [Gmail API scope docs](https://developers.google.com/workspace/gmail/api/auth/scopes) explicitly state: "The query parameter cannot be used when accessing the API using the gmail.metadata scope."

---

### Pitfall 12: Google Cloud Console Configuration Missing

**What goes wrong:** The Gmail API requires explicit enablement in Google Cloud Console. The existing Google OAuth uses only the basic Identity Platform. Adding Gmail API access requires enabling the API, updating consent screen scopes, adding redirect URIs, and verifying the user type is "Internal."

**Prevention:**

1. **Document the Google Cloud Console setup as a pre-requisite checklist:**
   - [ ] Enable Gmail API in APIs & Services > Library
   - [ ] Add Gmail scopes to OAuth consent screen > Scopes
   - [ ] Verify consent screen user type is "Internal"
   - [ ] Add redirect URI: `https://everyskill.ai/api/gmail/callback`
   - [ ] For development: add `http://localhost:2002/api/gmail/callback`

2. **Add a health check endpoint** (`/api/gmail/health`) that verifies Gmail API enablement.

**Phase:** Pre-implementation setup. Include in deployment checklist.

**Confidence:** HIGH -- standard Google Cloud Console configuration.

---

### Pitfall 13: Diagnostic Results Become Stale but Look Current

**What goes wrong:** User runs diagnostic on Day 1. On Day 30, they see Day 1 results. Email patterns have changed but the page shows outdated analysis with no indication of age.

**Prevention:**

1. **Show "Analyzed on [date]" prominently.** If older than 7 days, show yellow banner: "This analysis is [X] days old. Re-run to see current patterns."

2. **Do NOT auto-refresh.** User explicitly clicks "Re-run Diagnostic."

3. **Show delta on re-run.** "Email volume increased 23% since last analysis."

4. **Expire old analyses.** After 90 days, delete stored results.

**Phase:** Diagnostic dashboard UI phase.

**Confidence:** HIGH -- standard analytics UX pattern.

---

### Pitfall 14: Timezone Mismatch in Email Date Analysis

**What goes wrong:** Email Date headers are in the sender's timezone. Aggregating "emails per hour" without normalizing produces incorrect time-of-day patterns. An email sent at 9am Pacific shows as 5pm UTC.

**Prevention:** Parse all Date headers to UTC with `new Date(dateHeader).toISOString()` before aggregation. Display in user's timezone only in the UI. Store aggregates in UTC.

**Phase:** Email analysis implementation.

**Confidence:** HIGH -- standard datetime handling.

---

### Pitfall 15: E2E Tests Cannot Mock Gmail API

**What goes wrong:** Playwright E2E tests need to test the full flow but cannot authenticate with real Google OAuth in headless mode. The existing JWT injection cannot bypass the separate Gmail OAuth flow.

**Prevention:**

1. **Mock the Gmail OAuth flow.** Create `/api/gmail/mock-connect` (only when `NODE_ENV === 'test'`) that creates `gmail_tokens` with fake tokens.

2. **Mock Gmail API responses.** Use `msw` or custom proxy intercepting `gmail.googleapis.com/*` with canned responses.

3. **Test analysis logic with unit tests.** Aggregation and pattern detection are pure functions -- test with vitest using static fixtures.

4. **For connect flow UI:** verify button redirects to `accounts.google.com`. Don't complete OAuth in E2E.

**Phase:** Testing infrastructure, built alongside Gmail connector.

**Confidence:** HIGH -- existing E2E patterns use JWT injection; mock patterns well-established.

---

### Pitfall 16: JSONB Schema Drift in Diagnostic Snapshots

**What goes wrong:** `gmail_analyses` table uses JSONB for aggregate data. Over time, the schema changes (new categories, new metrics). Old snapshots have different shapes. Historical comparison breaks.

**Prevention:** Version the JSONB schema. Add `schemaVersion` integer to the snapshot. Write migration logic that normalizes old snapshots to current schema before comparison. Follow the same pattern established in `user_preferences` from v3.0 (Zod schema with code-defined defaults).

**Phase:** Diagnostic storage design.

**Confidence:** HIGH -- pattern established in v3.0 preferences.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|---|---|---|
| Gmail OAuth Architecture | Pitfall 1: Scope escalation breaks login | SEPARATE OAuth flow, not Auth.js scope extension |
| Gmail OAuth Architecture | Pitfall 11: gmail.metadata lacks q filter | Use gmail.readonly + metadata format |
| Gmail OAuth Architecture | Pitfall 12: Google Console not configured | Pre-implementation setup checklist |
| Token Storage & Security | Pitfall 2: Plaintext tokens in DB | AES-256-GCM encryption with env-var key |
| Token Lifecycle | Pitfall 3: Access token expiry | Proactive refresh with mutex, invalid_grant handling |
| Token Lifecycle | Pitfall 7: External revocation undetected | Lightweight token check on page load |
| Auth Integration | Pitfall 8: JWT callback bloat | Keep Gmail state OUT of JWT |
| Privacy Architecture | Pitfall 4: Email data retained | In-memory only, sanitized LLM prompts, no raw subjects to AI |
| UX Design | Pitfall 10: Consent fatigue | Value preview before connection, admin enablement |
| Email Fetching | Pitfall 5: Large mailbox timeout | Background jobs, sampling, date filtering, batch API |
| AI Analysis | Pitfall 6: Hallucinated insights | Grounded formulas, existing skill matching, ranges not points |
| Diagnostic Dashboard | Pitfall 13: Stale results | Age indicators, re-run prompts |
| Diagnostic Dashboard | Pitfall 14: Timezone mismatch | Normalize to UTC before aggregation |
| Multi-Tenant Isolation | Pitfall 9: Cross-tenant leakage | tenantId on all tables, RLS, worker scoping |
| DEFAULT_TENANT_ID Cleanup | Pitfall 9: New code uses old pattern | Clean up BEFORE Gmail features |
| Testing | Pitfall 15: Cannot mock Gmail in Playwright | Mock endpoints, unit test analysis logic |
| Data Schema | Pitfall 16: JSONB schema drift | Version field, Zod schema |

---

## Sources

### Primary -- Direct Codebase Audit
- Auth config: `apps/web/auth.config.ts` (73 lines -- Google OAuth, JWT sessions, 8h maxAge, no explicit scopes, no access_type: "offline")
- Auth setup: `apps/web/auth.ts` (162 lines -- signIn callback, JWT tenantId injection, no token refresh implemented)
- OAuth tokens: `packages/db/src/schema/auth.ts` (accounts table -- access_token, refresh_token as plaintext text() columns)
- Middleware: `apps/web/middleware.ts` (104 lines -- subdomain extraction, cookie-based auth check)
- Users schema: `packages/db/src/schema/users.ts` (47 lines -- tenantId FK, no department/team fields)
- DB client: `packages/db/src/client.ts` (59 lines -- connection-level DEFAULT_TENANT_ID)
- Tenant context: `packages/db/src/tenant-context.ts` (withTenant transaction wrapper)
- AI review: `apps/web/lib/ai-review.ts` (307 lines -- Anthropic SDK, structured JSON output, Zod validation pattern)
- E2E auth setup: `apps/web/tests/e2e/auth.setup.ts` (JWT injection pattern)

### External -- Official Google Documentation (HIGH confidence)
- [Gmail API Scopes](https://developers.google.com/workspace/gmail/api/auth/scopes) -- gmail.readonly and gmail.metadata are BOTH restricted scopes; gmail.metadata cannot use `q` parameter
- [Gmail API Quota Limits](https://developers.google.com/workspace/gmail/api/reference/quota) -- messages.list = 5 units, messages.get = 5 units, per-user = 15,000 units/min, per-project = 1,200,000 units/min
- [Gmail API Batch Requests](https://developers.google.com/workspace/gmail/api/guides/batch) -- max 100 requests per batch
- [Gmail API Performance Tips](https://developers.google.com/workspace/gmail/api/guides/performance) -- gzip, partial responses, metadata format
- [Google OAuth Best Practices](https://developers.google.com/identity/protocols/oauth2/resources/best-practices) -- encrypted token storage, incremental authorization
- [Google OAuth Restricted Scope Verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification) -- CASA required for external apps, internal app exceptions
- [Google OAuth Consent Screen Configuration](https://developers.google.com/workspace/guides/configure-oauth-consent) -- Internal user type: "scopes aren't listed on the consent screen and use of restricted or sensitive scopes doesn't require further review by Google"
- [Google Workspace API User Data Policy](https://developers.google.com/workspace/workspace-api-user-data-developer-policy) -- data minimization, limited use requirements
- [Google Granular OAuth Consent](https://workspaceupdates.googleblog.com/2025/11/granular-oauth-consent-in-webapps.html) -- per-scope checkboxes since November 2025

### External -- Auth.js Documentation (HIGH confidence)
- [Auth.js Refresh Token Rotation](https://authjs.dev/guides/refresh-token-rotation) -- race condition warning, single-use refresh tokens, pattern for JWT strategy
- [Auth.js Google Provider](https://authjs.dev/getting-started/providers/google) -- access_type: "offline" and prompt: "consent" configuration

### External -- Community Sources (MEDIUM confidence)
- [GMass: Google OAuth Incremental Authorization Is Useless](https://www.gmass.co/blog/oauth-incremental-authorization-is-useless/) -- consent screen re-displays all scopes, developer must handle scope merging
- [Google CASA Security Assessment 2025](https://deepstrike.io/blog/google-casa-security-assessment-2025) -- $500-$4,500 approved lab cost, 2-6 month timeline, annual recertification
- [NextAuth GitHub Discussion #6227](https://github.com/nextauthjs/next-auth/discussions/6227) -- incremental scope updates for existing users
- [NextAuth GitHub Discussion #6724](https://github.com/nextauthjs/next-auth/discussions/6724) -- hack for incremental scope changes (signIn third argument)
- [NextAuth GitHub Issue #8205](https://github.com/nextauthjs/next-auth/issues/8205) -- Google refresh token not provided after first sign-in
- [NextAuth GitHub Discussion #11160](https://github.com/nextauthjs/next-auth/discussions/11160) -- app requests additional access every login with prompt: "consent"
- [GDPR and Google Workspace](https://measuredcollective.com/gdpr-google-workspace-how-to-stay-compliant-with-gdpr/) -- DPA requirements for processing email data

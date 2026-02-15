# EverySkill API Reference

## Authentication

### Session Auth (Web)
Cookie-based authentication via Auth.js (Google Workspace SSO).
- Cookie name: `authjs.session-token` (dev) / `__Secure-authjs.session-token` (prod)
- Session maxAge: 28800 seconds (8 hours)

### Bearer Token Auth (API)
API key authentication for programmatic access.
- Header: `Authorization: Bearer rlk_<key>`
- Keys managed via admin panel or `/api/auth/validate-key`
- SHA-256 hashed storage with timing-safe comparison

### MCP Auth
Environment variable `EVERYSKILL_API_KEY` resolved to userId at connection time.

---

## REST Endpoints

### Health

#### `GET /api/health`
Health check endpoint. No authentication required.

**Response:**
```json
{ "status": "healthy", "timestamp": "2026-02-15T17:30:00.000Z" }
```

---

### Tracking

#### `POST /api/track`
Record skill usage events, token measurements, and training data capture.

**Authentication:** Bearer token (API key)

**Request Body:**
```json
{
  "action": "tool_use",
  "skill_id": "uuid",
  "skill_name": "my-skill",
  "tool_name": "everyskill",
  "tool_input_snippet": "...",
  "tool_output_snippet": "...",
  "model_name": "claude-sonnet-4-5-20250929",
  "input_tokens": 1500,
  "output_tokens": 800,
  "latency_ms": 2300
}
```

**Required fields:** `action`, `skill_id`, `skill_name`, `tool_name`

**Optional fields:**
- `tool_input_snippet`, `tool_output_snippet` — triggers training data capture (if consent enabled)
- `model_name`, `input_tokens`, `output_tokens` — triggers token cost measurement
- `latency_ms` — execution latency

**Response:** `200 OK` with `{ "success": true }`

**Side effects:**
- Increments `skills.totalUses` counter
- Inserts `usage_events` row
- If token fields present: inserts `token_measurements` row (fire-and-forget)
- If snippet fields present + dual consent: inserts `skill_feedback` training example (fire-and-forget)

---

### Feedback

#### `POST /api/feedback`
Submit thumbs up/down feedback on a skill.

**Authentication:** Bearer token (API key)

**Request Body:**
```json
{
  "skillId": "uuid",
  "feedbackType": "thumbs_up",
  "comment": "Works great for drafting proposals"
}
```

**Fields:**
- `skillId` (required) — skill UUID
- `feedbackType` (required) — `"thumbs_up"` or `"thumbs_down"`
- `comment` (optional) — max 2000 characters, sanitized via `sanitizePayload()`

**Response:** `200 OK` with `{ "success": true }`

**Side effects:**
- Inserts `skill_feedback` row
- Updates skill feedback aggregates (positive/negative counts, sentiment percentage)

---

### API Key Validation

#### `POST /api/auth/validate-key`
Validate an API key and return the associated user.

**Request Body:**
```json
{ "key": "rlk_abc123..." }
```

**Response:**
```json
{
  "valid": true,
  "userId": "uuid",
  "tenantId": "uuid"
}
```

---

### Install Callback

#### `POST /api/install-callback`
Record skill installation analytics.

**Request Body:**
```json
{
  "skillId": "uuid",
  "platform": "claude-code",
  "os": "macos"
}
```

---

### Domain Check

#### `GET /api/check-domain?domain=acme.everyskill.ai`
Validate whether a domain maps to an active tenant. Used by Caddy for on-demand TLS.

**Response:** `200 OK` (valid) or `404 Not Found` (invalid)

---

### Gmail Integration

#### `GET /api/gmail/connect`
Initiate Gmail OAuth flow. Redirects to Google consent screen.

#### `GET /api/gmail/callback`
OAuth callback handler. Stores encrypted tokens.

#### `GET /api/gmail/status`
Check Gmail connection status for current user.

**Response:**
```json
{ "connected": true, "email": "user@company.com" }
```

#### `POST /api/gmail/disconnect`
Revoke Gmail access and delete stored tokens.

---

### Cron

#### `GET /api/cron/daily-digest`
Send daily email digest of skill updates to subscribed users.

#### `GET /api/cron/weekly-digest`
Send weekly summary email.

#### `GET /api/cron/integrity-check`
Run data integrity validation checks.

---

### MCP

#### `POST /api/mcp/[transport]`
Streamable HTTP MCP endpoint for Claude.ai browser access. Implements the MCP protocol over HTTP.

---

## MCP Tools

### `/everyskill` (Unified Tool)

The primary MCP tool uses a STRAP action router pattern. All actions go through a single tool entry point.

#### Actions

| Action | Description | Key Parameters |
|--------|-------------|---------------|
| `search` | Search skills by keyword + semantic similarity | `query`, `category`, `quality_tier` |
| `track` | Record skill usage event | `skill_id`, `skill_name`, `tool_name` |
| `recommend` | Get AI-powered skill recommendations | `context`, `limit` |
| `analyze` | Analyze skill quality | `skill_id` |
| `publish` | Push skill updates or new versions | `skill_id`, `content` |
| `feedback` | Submit thumbs up/down feedback | `skill_id`, `feedbackType`, `comment` |

#### Search Response
```json
{
  "results": [
    {
      "id": "uuid",
      "name": "My Skill",
      "description": "...",
      "category": "productivity",
      "qualityTier": "gold",
      "totalUses": 42,
      "avgRating": 450
    }
  ]
}
```

### PostToolUse Hooks

Skills deployed via MCP include PostToolUse hooks in their frontmatter. These hooks fire after every skill execution:

**Async hook (tracking):**
- Sends usage event to `/api/track`
- Parses Claude transcript JSONL for token/model data
- Captures tool input/output snippets for training data

**Sync hook (feedback prompting):**
- Uses file-based counter for smart frequency gating
- First 3 uses: always prompt for feedback
- After 3 uses: every 10th use
- Returns `additionalContext` JSON to prompt user for thumbs up/down

---

## Server Actions

Server actions are the primary mutation layer for the web application. They handle authentication, validation, sanitization, and database writes.

### Skill Feedback Actions (`app/actions/skill-feedback.ts`)

| Action | Description |
|--------|-------------|
| `submitSuggestion` | Submit improvement suggestion on a skill |
| `updateSuggestionStatus` | Accept/dismiss/implement a suggestion (author only) |
| `replySuggestion` | Author reply to a suggestion |
| `submitTrainingExample` | Add golden input/output example (author only) |
| `acceptAndForkSuggestion` | Fork skill with suggestion content applied |
| `applyInlineSuggestion` | Apply suggestion as inline version update |

### Benchmark Actions (`app/actions/benchmark.ts`)

| Action | Description |
|--------|-------------|
| `triggerBenchmark` | Run cross-model benchmark on a skill |

### Admin Actions (`app/actions/admin-settings.ts`)

| Action | Description |
|--------|-------------|
| `saveSettingsAction` | Update tenant-level settings |

### User Preferences (`app/actions/user-preferences.ts`)

| Action | Description |
|--------|-------------|
| `getMyUserPreferences` | Get current user's preferences |
| `saveMyUserPreferences` | Save user preferences from form |

---

## Webhook / Hook Payload Format

### PostToolUse Hook Input (stdin)
```json
{
  "tool_name": "everyskill",
  "tool_input": { "action": "search", "query": "..." },
  "tool_output": "...",
  "transcript_path": "/path/to/transcript.jsonl"
}
```

### Track Endpoint Payload
```json
{
  "action": "tool_use",
  "skill_id": "uuid",
  "skill_name": "skill-name",
  "tool_name": "everyskill",
  "tool_input_snippet": "first 500 chars of input",
  "tool_output_snippet": "first 500 chars of output",
  "model_name": "claude-sonnet-4-5-20250929",
  "input_tokens": 1500,
  "output_tokens": 800,
  "latency_ms": 2300
}
```

---

*Last updated: 2026-02-15*

# Feature Landscape: v3.0 AI Discovery & Workflow Intelligence

**Domain:** Internal AI skill marketplace -- intent-based discovery, workspace diagnostics, visibility scoping, video integration, homepage redesign
**Researched:** 2026-02-13
**Overall confidence:** MEDIUM-HIGH (intent search and visibility scoping are well-established patterns; Google Workspace diagnostic and CLAUDE.md sync are novel combinations requiring deeper validation)

## Context

EverySkill is at v2.0 with a complete skill marketplace including: skill CRUD with 7-status lifecycle (draft through published), AI review with quality/clarity/completeness scoring, fork & improve with diff highlighting, MCP integration (16 tools: search, recommend, deploy, create, review, guide, etc.), multi-tenancy with subdomain routing, RBAC with admin roles, analytics dashboard, semantic search via pgvector + Voyage AI embeddings, and quality-gated publishing with auto-approval thresholds.

v3.0 extends the ecosystem with eight capabilities:

1. **AI-powered intent search** -- Conversational "What are you trying to solve?" with top-3 skill recommendations
2. **`/everyskill` MCP tool** -- In-prompt discovery for any AI client (Claude, Cursor, Codex)
3. **Google Workspace diagnostic** -- Connect Drive/Gmail/Calendar, analyze patterns, recommend automations
4. **Skill visibility scoping** -- Global company / employee visible / employee invisible / personal
5. **Admin-stamped global skills** -- Department approval workflow for company-wide skills
6. **Personal preference extraction** -- Parse CLAUDE.md into portable cross-AI preferences
7. **Loom video integration** -- Video demos attached to skills
8. **Homepage redesign** -- Intent-first landing, not metrics-first

**Existing infrastructure being extended:**
- `skills` table with `status` lifecycle, `searchVector` tsvector, pgvector `skill_embeddings`
- `skill_reviews` table with AI-generated quality/clarity/completeness scores
- MCP server with `search_skills`, `recommend_skills` (semantic), `deploy_skill`, `describe_skill`, `guide_skill`
- Multi-tenant RLS with `tenant_id` on all tables, subdomain routing
- `users` table with `role` field (admin/user), `isAdmin()` check
- Notification system with type-based routing and email preferences
- Quality scoring formula: usage(50%) + rating(35%) + metadata(15%)

---

## Feature Area 1: AI-Powered Intent Search

### Table Stakes

| Feature | Why Expected | Complexity | Depends On |
|---------|--------------|------------|------------|
| Natural language search bar on homepage | Users expect to describe problems, not type keywords | MEDIUM | Existing semantic search infrastructure |
| Top-3 ranked recommendations with rationale | Users need a short, curated list with "why this matches" | MEDIUM | Embedding similarity + LLM explanation |
| Fallback to keyword search when intent is ambiguous | System should degrade gracefully, not return zero results | LOW | Existing `searchSkills()` with ILIKE + tsvector |
| Loading state with streaming feedback | Users need to know the system is thinking, not broken | LOW | React Suspense or streaming UI |

**Expected UX Flow:**

```
1. User lands on homepage, sees prominent search bar
   Placeholder: "What are you trying to solve today?"

2. User types: "I need help reviewing pull requests faster"

3. System processes (500-1500ms):
   a. Generate embedding via Voyage AI
   b. pgvector cosine similarity search
   c. (Optional) LLM reranks top-5 into top-3 with match rationale

4. Results appear inline (NOT a new page):
   - Skill card with name, author, quality badge, usage count
   - One-line rationale: "Matches because it automates PR feedback generation"
   - "Install" and "Learn more" actions

5. If no semantic matches: fall back to tsvector full-text search
   If no results at all: "No skills match yet. Create one?"
```

**Successful implementations to model:**
- **Kore.ai enterprise search**: Understands intent behind query, maintains context, guides users from query to action. Their pattern of "query -> understand intent -> retrieve -> present with rationale" is the gold standard.
- **Algolia InstantSearch**: Sub-200ms results with typo tolerance, faceted navigation. The speed expectation is critical -- anything over 2 seconds feels broken.
- **Slack AI search**: Natural language across channels with source attribution. Key insight: show *why* a result matched, not just that it matched.

**What would delight:**
- Remembering the user's recent searches and usage patterns to personalize results
- Multi-turn refinement: "Show me only workflow-type skills" after initial results
- Proactive suggestions: "You used 3 code review skills this week. Trending: Advanced PR Automation (new this week)"

**What to avoid:**
- Do NOT build a chatbot interface. This is search with intelligence, not a conversation. The search bar should feel instant, not like waiting for a chat response.
- Do NOT show more than 5 results inline. Cognitive overload kills intent search. Top-3 is ideal; link to full results page for exploration.
- Do NOT require the LLM for every search. Use embedding similarity as the primary path; LLM reranking is an optional enhancement for ambiguous queries.

**Confidence:** HIGH for the search UX pattern, MEDIUM for the LLM reranking quality. The existing pgvector infrastructure (768-dim Voyage AI embeddings, HNSW index, cosine similarity) handles the core matching. LLM reranking adds latency but improves explanation quality.

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Context-aware search (role, department, recent activity) | Results personalized to the user's context | HIGH | Requires usage history analysis |
| "Did you mean?" suggestions for zero-result queries | Helps users reformulate without frustration | MEDIUM | Fuzzy matching on skill names |
| Search analytics (what queries return zero results) | Admin insight into skill gaps -- what should be built | LOW | Log queries + result counts |

---

## Feature Area 2: `/everyskill` MCP Tool for In-Prompt Discovery

### Table Stakes

| Feature | Why Expected | Complexity | Depends On |
|---------|--------------|------------|------------|
| Single `everyskill` tool with sub-commands | Clean MCP tool surface -- one tool, multiple intents | LOW | Existing MCP server architecture |
| `search` sub-command (semantic + text) | Natural language skill discovery from any AI prompt | LOW | Existing `recommend_skills` handler |
| `install` sub-command | One-step deploy from conversation | LOW | Existing `deploy_skill` handler |
| `describe` sub-command | Full skill details without leaving conversation | LOW | Existing `describe_skill` handler |
| Automatic context injection | When a skill is installed, its content becomes available to the AI | MEDIUM | Frontmatter + content in response |

**Expected UX Flow:**

```
User (in Claude Code): "I need to write a database migration"

Claude: [automatically calls everyskill.search("database migration")]
        "I found 3 relevant skills in your company's EverySkill marketplace:

         1. Database Migration Helper (Gold, 45 uses, 8.5/10 quality)
            Automates Drizzle migration generation from schema diffs

         2. Schema Review Workflow (Silver, 23 uses, 7/10 quality)
            Reviews schema changes for anti-patterns

         3. SQL Query Optimizer (12 uses, 6.5/10 quality)
            Optimizes slow queries with EXPLAIN analysis

         Want me to install any of these?"

User: "Install #1"

Claude: [calls everyskill.install("database-migration-helper")]
        "Installed. I now have access to the Database Migration Helper.
         Let me help you with that migration..."
```

**Key design decisions:**

1. **Single tool vs. multiple tools**: The existing MCP server has 16 tools. For external discovery (users who add EverySkill as an MCP server in their client), a single `everyskill` tool with sub-commands is cleaner than exposing all 16. The sub-command pattern (like `git`) keeps the tool surface small while maintaining full capability.

2. **Tool description matters enormously**: The MCP tool description is what the AI reads to decide when to call it. The description should say: "Search and install AI skills from your company's EverySkill marketplace. Use when the user needs help with a task that might have a pre-built skill, workflow, or prompt available." This framing makes the AI proactively search EverySkill when relevant.

3. **Response format for AI consumption**: Return structured JSON that the AI can naturally narrate. Include: skill name, quality badge, usage count, one-line description, install command. Do NOT return raw HTML or markdown tables -- the AI will format appropriately for its context.

**Successful implementations to model:**
- **MCP Market (mcpmarket.com)**: Agent Skills directory where tools are discoverable and installable from within AI conversations. Their pattern: browse -> inspect -> install is the standard flow.
- **Composio MCP tools**: Dynamic tool discovery with clear naming conventions and parameter descriptions. Key insight: tools should be self-documenting.
- **Docker MCP best practices**: Keep tool descriptions under 1024 characters, use clear parameter descriptions, return structured data.

**What would delight:**
- Proactive skill suggestion: When the AI detects the user is about to do something a skill covers, suggest it before being asked
- Usage tracking from MCP: "You've used Database Migration Helper 12 times this month, saving an estimated 6 hours"
- Skill recommendations based on what similar users installed

**What to avoid:**
- Do NOT expose internal admin tools (review, approve, reject) in the public MCP surface. The `/everyskill` tool is for consumers, not administrators.
- Do NOT require authentication for read-only search. Anonymous search with usage tracking nudges toward authentication is the existing pattern. Keep it.
- Do NOT return full skill content in search results. Return metadata only. The `install` command fetches content.

**Confidence:** HIGH. The existing MCP server already has `search_skills`, `recommend_skills`, `deploy_skill`, and `describe_skill`. This feature is primarily about packaging them into a single discoverable tool with better descriptions.

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Auto-suggest on task detection | AI proactively searches EverySkill when it detects a relevant task | MEDIUM | Requires careful tool description engineering |
| Cross-client compatibility (Claude, Cursor, Codex) | Works wherever MCP is supported | LOW | MCP is a standard protocol |
| Skill usage logging from MCP with FTE-days attribution | Every MCP usage contributes to ROI metrics | LOW | Existing `trackUsage()` |

---

## Feature Area 3: Google Workspace Diagnostic

### Table Stakes

| Feature | Why Expected | Complexity | Depends On |
|---------|--------------|------------|------------|
| OAuth2 connection for Drive, Gmail, Calendar | Users connect their Google account once | HIGH | Google OAuth2 with restricted scopes |
| Activity analysis: files viewed, emails sent, meetings attended | Users need a quantified view of where their time goes | HIGH | Google Reports API + Drive Activity API |
| Time pattern visualization (weekly heatmap) | Show where time clusters -- meetings, email, document work | MEDIUM | Data aggregation + chart rendering |
| Automation recommendations based on patterns | "You spend 3 hours/week on status update emails. Try this skill." | HIGH | Pattern analysis + skill matching |
| Deployment plan for recommended automations | Step-by-step: install skill -> configure -> measure impact | MEDIUM | Skill matching + onboarding flow |

**Expected UX Flow:**

```
1. Admin or user navigates to /diagnostics (new page)

2. "Connect Google Workspace" button
   - OAuth2 consent screen with MINIMAL scopes:
     - drive.metadata.readonly (file metadata, not content)
     - gmail.metadata (email metadata: to/from/subject, not body)
     - calendar.readonly (event metadata)
     - admin.reports.audit.readonly (org-level activity, admin only)
   - CRITICAL: Never request content-reading scopes

3. After connection, system analyzes last 30 days:
   a. Drive Activity API: documents viewed, edited, shared
   b. Gmail API: email volume, response times, recurring patterns
   c. Calendar API: meeting frequency, duration, attendee overlap
   d. Reports API (admin): org-wide activity patterns

4. Dashboard shows:
   - Time allocation pie chart (meetings / email / document work / other)
   - Weekly activity heatmap
   - Top time sinks: "You attended 12 hours of meetings last week"
   - Recurring patterns: "Every Monday you send 5 status update emails"

5. Automation recommendations:
   - "Status Update Automation (matches your Monday email pattern)"
   - "Meeting Summary Generator (you attend 15+ hours of meetings/week)"
   - "Document Template Skill (you create similar docs weekly)"
   - Each recommendation links to an existing EverySkill skill

6. Deployment plan:
   - Step 1: Install recommended skill
   - Step 2: Configure for your workflow (guided setup)
   - Step 3: Track time savings over 2 weeks
   - Step 4: Report ROI
```

**Critical implementation considerations:**

1. **Google OAuth scope classification**: Drive metadata and Calendar readonly are "sensitive" scopes requiring Google verification. Gmail metadata is also sensitive. The Reports API requires admin-level access. Budget 2-4 weeks for Google's OAuth verification process for production use.

2. **No content access -- metadata only**: The Drive API returns `viewedByMeTime`, `modifiedByMeTime`, `mimeType`, `name` without reading file content. The Gmail API can list messages with metadata (subject, from, to, date) without reading bodies using `format: metadata`. Calendar events include title, duration, attendees. This is sufficient for pattern analysis and keeps scope minimal.

3. **Data retention and privacy**: Store aggregated analytics only, not raw Google data. Show users exactly what data is analyzed. Provide delete/disconnect at any time. For SOC2 compliance, log all data access.

4. **The "screen time" concept**: Google Workspace APIs do NOT provide actual screen time or active usage duration. They provide event timestamps (when a file was viewed, when an email was sent, when a meeting occurred). "Time analysis" is an inference: if a user edited a Doc from 9am-11am (based on revision history), that's ~2 hours of document work. This is an approximation, not tracking.

**Successful implementations to model:**
- **RescueTime / Clockwise**: Time analytics dashboards that show where time goes with recommendations for improvement. Their weekly summary email pattern is highly effective.
- **Notion AI Q&A**: Connects to workspace data and provides insights. Key pattern: connect once, analyze continuously, surface insights proactively.

**What would delight:**
- Weekly digest email: "This week: 14h meetings, 8h email, 6h documents. 3 automation opportunities identified."
- Team-level patterns (admin only): "Your engineering team spends 40% of time in meetings. Here are 5 meeting-related skills."
- ROI tracking after deployment: "Since installing Meeting Summary Generator 2 weeks ago, you've saved an estimated 3 hours."

**What to avoid:**
- Do NOT build a real-time activity monitor. This is a periodic diagnostic (weekly/monthly), not surveillance.
- Do NOT read email bodies or document content. Metadata analysis is sufficient and avoids enormous privacy concerns.
- Do NOT store raw Google data long-term. Analyze, aggregate, discard.
- Do NOT build this before validating with actual users that they want this level of analysis. This is the highest-risk feature in v3.0.

**Confidence:** LOW-MEDIUM. The Google APIs support the data access needed, but the value proposition is unvalidated. No direct competitor does "workspace diagnostic -> skill recommendation" in this way. The OAuth verification process is a real blocker. Recommend building a manual "what do you spend time on?" survey first, then automating with Google APIs if the survey version proves valuable.

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Org-wide diagnostic (admin) | Department-level time allocation and automation opportunities | HIGH | Reports API requires admin access |
| Skill gap analysis | "These patterns have no matching skills. Create them?" | MEDIUM | Compare patterns to skill inventory |
| ROI projection | "If 50 employees install this skill, estimated annual savings: 400 FTE-days" | LOW | Math from hours_saved * usage projection |

---

## Feature Area 4: Skill Visibility Scoping

### Table Stakes

| Feature | Why Expected | Complexity | Depends On |
|---------|--------------|------------|------------|
| `visibility` field on skills: `global`, `team_visible`, `team_hidden`, `personal` | Users need to control who sees their skills | LOW | Schema migration, add column |
| Global skills visible to entire organization | Company-wide skills are the default for published, admin-approved skills | LOW | Query filter |
| Team-visible skills visible to same-department users | Department-specific skills (e.g., "Engineering Code Review") | MEDIUM | Department/team association on users |
| Team-hidden skills visible only to author and admins | Work-in-progress that shouldn't distract colleagues | LOW | Author-only access check |
| Personal skills visible only to the author | Private skills for personal productivity | LOW | `authorId` filter |
| Visibility selector on skill creation form | Authors choose scope when creating/editing | LOW | UI dropdown |
| Visibility filter on browse/search | Users can filter by visibility scope | LOW | Query parameter |

**Expected UX Flow:**

```
Creating a skill:
  - Author fills in name, description, content
  - Visibility dropdown: "Who can see this?"
    - "Everyone in the company" (global) -- default for published skills
    - "My team" (team_visible) -- visible to same-department users
    - "Only me and admins" (team_hidden) -- hidden from browse, discoverable by admin
    - "Just me" (personal) -- completely private

Browsing skills:
  - Default view: shows global + team_visible (for user's team) skills
  - Filter: "My skills" shows personal + team_hidden + user's authored skills
  - Admin view: shows all skills regardless of visibility

Search:
  - Global and team_visible skills appear in search results
  - Personal and team_hidden skills only appear when author searches
  - MCP search returns only skills the authenticated user can see
```

**Data model:**

The `skills` table needs a `visibility` column (text, enum: global/team_visible/team_hidden/personal). Additionally, a `team_id` or `department` association is needed on the `users` table to support team-scoped visibility.

**Current gap**: The existing user model does not have a department/team field. Options:
1. Add `department` text field to `users` table (simple, sufficient for v3.0)
2. Create a `teams` table with many-to-many user-team relationship (more flexible, more complex)

Recommendation: Start with a `department` text field on `users`. If team structures become more complex, migrate to a teams table later.

**How visibility interacts with existing features:**
- **Status lifecycle**: Visibility is orthogonal to status. A skill can be `published` + `personal` (live but only visible to author). Or `draft` + `global` (intending to share, not yet reviewed).
- **RLS**: Visibility scoping adds a second filter layer on top of tenant_id RLS. The query pattern becomes: `WHERE tenant_id = current_tenant AND (visibility = 'global' OR (visibility = 'team_visible' AND department = user_department) OR author_id = user_id)`.
- **MCP search**: The MCP search handler needs user context (authenticated user's department) to filter visibility. Currently, MCP search only has `userId` from the API key. Department would need to be resolved from the user record.

**Successful implementations to model:**
- **Salesforce record visibility**: Owner-based, role-based, and organization-wide defaults. Their "OWD (Organization-Wide Default) + sharing rules" pattern is the enterprise standard.
- **Confluence space permissions**: Spaces have visibility levels (public, restricted, personal). The "personal space" concept maps directly to personal skills.
- **Google Drive sharing**: Owner / Editor / Viewer with "anyone in organization" or "specific people." The simplicity of their model is what users expect.

**What would delight:**
- Default visibility based on context: Skills created via MCP default to `personal`, skills created via web UI default to `team_visible`
- Visibility change notifications: "Jane shared 'Code Review Automation' with the Engineering team"
- "Share with specific people" option for ad-hoc sharing outside team boundaries

**What to avoid:**
- Do NOT build complex ACL (Access Control Lists) with per-user permissions. Four visibility levels (global/team_visible/team_hidden/personal) cover 95% of use cases. Per-user sharing is an anti-feature at this scale.
- Do NOT make all skills global by default. Personal skills are where users experiment. If everything is public immediately, users will be reluctant to create rough drafts.
- Do NOT gate visibility behind the approval workflow. Visibility and approval are separate concerns. A personal skill does not need admin approval.

**Confidence:** HIGH. Visibility scoping with 4 levels is a well-established pattern across Salesforce, Confluence, Google Drive, and SharePoint. The implementation is a column addition plus query filters.

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Visibility analytics (admin) | "80% of skills are personal -- encourage sharing" | LOW | Aggregation query |
| Suggest visibility upgrade | "This personal skill has been used 20 times. Share with your team?" | MEDIUM | Usage threshold notification |
| Cross-team skill discovery | "Engineering team's most-used skills" visible to other teams | LOW | Team-filtered leaderboard |

---

## Feature Area 5: Admin-Stamped Global Skills with Department Approval

### Table Stakes

| Feature | Why Expected | Complexity | Depends On |
|---------|--------------|------------|------------|
| "Stamp as global" admin action | Admin can elevate a team/personal skill to global visibility | LOW | Visibility field update with authorization |
| Department approval workflow | Department head approves before skill goes global | MEDIUM | Approval chain logic |
| Global skill badge/indicator | Users can see which skills are company-endorsed | LOW | UI badge component |
| Audit trail for approval decisions | Who approved what, when, with what notes | LOW | Existing review_decisions table pattern |

**Expected UX Flow:**

```
Promotion pathway:
  1. Author creates skill (visibility: personal or team_visible)
  2. Skill gains usage and positive ratings within team
  3. Author or admin requests "global promotion"
  4. Department approval workflow:
     a. Department head receives notification
     b. Reviews skill content, usage metrics, ratings
     c. Approves or requests changes
  5. Admin (org-level) gives final stamp
  6. Skill visibility changes to "global" with "Admin Approved" badge
  7. Skill appears in org-wide browse/search with endorsement indicator

Admin stamp visual:
  - Blue checkmark badge: "Company Approved"
  - Shows approver name and date on skill detail page
  - Appears in search results and browse grid
```

**Approval chain pattern:**

```
TEAM_VISIBLE ──request-global──> PENDING_DEPT_APPROVAL
                                     |
                              dept head reviews
                                     |
                         ┌───────────┼────────────┐
                         v           v             v
                   DEPT_APPROVED  CHANGES_REQ  DEPT_REJECTED
                         |
                    admin reviews
                         |
                    ┌────┼────┐
                    v         v
              GLOBAL     ADMIN_REJECTED
              (stamped)
```

**How this interacts with the existing status lifecycle:**
- The existing 7-status lifecycle (draft -> pending_review -> ai_reviewed -> approved -> published) governs content quality.
- The global promotion workflow governs visibility scope.
- These are separate concerns: a skill must be `published` (passed content review) before it can be promoted to `global`.
- Implementation: Add a `globalApprovalStatus` field (pending/dept_approved/admin_approved/rejected) separate from the existing `status` field.

**Successful implementations to model:**
- **SharePoint Publishing Approval**: Content approval with multi-level sign-off (author -> reviewer -> publisher). Standard enterprise content governance pattern.
- **Apple App Store review + editorial selection**: Content review (automated) is separate from editorial curation (human). Skills pass automated review to be published, then pass human curation to be featured/global.
- **Confluence blueprints + admin templates**: Org-wide templates are admin-curated, team templates are self-service.

**What would delight:**
- Global skills highlighted in a "Company Recommended" section on the homepage
- Notification to all users when a new global skill is approved: "New company skill: Meeting Summary Generator"
- Usage metrics comparison: global skills vs team-only skills performance

**What to avoid:**
- Do NOT require global promotion for every skill. Most skills should be team-visible or personal. Global promotion is for the best-of-the-best.
- Do NOT create a separate reviewer role for department heads. Use the existing admin role + a `department` field on users to determine departmental authority. If the requesting user's department matches the approver's department, they can approve. Keep it simple.
- Do NOT block skill usage during the promotion workflow. The skill remains usable at its current visibility while the global promotion is pending.

**Confidence:** MEDIUM-HIGH. Enterprise content approval with multi-level sign-off is well-established. The novel aspect is combining it with the existing skill status lifecycle, which requires careful state management.

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Auto-nomination based on metrics | "This skill has 50+ uses and 4.5+ rating. Nominate for global?" | LOW | Threshold-based notification |
| Department skill catalog | Each department has a curated page of their approved skills | MEDIUM | Department-filtered view |
| Global skill retirement workflow | Admin can deprecate global skills with migration guidance | LOW | Status transition to deprecated |

---

## Feature Area 6: Personal Preference Extraction from CLAUDE.md

### Table Stakes

| Feature | Why Expected | Complexity | Depends On |
|---------|--------------|------------|------------|
| CLAUDE.md upload/paste interface | Users provide their CLAUDE.md content | LOW | Text input or file upload |
| Preference extraction via LLM | Parse CLAUDE.md into structured preferences | MEDIUM | LLM structured output (existing pattern) |
| Portable preference profile | Extracted preferences stored in user profile | LOW | New profile fields |
| Export to multiple AI configs | Generate CLAUDE.md, .cursorrules, AGENTS.md from preferences | MEDIUM | Template-based generation |

**Expected UX Flow:**

```
1. User navigates to /profile/preferences (new page)

2. "Import from CLAUDE.md" button
   - Paste text or upload file

3. LLM extracts structured preferences:
   {
     "coding_style": {
       "language": "TypeScript",
       "framework_preferences": ["Next.js", "Tailwind CSS"],
       "testing": "Playwright for E2E, vitest for unit",
       "formatting": "Prefer explicit types over inference"
     },
     "communication_style": {
       "verbosity": "concise",
       "tone": "direct, technical",
       "avoid": ["emojis in code comments", "unnecessary abstractions"]
     },
     "workflow_preferences": {
       "git": "conventional commits, no force push",
       "reviews": "prefer small PRs",
       "documentation": "inline comments over separate docs"
     }
   }

4. User reviews and edits extracted preferences

5. Export options:
   - "Generate CLAUDE.md" -- for Claude Code
   - "Generate .cursorrules" -- for Cursor
   - "Generate AGENTS.md" -- for VS Code Copilot / Codex
   - "Generate settings.json" -- for tool-specific configs
   - "Copy to clipboard" -- universal

6. Sync: when user updates preferences, regenerate all formats
```

**Key insight from research:**

The problem of keeping AI configuration in sync across tools is real and growing. Projects like `dot-claude` and `claudius` exist specifically to sync rules across Claude, Codex, Gemini, and Cursor. The user's CLAUDE.md is the richest source of preferences because it evolves organically through use.

**What the LLM extraction should parse:**
- Language/framework preferences
- Coding style rules (naming, formatting, patterns)
- Communication preferences (verbosity, tone, format)
- Workflow preferences (git, testing, CI/CD)
- Tool-specific instructions (what to use, what to avoid)
- Custom commands and aliases
- Project-specific context (can be flagged as non-portable)

**What to avoid extracting:**
- API keys and secrets (flag and redact)
- File paths specific to one machine
- Project-specific state (current branch, active tasks)

**Successful implementations to model:**
- **Claudius**: Configuration management for multiple AI agents. Syncs settings across Claude, Codex, Gemini.
- **dot-claude**: Syncs Claude Code rules to Droid, OpenCode, Codex, Qwen, Cursor, Copilot.
- **kaush.io AGENTS.md sync**: "One source of truth" pattern -- write once, generate for each tool.

**What would delight:**
- Team preference templates: "Engineering team defaults" that new hires can start from
- Preference diff: "Your CLAUDE.md changed since last import. Update preferences?"
- Skill recommendations based on preferences: "Based on your TypeScript + Next.js preferences, try these skills"

**What to avoid:**
- Do NOT auto-sync without user confirmation. Preferences are personal; auto-pushing changes to active AI configs could disrupt workflows.
- Do NOT store the raw CLAUDE.md. Extract structured preferences and discard the raw text (it may contain secrets).
- Do NOT try to be a full configuration management tool. Extract and export preferences; do not manage the target tool's config files.

**Confidence:** MEDIUM. The extraction concept is sound and the tools exist. The risk is in edge cases: CLAUDE.md files vary wildly in structure (some are 10 lines, some are 500+ lines). The LLM extraction quality depends heavily on the prompt engineering and validation UX. Recommend starting with a "review and edit" step rather than fully automated extraction.

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Preference-aware skill recommendations | "Based on your style preferences, this skill fits your workflow" | HIGH | Cross-reference preferences with skill metadata |
| Team preference analytics | "Most common preferences across Engineering: TypeScript, ESLint strict" | LOW | Aggregation of team preferences |
| Preference evolution tracking | "Your preferences have shifted toward functional patterns this quarter" | MEDIUM | Preference history comparison |

---

## Feature Area 7: Loom Video Integration

### Table Stakes

| Feature | Why Expected | Complexity | Depends On |
|---------|--------------|------------|------------|
| Loom URL field on skill creation/edit form | Authors paste a Loom URL to attach a demo video | LOW | New field on skills table |
| Embedded video player on skill detail page | Video plays inline without leaving the page | LOW | Loom Embed SDK `oembed()` |
| Video thumbnail in skill cards/browse | Visual preview of the demo video | LOW | `thumbnail_url` from oEmbed |
| Video metadata display (duration, title) | Users know what they are about to watch | LOW | oEmbed response fields |

**Expected UX Flow:**

```
Creating/editing a skill:
  1. Author pastes Loom URL: https://www.loom.com/share/abc123
  2. System validates URL format (must be loom.com/share/*)
  3. System calls Loom oEmbed to fetch metadata
  4. Preview shows: thumbnail, title, duration
  5. Author confirms: "Attach this video"

Viewing a skill:
  1. Skill detail page shows video section below description
  2. Embedded Loom player (responsive, 16:9 aspect ratio)
  3. Video metadata: "Demo: Code Review Automation (2:34)"
  4. Player supports play/pause, speed control, fullscreen (Loom defaults)

Browse/search:
  1. Skills with videos show a small camera icon on their card
  2. Video thumbnail appears on hover (optional)
  3. Filter: "Skills with demos" checkbox
```

**Implementation approach:**

1. **Loom Embed SDK** (`@loomhq/loom-embed`): Install via npm. Use `oembed()` method to fetch metadata from URL. Returns `{ type, html, title, duration, thumbnail_url, thumbnail_width, thumbnail_height, width, height, provider_name }`.

2. **No authentication required**: The Loom Embed SDK does not require API keys for basic oEmbed embedding. The video must be shared publicly (or with link access) for the embed to work.

3. **Data model**: Add `loomUrl` (text, nullable) and `loomThumbnail` (text, nullable) fields to `skills` table. Store the URL and cached thumbnail. Fetch fresh oEmbed data on skill view for the embed HTML.

4. **Server-side rendering**: Call `oembed()` server-side to get the embed HTML. Inject it into the page. This avoids client-side SDK loading and keeps the page fast.

**Successful implementations to model:**
- **Trainual**: Uses Loom Embed SDK to auto-convert Loom links into embedded players in training content. Clean, inline video experience.
- **Linear**: Embeds Loom videos in issue descriptions. The video plays inline without navigating away.
- **Notion**: oEmbed-based video embedding. Paste a Loom URL, get an embedded player. The simplest UX pattern.

**What would delight:**
- Auto-detect Loom URLs in skill content markdown and embed them automatically (using `textReplace()` from the SDK)
- Video timestamp links: "Watch from 1:23 for the deployment step"
- MCP tool returns video info: "This skill has a 2-minute demo video. View at: [URL]"

**What to avoid:**
- Do NOT build a custom video player or support arbitrary video URLs. Loom-only keeps scope manageable and the embed quality consistent.
- Do NOT require video for every skill. The field should be optional. Many skills are text-only and that is fine.
- Do NOT auto-play videos. Users should click to play. Auto-play is hostile UX.
- Do NOT store video content or cache video files. Only store the URL and metadata. Loom hosts the video.

**Confidence:** HIGH. Loom Embed SDK is well-documented, has no authentication requirement for basic embedding, and returns all needed metadata. The implementation is straightforward: URL field + oEmbed call + embed HTML injection.

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Video-first browse mode | Grid of skill demo thumbnails for visual discovery | LOW | Thumbnail grid view |
| Loom URL auto-detection in markdown | Paste a Loom link in skill content, auto-embed | MEDIUM | `textReplace()` from SDK |
| Video analytics (views, watch-through rate) | Track engagement with skill demos | HIGH | Would require Loom API (not available) |

---

## Feature Area 8: Homepage Redesign

### Table Stakes

| Feature | Why Expected | Complexity | Depends On |
|---------|--------------|------------|------------|
| Intent-first hero with prominent search | Homepage centered on "What are you trying to solve?" not metrics | MEDIUM | Feature Area 1 (intent search) |
| Curated sections: "Company Recommended" / "Trending" / "New" | Clear content categories for browsing | LOW | Existing trending + new global skills |
| Personalized "For You" section | Skills based on user's usage, department, and preferences | MEDIUM | Usage history + department matching |
| Clean, modern visual design | Current homepage is data-heavy; redesign should be inviting | MEDIUM | Tailwind CSS (existing) |
| Mobile-responsive layout | Enterprise users access on multiple devices | LOW | Existing responsive framework |

**Expected UX Flow:**

```
Current homepage structure (v2.0):
  - Welcome message
  - Search bar (small, secondary)
  - Create/Install CTA cards
  - Platform stats (FTE Years Saved, Total Uses, Downloads, Avg Rating)
  - Trending Skills + Top Contributors
  - Your Impact section

Proposed homepage structure (v3.0):
  - Hero: Large search bar with "What are you trying to solve today?"
    Below: 3-4 quick category pills (Prompts, Workflows, Agents, MCP Tools)
  - "Company Recommended" section (admin-stamped global skills)
  - "For You" section (personalized based on usage + department)
  - "Trending This Week" section (existing, redesigned as cards)
  - "Recently Added" section (new skills in last 7 days)
  - Platform impact metrics (condensed to a single banner, not 4 full stat cards)
  - "Your Leverage" (moved to dedicated tab, not competing with discovery)
```

**Key design principles from research:**

1. **5-Second Rule**: Users should understand what they can do within 5 seconds. The current homepage mixes metrics, navigation, and discovery. The redesign should prioritize one thing: **helping users find skills**.

2. **Search-first, not metrics-first**: The current homepage leads with "Welcome back, [name]!" and platform stats. This is backwards for a marketplace. The hero should be the search bar. Metrics are important but secondary -- move them to a banner or separate analytics page.

3. **Cards, not tables**: The skill browse page uses a table layout (SkillsTable). The homepage should use cards with visual elements (author avatar, quality badge, video thumbnail if available, usage sparkline). Cards invite exploration; tables invite scanning.

4. **Progressive disclosure**: Show 3-4 skills per section with "See all" links. Do not dump 20 skills on the homepage. Curate aggressively.

**Successful implementations to model:**
- **Atlassian Marketplace**: Hero search bar + category pills + featured apps + trending apps. Clean, discoverable, low cognitive load.
- **Notion Template Gallery**: Visual cards with preview thumbnails, category filters, "Featured" curation. The browse-by-category experience is outstanding.
- **Slack App Directory**: Categories on the left, featured apps prominently displayed, search at top. The "categories as navigation" pattern is effective for skill types.
- **Vercel Dashboard**: Clean, minimal, action-oriented. "What do you want to deploy?" as the primary interaction. Translates to "What do you want to solve?" for EverySkill.

**What would delight:**
- "Continue where you left off" section showing recently viewed/used skills
- Seasonal or event-driven featured sections: "New quarter? Skills for planning and goal-setting"
- Empty state for new users: guided onboarding with "Install your first skill in 60 seconds"
- Search bar with typeahead showing skill names + categories as user types

**What to avoid:**
- Do NOT preserve the current layout with minor tweaks. The current homepage is a dashboard, not a marketplace. The redesign should fundamentally change the primary interaction from "view metrics" to "find skills."
- Do NOT show platform stats prominently to regular users. Stats matter to admins and executives. Regular users care about finding skills. Move stats to analytics page or admin dashboard.
- Do NOT use a carousel/slider for featured skills. Carousels have notoriously low engagement. Use a static grid of 3-4 featured skills.
- Do NOT auto-rotate or auto-animate anything. Let users control their browsing pace.

**Confidence:** HIGH. Marketplace homepage patterns are extremely well-established (Atlassian, Notion, Slack, Vercel, Figma Community). The current EverySkill homepage is a v1 dashboard; evolving it into a v3 marketplace landing follows proven patterns.

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Onboarding flow for new users | Guided "Install your first skill" reduces time-to-value | MEDIUM | Multi-step wizard |
| Homepage customization | Users can pin sections, hide categories | HIGH | User-level preferences |
| Admin-curated hero banner | Admins can feature a skill/announcement in the hero | LOW | Admin settings for hero content |

---

## Anti-Features

Features to explicitly NOT build. Tempting but counterproductive.

| Anti-Feature | Why Tempting | Why Problematic | Do Instead |
|--------------|-------------|-----------------|------------|
| **Full Google Workspace integration (read emails, documents)** | "More data = better recommendations" | Massive security/privacy concern. Reading email bodies and document content is a restricted Google scope requiring annual security audits. Users will NOT trust an internal tool with this access. | Metadata only. File names, timestamps, email counts -- never content. |
| **Real-time activity tracking / screen time** | "Know exactly how time is spent" | Feels like surveillance. Google APIs do not provide screen time. Building it requires OS-level agents. Employee trust destruction. | Periodic diagnostic based on metadata. Weekly summary, not real-time monitoring. |
| **Custom video hosting** | "Support any video platform" | Storage costs, transcoding pipeline, CDN setup, player development. Enormous scope for a feature that Loom already solves. | Loom-only via Embed SDK. If demand grows, add YouTube oEmbed as a second provider. |
| **Full AI configuration management** | "Manage all your AI tools from EverySkill" | Scope explosion. Configuration management across Claude, Cursor, Copilot, Codex is a product in itself. | Extract and export preferences. Do not manage remote configs. |
| **Per-user skill sharing (ACLs)** | "Share this skill with just Jane and Bob" | Complex permission model, UI for user selection, permission revocation, audit trail. 4 visibility levels cover 95% of cases. | Stick with global/team_visible/team_hidden/personal. If specific sharing is needed later, add as a separate feature. |
| **AI chatbot on homepage** | "Conversational interface for discovery" | Adds latency, complexity, and cost to every homepage visit. Users expect instant search, not a chatbot. MCP is the conversational interface. | Intent search with semantic matching. Fast, inline results. MCP handles the conversational use case. |
| **Multi-level approval chain (3+ approvers)** | "More approvers = better governance" | Creates bottlenecks. At 500 users, a 3-approver chain means skills sit in limbo. | Department head + admin (2 levels max). Single admin is sufficient for most orgs. |
| **Preference auto-sync to AI tools** | "Automatically update CLAUDE.md when preferences change" | Writing to users' local files without explicit action is invasive. Auto-sync could break working configurations. | Export button generates config files. User copies/applies manually. Full control. |

---

## Feature Dependencies

```
[Intent Search] (#1)
    |--extends---> existing SearchWithDropdown component
    |--reuses----> skill_embeddings + pgvector (existing)
    |--reuses----> Voyage AI embedding generation (existing)
    |--creates---> new intent search component (homepage)
    |--creates---> LLM reranking service (optional)
    |--blocks----> Homepage Redesign (#8) hero section

[/everyskill MCP Tool] (#2)
    |--wraps-----> existing MCP handlers (search, recommend, deploy, describe)
    |--reuses----> MCP server infrastructure (existing)
    |--reuses----> trackUsage() (existing)
    |--independent of--> all other features

[Google Workspace Diagnostic] (#3)
    |--creates---> OAuth2 integration (new)
    |--creates---> /diagnostics page (new)
    |--creates---> activity analysis service (new)
    |--requires--> Visibility Scoping (#4) for "recommend team skills"
    |--benefits from--> Intent Search (#1) for matching patterns to skills
    |--highest risk--> OAuth verification timeline, privacy concerns

[Visibility Scoping] (#4)
    |--modifies--> skills table (add visibility column)
    |--modifies--> users table (add department field)
    |--modifies--> ALL search/browse queries (add visibility filter)
    |--modifies--> MCP search handlers (add visibility context)
    |--blocks----> Admin-Stamped Global Skills (#5)
    |--blocks----> Homepage "For You" section (#8)

[Admin-Stamped Global Skills] (#5)
    |--requires--> Visibility Scoping (#4) for global/team distinction
    |--extends---> existing admin review actions
    |--creates---> global promotion workflow
    |--creates---> "Company Approved" badge component
    |--blocks----> Homepage "Company Recommended" section (#8)

[CLAUDE.md Preference Extraction] (#6)
    |--creates---> /profile/preferences page (new)
    |--creates---> LLM extraction service (new)
    |--creates---> multi-format export (CLAUDE.md, .cursorrules, AGENTS.md)
    |--independent of--> all other features
    |--benefits from--> Intent Search (#1) preference-aware recommendations

[Loom Video Integration] (#7)
    |--modifies--> skills table (add loomUrl field)
    |--modifies--> skill creation form (add URL field)
    |--modifies--> skill detail page (add video player)
    |--adds------> @loomhq/loom-embed dependency
    |--independent of--> all other features

[Homepage Redesign] (#8)
    |--requires--> Intent Search (#1) for hero section
    |--requires--> Visibility Scoping (#4) for "For You" personalization
    |--requires--> Admin-Stamped Global (#5) for "Company Recommended"
    |--benefits from--> Loom Video (#7) for video thumbnails in cards
    |--modifies--> apps/web/app/(protected)/page.tsx (complete rewrite)
    |--modifies--> multiple home-related components
```

### Critical Path

```
Phase 1: Foundation Layer
    Visibility scoping (schema + queries) -- blocks everything else
    Loom video integration -- independent, small scope, quick win
    /everyskill MCP tool -- independent, wraps existing handlers

Phase 2: Discovery Layer
    Intent search (semantic + LLM reranking)
    Admin-stamped global skills (requires visibility from Phase 1)
    CLAUDE.md preference extraction -- independent

Phase 3: Experience Layer
    Homepage redesign (requires intent search + visibility + global skills)
    Google Workspace diagnostic -- independent but highest risk, research more first

Phase 4: Intelligence Layer (if Google diagnostic validated)
    Google Workspace OAuth + analysis
    Pattern-to-skill matching
    ROI tracking
```

---

## MVP Recommendation

### Must Have for v3.0

**Visibility Scoping (build first -- foundation):**
- [ ] `visibility` column on `skills` table: global | team_visible | team_hidden | personal
- [ ] `department` text field on `users` table
- [ ] Visibility filter in search/browse queries
- [ ] Visibility selector on skill creation/edit form
- [ ] MCP search respects visibility based on authenticated user

**Intent Search (build second -- core UX):**
- [ ] Prominent search bar on homepage: "What are you trying to solve today?"
- [ ] Semantic search via existing pgvector + Voyage AI embeddings
- [ ] Top-3 results inline with match rationale
- [ ] Fallback to tsvector full-text search

**Admin-Stamped Global Skills (build with visibility):**
- [ ] "Stamp as global" admin action on published skills
- [ ] "Company Approved" badge on skill cards and detail page
- [ ] Global skills appear in "Company Recommended" section

**Loom Video Integration (quick win, build early):**
- [ ] `loomUrl` field on skills table
- [ ] Loom URL input on skill creation/edit form
- [ ] Embedded video player on skill detail page via Loom Embed SDK
- [ ] Video thumbnail in skill browse cards

**Homepage Redesign (build after above):**
- [ ] Hero: large search bar with category pills
- [ ] "Company Recommended" section (global skills)
- [ ] "Trending This Week" section (redesigned as cards)
- [ ] "Recently Added" section
- [ ] Condensed platform metrics banner

**/everyskill MCP Tool (build parallel):**
- [ ] Single `everyskill` tool with search/install/describe sub-commands
- [ ] Packaged for easy addition to any MCP client
- [ ] Clear tool description for AI auto-invocation

### Defer to Post-v3.0

- [ ] **Google Workspace Diagnostic**: Highest risk, unvalidated value prop. Build a manual "what do you spend time on?" survey first. If users engage, build the Google integration.
- [ ] **CLAUDE.md Preference Extraction**: Valuable but niche. Start with a simple text import + manual tagging. LLM extraction is phase 2.
- [ ] **Personalized "For You" section**: Requires usage history analysis. Build after visibility scoping is live and generating data.
- [ ] **Department approval workflow**: Start with admin-only global stamping. Add department approval chain if org structure demands it.
- [ ] **Multi-format preference export**: Start with CLAUDE.md export only. Add .cursorrules and AGENTS.md based on user demand.
- [ ] **Homepage customization**: Users pinning sections is a post-launch optimization.
- [ ] **Search analytics**: Log queries from day 1, build the dashboard later.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Risk | Priority |
|---------|------------|---------------------|------|----------|
| Visibility scoping (4 levels) | HIGH (privacy, control) | LOW | LOW | P0 |
| Intent search (semantic, top-3) | HIGH (core discovery UX) | MEDIUM | LOW | P0 |
| Homepage redesign (search-first) | HIGH (first impression) | MEDIUM | LOW | P0 |
| Loom video integration | MEDIUM (demo quality) | LOW | LOW | P0 |
| /everyskill MCP tool (unified) | HIGH (MCP discovery) | LOW | LOW | P0 |
| Admin-stamped global skills | MEDIUM (governance) | LOW | LOW | P0 |
| CLAUDE.md preference extraction | MEDIUM (developer UX) | MEDIUM | MEDIUM | P1 |
| Department approval workflow | MEDIUM (governance) | MEDIUM | LOW | P1 |
| Personalized "For You" section | MEDIUM (engagement) | HIGH | MEDIUM | P2 |
| Google Workspace diagnostic | HIGH if validated (ROI) | HIGH | HIGH | P2 |
| Multi-format preference export | LOW (niche) | MEDIUM | LOW | P3 |
| Homepage customization | LOW (power users) | HIGH | LOW | P3 |

---

## Sources

### Intent-Based Search (MEDIUM-HIGH confidence)
- [Meilisearch: AI-Powered Search 2026](https://www.meilisearch.com/blog/ai-powered-search) -- Semantic search patterns
- [Orbix: AI-Driven UX Patterns SaaS 2026](https://www.orbix.studio/blogs/ai-driven-ux-patterns-saas-2026) -- Conversational search UX
- [Kore.ai: Best Enterprise Search Software 2026](https://www.kore.ai/blog/best-enterprise-search-software) -- Intent understanding in enterprise search
- [Algolia: Best Marketplace UX for Search](https://www.algolia.com/blog/ecommerce/best-marketplace-ux-practices-for-search) -- Search UX patterns
- [Slack: AI Enterprise Search Features 2026](https://slack.com/blog/productivity/ai-enterprise-search-top-features-and-tools-in-2025) -- Enterprise search patterns

### MCP Discovery (HIGH confidence)
- [MCP Market: Agent Skills Directory](https://mcpmarket.com/tools/skills) -- Skill marketplace UX
- [Docker: MCP Server Best Practices](https://www.docker.com/blog/mcp-server-best-practices/) -- Tool description and naming
- [Composio: Using MCP Prompts/Resources/Tools](https://composio.dev/blog/how-to-effectively-use-prompts-resources-and-tools-in-mcp) -- MCP tool design
- [Speakeasy: Dynamic Tool Discovery in MCP](https://www.speakeasy.com/mcp/tool-design/dynamic-tool-discovery) -- Dynamic tool patterns
- [MCP Specification: Tools](https://modelcontextprotocol.io/specification/2025-06-18/server/tools) -- Official tool spec

### Google Workspace APIs (MEDIUM confidence)
- [Google Workspace Developer Products](https://developers.google.com/workspace/products) -- Available APIs
- [Google Drive API: File Metadata](https://developers.google.com/workspace/drive/api/guides/file-metadata) -- viewedByMeTime, modifiedByMeTime
- [Google Drive Activity API](https://developers.google.com/workspace/drive/activity/v2) -- Activity tracking
- [Google Reports API Overview](https://developers.google.com/workspace/admin/reports/v1/get-start/overview) -- Org-level activity
- [Google OAuth2 Scopes](https://developers.google.com/identity/protocols/oauth2/scopes) -- Scope classification
- [Google Sensitive Scope Verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification) -- Verification requirements

### Loom Integration (HIGH confidence)
- [Loom Embed SDK: Getting Started](https://dev.loom.com/docs/embed-sdk/getting-started) -- Installation, methods
- [Loom Embed SDK: API Reference](https://dev.loom.com/docs/embed-sdk/api) -- oembed(), linkReplace(), textReplace()
- [Loom: Understanding Embedding](https://support.atlassian.com/loom/docs/understand-embedding-videos-gifs-and-thumbnails/) -- Embedding patterns
- [Userpilot: Embed Loom in SaaS](https://userpilot.com/blog/embed-loom-video/) -- SaaS integration patterns

### Visibility & Approval Patterns (HIGH confidence)
- [RBAC Overview: osohq.com](https://www.osohq.com/learn/rbac-role-based-access-control) -- Role-based access patterns
- [ButterCMS: Content Approval Process](https://buttercms.com/blog/establish-content-approval-process/) -- Enterprise approval workflows
- [Wrike: Approval Workflow Guide](https://www.wrike.com/workflow-guide/approval-workflow/) -- Linear/parallel approval patterns

### AI Config Sync (MEDIUM confidence)
- [dot-claude: Multi-AI Rule Sync](https://github.com/CsHeng/dot-claude) -- Claude/Codex/Cursor sync
- [Claudius: AI Config Management](https://github.com/cariandrum22/claudius) -- Multi-agent configuration
- [kaush.io: Keep AGENTS.md in Sync](https://kau.sh/blog/agents-md/) -- One source of truth pattern
- [Claude Code Settings Docs](https://code.claude.com/docs/en/settings) -- CLAUDE.md structure

### Marketplace Homepage Design (HIGH confidence)
- [Rigby: Marketplace UX Design Guide](https://www.rigbyjs.com/blog/marketplace-ux) -- Feature-by-feature UX guide
- [Qubstudio: Marketplace UI/UX Best Practices](https://qubstudio.com/blog/marketplace-ui-ux-design-best-practices-and-features/) -- Cards, search, categories
- [Excited Agency: Marketplace UX Best Practices](https://excited.agency/blog/marketplace-ux-design/) -- Hero section, navigation

### Existing Codebase (HIGH confidence)
- `packages/db/src/schema/skills.ts` -- Skills schema with status lifecycle, searchVector, visibility extension point
- `packages/db/src/schema/skill-embeddings.ts` -- pgvector 768-dim embeddings, HNSW index
- `packages/db/src/services/skill-status.ts` -- 7-status state machine, VALID_TRANSITIONS, canTransition()
- `apps/web/lib/search-skills.ts` -- Full-text + ILIKE + quality scoring search
- `apps/web/lib/similar-skills.ts` -- Semantic similarity via pgvector cosine distance
- `apps/web/components/search-with-dropdown.tsx` -- Current search with debounced quick-search dropdown
- `apps/web/app/(protected)/page.tsx` -- Current homepage (metrics-first layout)
- `apps/mcp/src/tools/search.ts` -- MCP search with text matching
- `apps/mcp/src/tools/recommend.ts` -- MCP semantic search with embedding fallback
- `apps/web/lib/admin.ts` -- isAdmin() authorization check

---

*Feature research for: EverySkill v3.0 AI Discovery & Workflow Intelligence*
*Researched: 2026-02-13*
*Confidence: HIGH for visibility scoping, Loom integration, homepage redesign, MCP tool (established patterns + existing infrastructure). MEDIUM for intent search and preference extraction (requires prompt engineering and validation). LOW-MEDIUM for Google Workspace diagnostic (unvalidated value proposition, OAuth verification blocker, privacy concerns).*

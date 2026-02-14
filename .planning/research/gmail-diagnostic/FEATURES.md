# Feature Landscape: Gmail Workflow Diagnostic

**Domain:** Email pattern analysis with AI-powered skill recommendations for enterprise skill marketplace
**Researched:** 2026-02-14
**Overall confidence:** MEDIUM-HIGH (Gmail API capabilities well-documented; email categorization from headers is proven; skill-matching is novel but leverages existing infrastructure)

## Context

EverySkill is an enterprise skill marketplace (Next.js 16.1.6, PostgreSQL, Auth.js v5 with Google OAuth). Users already sign in with Google Workspace SSO. The platform tracks skills with `hoursSaved`, `activitiesSaved`, and `category` fields. Existing `discoverSkills` uses semantic + full-text hybrid search. The My Leverage page already tracks FTE Days Saved per user.

The Gmail Workflow Diagnostic adds a "screentime for email" feature: connect Gmail, analyze email patterns over 90 days, categorize where time goes, and recommend EverySkill skills to automate repetitive email work. Raw email data is analyzed and discarded -- only aggregated results and recommendations are persisted.

**Key constraint:** Users already have Google OAuth for SSO. Gmail access requires requesting an additional `gmail.metadata` scope via incremental authorization. Auth.js v5 does not natively support incremental scope requests, so Gmail connect must be a custom OAuth flow separate from the sign-in provider.

---

## Table Stakes

Features users expect from any email analysis / time-audit tool. Missing any of these means the diagnostic feels broken or untrustworthy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **One-click Gmail connect** | Every email analytics tool (EmailMeter, EmailAnalytics, timetoreply) provides instant OAuth connect. Users will not tolerate manual setup or copy-pasting tokens. | Medium | Requires a **custom OAuth route** (`/api/gmail/connect` + `/api/gmail/callback`) separate from Auth.js sign-in. Must use same Google OAuth client ID. Request `gmail.metadata` scope with `include_granted_scopes=true`. Store Gmail tokens in a new `gmail_connections` table (not the Auth.js `accounts` table, to avoid coupling). |
| **Privacy-first consent flow** | Enterprise users are deeply sensitive about employer reading their email. GDPR data minimization principle applies. Without explicit, transparent privacy messaging, users will not connect. | Low | Pre-consent explainer screen before OAuth redirect. Must communicate: (1) "We read email headers only -- never email bodies or attachments," (2) "Data is analyzed and immediately discarded -- only summary statistics are saved," (3) "You can disconnect anytime." This is UX copy, not engineering, but it is mission-critical for adoption. |
| **Email volume summary** | The first question every user asks: "How many emails do I get?" Industry benchmark: 117-121 emails/day for office workers. EmailMeter and EmailAnalytics both lead with volume stats. | Low | Gmail API `messages.list` returns message IDs with pagination (up to 500 per page). Count by day/week using Date header from metadata. Note: `q` search parameter not supported with `gmail.metadata` scope -- must paginate all messages and filter by Date header server-side. |
| **Time-spent estimation** | The core promise of a "screentime for email" view. Users expect: "You spend approximately X hours/week on email." EmailMeter, RescueTime, and Reclaim all provide this metric. | Medium | Gmail API provides no "time spent reading" metric. Must be **estimated** from metadata signals: email volume per category, thread depth (via References header count), whether user replied (SENT label + In-Reply-To match). Transparent methodology is essential -- display "Estimated based on volume, thread depth, and response patterns" to maintain trust. See Time Estimation Model below. |
| **Email categorization breakdown** | Users expect to see where their time goes. Only ~10% of work email is business-critical per industry data. Categories like newsletters, notifications, internal threads, and action items are expected. | Medium | Header-based AI classification. Key signals: `List-Unsubscribe` header (newsletters), `noreply@` / `notifications@` senders (notifications), `In-Reply-To` + same domain (internal threads), subject patterns like "action required" / "please review" (action items). No email body access needed. See Categorization Strategy below. |
| **Visual dashboard** | Every competitor (EmailMeter, EmailAnalytics, Gmelius) shows charts. Users expect: donut/pie chart for category breakdown, bar chart for volume trends, prominent KPI cards. | Medium | Use Recharts (standard in Next.js ecosystem). Layout follows dashboard design best practices: hero KPI cards at top (total emails, estimated hours, biggest opportunity), category donut chart in middle, detailed breakdown table at bottom. Consistent with existing EverySkill analytics page styling. |
| **Skill recommendations** | This is the entire value proposition -- the bridge from "you spend too much time on email" to "here are skills that fix it." Without recommendations, this is just another analytics dashboard. | High | Maps email categories to existing skill categories and `activitiesSaved` field. Uses existing `discoverSkills` hybrid search for semantic matching. Each recommendation includes: skill name, estimated time savings, match rationale, install CTA. |
| **Explicit "Run Diagnostic" action** | Users expect to explicitly trigger the scan, not have it run automatically. This respects user agency and avoids the feeling of surveillance. | Low | Button-triggered action, not automatic. Shows progress: "Scanning last 90 days... Analyzing patterns..." Clear start and end. No background polling or continuous monitoring. |
| **Disconnect / revoke access** | Users must be able to revoke Gmail access at any time. Google OAuth best practices require this. | Low | "Disconnect Gmail" button that revokes the refresh token via Google's revoke endpoint and deletes the stored `gmail_connections` record. Also deletes any stored diagnostic reports for that user. |

---

## Differentiators

Features that set EverySkill's diagnostic apart from generic email analytics tools like EmailMeter or timetoreply. Not expected, but create the unique value proposition.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Deployment plan with sequenced skill rollout** | No email analytics tool tells you *what to do about it*. EverySkill uniquely maps email waste to specific automatable skills, then sequences them by ROI. "Start with Skill A (saves 3 hrs/wk), then add Skill B (saves 1.5 hrs/wk)." | High | Scoring algorithm: `recommendation_score = category_time_percent * skill_hoursSaved * relevance_score`. Order by highest ROI first. Present as numbered steps with cumulative time savings graph. Each step links to skill install. |
| **FTE Days Saved projection** | Ties directly into EverySkill's existing core metric. "If you deploy these 5 skills, you will recover 1.2 FTE days/month." Connects diagnostic output to the platform's value tracking. | Medium | Calculation: sum of (skill `hoursSaved` * estimated weekly uses) converted to FTE days (8 hrs/day). Projection displayed on diagnostic results AND linked to existing My Leverage page. |
| **Ephemeral analysis (analyze-and-discard)** | Unlike EmailMeter or timetoreply which store ongoing data, EverySkill runs a one-time diagnostic scan. Raw email metadata is never persisted -- only aggregated DiagnosticReport is saved. This is a genuine privacy differentiator in the enterprise market. | Medium | Architecture: fetch metadata via Gmail API in a server-side job, compute aggregates in memory, store only the final DiagnosticReport (category percentages, volume stats, recommendations, scan date). Delete all raw metadata from memory immediately after aggregation. |
| **Re-run comparison (before/after)** | "Run the diagnostic again in 30 days to see improvement." Shows impact of deploying recommended skills. Creates a virtuous loop: diagnose, deploy skills, measure improvement, deploy more. | Low | Store timestamped DiagnosticReport snapshots (already aggregated, no raw data). Simple delta comparison: "Newsletter time down 40% since you deployed the Email Summarizer skill." |
| **One-click skill install from recommendations** | From the diagnostic results, user can install a recommended skill without navigating away. Reduces friction from insight to action. | Low | Existing skill install flow triggered as a CTA button in recommendation cards. Can link to `/skills/[slug]` or embed the install action directly. Existing infrastructure supports this. |
| **"Biggest opportunity" highlight** | Instead of overwhelming users with data, highlight the single biggest time savings opportunity: "Your biggest opportunity: 35% of your email time goes to newsletters. The Email Digest Skill could save you 3.5 hours/week." | Low | Simple: find the category with highest time allocation that has matching skills. Present as a hero card above the detailed breakdown. Creates a clear call to action. |
| **Email pattern insights** | Beyond categories, surface behavioral patterns: "You reply to 73% of emails within 2 hours," "Your busiest email hour is 9-10am," "You receive 40% more email on Mondays." Similar to Microsoft Viva Insights for Outlook. | Medium | Derived from metadata timestamps (Date header), SENT label correlation, and thread analysis. Interesting but secondary to the core recommendation flow. |

---

## Anti-Features

Features to explicitly NOT build. These would create scope creep, privacy risk, or maintenance burden.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Reading email body content** | Requires `gmail.readonly` scope (even more restricted than `gmail.metadata`). Triggers full Google CASA security assessment with annual re-verification. Users will not trust it. Unnecessary -- header-based categorization achieves sufficient accuracy for the categories we need. | Use `gmail.metadata` scope only. Classify from: From domain, Subject patterns, List-Unsubscribe header, In-Reply-To chains, label assignments. |
| **Ongoing email monitoring / continuous sync** | Continuous access requires persistent refresh token polling, creates data retention liability, and feels like surveillance. Users expect a diagnostic (point-in-time), not monitoring. | One-time scan model. User explicitly triggers "Run Diagnostic." Results are a snapshot. User can re-run manually (suggest 30-day intervals). |
| **Email sending or modification** | Any write capability would destroy user trust and require higher security review. There is zero business reason for EverySkill to modify email. | Never request `gmail.compose`, `gmail.modify`, `gmail.insert`, or `gmail.send` scopes. Read metadata only. |
| **Individual employee dashboards for managers** | Privacy nightmare. Managers seeing individual email patterns creates surveillance culture, even with anonymization. Employment law in many jurisdictions restricts this. | Self-service only: each user sees only their own data. Admin aggregate view (future) shows anonymized department-level trends with explicit opt-in. |
| **Calendar + Drive integration in this milestone** | The v3 ideas mention all three Workspace connectors. Adding Calendar and Drive triples the OAuth complexity, scope verification burden, and UI surface. Each connector is its own milestone. | Build Gmail connector first as the reusable pattern. Calendar and Drive connectors follow the same incremental auth architecture in future milestones. Explicitly communicate this: "Gmail diagnostic now. Calendar diagnostic coming soon." |
| **Custom email rules or filters** | Email filtering is Gmail's core feature. Duplicating it adds no value and creates maintenance burden. | If categorization reveals "35% of email is newsletters," link to Gmail's native filter settings: "Tip: Create a Gmail filter to auto-archive newsletters." |
| **Real-time notifications about email patterns** | Push notifications about email patterns add noise. The diagnostic is a periodic reflection tool, not a real-time alert system. | Results available on-demand. Optional: single notification after scan completes ("Your diagnostic results are ready"). |
| **Team-level aggregate view in v1** | Significant privacy, consent, and opt-in design work. Requires anonymization guarantees, minimum group sizes, and admin consent flow. | Build after individual diagnostic proves value. Separate milestone with proper privacy design. |
| **Storing raw email metadata** | Storing From addresses, Subject lines, or message headers creates a data liability (PII, GDPR subject access requests, breach notification obligations). | Process in memory, store only aggregated counts and percentages. The DiagnosticReport contains: "Newsletters: 35%, 340 emails, ~3.5 hrs/wk" -- not individual message data. |
| **Contact name or email display** | Showing "john@company.com emails you 47 times/week" is creepy even if technically possible. Identifying specific senders creates interpersonal tension. | Report anonymized patterns: "Your top 5 correspondents account for 60% of thread volume." No names, no email addresses in stored reports. |
| **Auto-responding or auto-drafting email** | Suggesting EverySkill write or send email on the user's behalf crosses a trust boundary. One bad auto-reply destroys credibility. | Recommend skills for manual use. "Use the Status Update Drafter skill to write weekly updates faster." The user composes and sends, never EverySkill. |

---

## Feature Dependencies

```
Existing Infrastructure Required:
  - Google OAuth (Auth.js v5 Google provider) -- extends with incremental gmail.metadata scope
  - Skills table with: category, hoursSaved, activitiesSaved, slug -- used by matching engine
  - discoverSkills() hybrid search -- reused for semantic skill matching
  - My Leverage page + FTE Days Saved metric -- projection integrates here
  - User preferences (preferredCategories) -- personalizes recommendations

New Infrastructure:
  Gmail OAuth Connect ---------> Email Metadata Fetch ---------> Email Categorization
        |                              |                               |
  gmail_connections table        Gmail API batch calls          Rule-based pass (fast)
  Custom OAuth route             90-day lookback                + AI classification pass
  Token encryption               In-memory processing           (Claude Haiku for ambiguous)
                                       |
                                 Time Estimation
                                       |
                            +----------+----------+
                            v                     v
                  Diagnostic Dashboard    Skill Matching Engine
                  (KPI cards + charts)    (category + semantic match)
                            |                     |
                            +----------+----------+
                                       v
                            Diagnostic Report (persisted)
                            - Category breakdowns (JSONB)
                            - Time estimates
                            - Ranked recommendations (JSONB)
                            - Scan metadata
                                       |
                                 +-----+------+
                                 v            v
                       Deployment Plan    FTE Projection
                       (sequenced steps)  (connects to My Leverage)
```

### Dependencies on Existing Features

| Existing Feature | How Diagnostic Uses It | Modification Needed |
|-----------------|----------------------|-------------------|
| Google OAuth (Auth.js) | Same Google client ID for Gmail scope | None -- custom route shares credentials |
| Skills table (`category`, `hoursSaved`, `activitiesSaved`) | Matching engine uses these to find relevant skills and estimate time savings | None -- read-only access |
| `discoverSkills()` hybrid search | Semantic matching of email categories to skill descriptions | None -- called as-is with generated queries |
| My Leverage page | FTE Days Saved projection links to existing tracking | Minor -- add "Projected savings from diagnostic" card |
| User preferences (`preferredCategories`) | Boost recommendations matching user preferences | None -- read-only access |
| Notification system | "Your diagnostic results are ready" notification | Minor -- add new notification type |

### New Schema Required

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `gmail_connections` | Stores encrypted Gmail OAuth tokens per user | `userId` (FK), `accessToken` (encrypted), `refreshToken` (encrypted), `expiresAt`, `connectedAt`, `scopes`, `tenantId` (FK) |
| `diagnostic_reports` | Stores aggregated analysis results (no raw email data) | `userId` (FK), `tenantId` (FK), `scanDate`, `scanPeriodDays`, `totalEmails`, `estimatedHoursPerWeek`, `categoryBreakdown` (JSONB), `recommendations` (JSONB), `patternInsights` (JSONB) |

---

## User Journey Map

### Step 1: Discover the Diagnostic

**Entry points:**
- Homepage card: "Discover where your email time goes" (new CTA card)
- My Leverage page: "Run Email Diagnostic" button (complements existing FTE tracking)
- Navigation: `/diagnostic` route in sidebar or top nav

### Step 2: Privacy Explainer + Connect

**Page: `/diagnostic` (not yet connected)**

```
+---------------------------------------------------+
|  Email Workflow Diagnostic                         |
|                                                    |
|  Discover where your email time goes and which     |
|  skills can save you hours every week.             |
|                                                    |
|  +-----------------------------------------------+|
|  |  How it works:                                ||
|  |                                               ||
|  |  1. We scan your last 90 days of email        ||
|  |     headers (sender, subject, date)           ||
|  |                                               ||
|  |  2. We categorize your email patterns         ||
|  |     (newsletters, meetings, action items)     ||
|  |                                               ||
|  |  3. We estimate where your time goes and      ||
|  |     recommend skills to save time             ||
|  |                                               ||
|  |  Privacy:                                     ||
|  |  - We never read email content or attachments ||
|  |  - Raw data is analyzed and immediately       ||
|  |    discarded                                  ||
|  |  - Only summary statistics are saved          ||
|  |  - You can disconnect anytime                 ||
|  +-----------------------------------------------+|
|                                                    |
|  [ Connect Gmail ]                                 |
|                                                    |
+---------------------------------------------------+
```

**Technical flow:**
1. User clicks "Connect Gmail"
2. Redirect to `/api/gmail/connect` which builds Google OAuth URL with `scope=https://www.googleapis.com/auth/gmail.metadata` and `include_granted_scopes=true`
3. Google consent screen shows: "EverySkill wants to view your email message metadata"
4. On approval, callback at `/api/gmail/callback` receives auth code, exchanges for tokens
5. Store encrypted tokens in `gmail_connections` table
6. Redirect back to `/diagnostic` with connected state
7. **Handle partial grant:** If user denies Gmail scope, show: "Gmail access is needed for the diagnostic. Your EverySkill account is not affected."

### Step 3: Run Diagnostic

**Page: `/diagnostic` (connected, not yet scanned)**

User sees Gmail connected status with their email address. Clicks "Run Diagnostic" to trigger the scan. Progress indicator shows stages: "Scanning emails... Analyzing patterns... Generating recommendations..."

**Technical flow:**
1. User clicks "Run Diagnostic"
2. Server action triggers background processing
3. Backend: Refresh access token if expired, fetch messages via Gmail API (batched, 50 per batch), classify in memory, compute aggregates, match skills, save DiagnosticReport, clear raw data from memory
4. Typical scan: 30-90 seconds for 90 days (3,000-10,000 messages)
5. On completion: render results view

### Step 4: Review Results

**Page: `/diagnostic` (results available)**

Dashboard layout top to bottom:
1. **Hero KPI cards:** Emails per day (~85), Hours per week on email (~8.5), Biggest opportunity statement
2. **Category breakdown:** Donut chart showing time allocation -- Newsletters (35%), Notifications (25%), Internal threads (20%), Action items (15%), Other (5%). Each segment shows email count and estimated weekly hours.
3. **Recommended Skills:** Top 3-5 skill cards with name, category match, estimated time savings, match rationale, and Install/Learn More CTAs.
4. **View Full Deployment Plan** button expands to sequenced rollout view.
5. **Re-run Diagnostic** button with last scan date.

### Step 5: Deployment Plan

**Page: `/diagnostic/plan` (expanded view)**

Sequenced rollout showing:
1. Cumulative savings chart (stacked bar showing total saved after each step)
2. Ordered steps: Step 1 (highest impact first) through Step N
3. Each step: skill name, estimated savings, category, match rationale, Install CTA
4. Total FTE Days Saved projection at bottom
5. "Re-run in 30 days to measure improvement" nudge

---

## Gmail API Implementation Details

### Scope: `gmail.metadata` (RESTRICTED)

**What it provides:**
- Email headers: From, To, Cc, Subject, Date, In-Reply-To, References, List-Unsubscribe, Message-ID, X-Mailer, Precedence
- Labels: INBOX, SENT, SPAM, TRASH, DRAFT, CATEGORY_PROMOTIONS, CATEGORY_SOCIAL, CATEGORY_UPDATES, CATEGORY_FORUMS, CATEGORY_PERSONAL, plus custom labels
- Thread IDs for grouping conversations
- Message IDs for counting and deduplication

**What it does NOT provide:**
- Email body content (HTML or plain text)
- Attachments
- Search queries (`q` parameter) -- cannot use Gmail search with metadata scope

**Verification requirement:** RESTRICTED scope. Public apps require Google OAuth verification + CASA security assessment (annual). For **enterprise-internal deployment** (Google Workspace admin configures app access), the admin can approve the app for their domain via Admin Console > Security > API Controls, bypassing public verification. This is the expected deployment path for EverySkill.

### Rate Limits (post-2025)

| Operation | Quota Units | Notes |
|-----------|-------------|-------|
| `messages.list` | 1 unit/call | Returns up to 500 message IDs per page |
| `messages.get` (metadata format) | 1 unit/call | Returns headers + labels only |
| Batch request | Sum of individual calls | Max 50 calls per batch (recommended) |
| Per-project daily quota | ~250M units | Post-2025 reduction (10x lower cost per call) |

**Scanning 10,000 messages:** ~20 list calls (500 IDs/page) + 10,000 get calls (batched at 50 = 200 batches) = ~10,020 quota units. Well within daily limits.

**Estimated scan time:** At ~200ms per batch, 200 batches = ~40 seconds. Add AI classification time (~20-30 seconds for ambiguous emails). Total: ~60-90 seconds for a full scan. Display progress bar with stage indicators.

### Incremental OAuth Architecture

```
Existing flow (Auth.js v5):
  Sign In -> Google OAuth -> openid + email + profile scopes -> JWT session

New Gmail flow (custom):
  Connect Gmail -> /api/gmail/connect -> Google OAuth -> gmail.metadata scope
                                          (include_granted_scopes=true)
               -> /api/gmail/callback -> Exchange code for tokens
               -> Encrypt and store in gmail_connections table
               -> Redirect to /diagnostic

Token lifecycle:
  Access token: 1 hour expiry -> refresh before each scan
  Refresh token: Long-lived -> stored encrypted in DB
  Revocation: User clicks "Disconnect" -> POST to accounts.google.com/o/oauth2/revoke
```

**Why a custom route instead of Auth.js:** Auth.js v5 does not support requesting additional scopes after initial sign-in. The `signIn()` function triggers the full OAuth flow with the provider's configured scopes. Adding `gmail.metadata` to the Google provider would require all users to grant Gmail access on every sign-in, even those who never use the diagnostic. A custom OAuth route allows opt-in, incremental authorization while sharing the same Google OAuth client credentials.

---

## Email Categorization Strategy

### Header-Based Classification

| Category | Detection Signals (headers only) | Time Weight | Confidence |
|----------|----------------------------------|-------------|------------|
| **Newsletters** | `List-Unsubscribe` header present; `Precedence: bulk` or `Precedence: list`; From matches known newsletter patterns (substack.com, mailchimp.com domains); Gmail `CATEGORY_PROMOTIONS` label | Low (~0.5 min/email) | HIGH -- List-Unsubscribe is definitive |
| **Automated Notifications** | From contains `noreply@`, `notifications@`, `alerts@`, `mailer-daemon@`; `X-Auto-Response-Suppress` header present; Machine-generated Message-ID patterns; Gmail `CATEGORY_UPDATES` label | Low (~0.25 min/email) | HIGH -- sender patterns are reliable |
| **Meeting-related** | Subject contains: "invite", "accepted", "declined", "updated invitation", "agenda", "minutes"; From contains calendar domains (calendar-notification@google.com); `Content-Type: text/calendar` in outer headers | Medium (~1.5 min/email) | HIGH -- calendar email patterns are distinctive |
| **Internal threads** | From domain matches user's domain; `In-Reply-To` header present (reply chain); Multiple recipients on Cc | High (~3 min/email) | HIGH -- domain matching is definitive |
| **External threads** | From domain differs from user's domain; `In-Reply-To` present; Not a newsletter or notification | High (~4 min/email) | HIGH -- inverse of internal + not automated |
| **Action-required** | Subject patterns: "action required", "please review", "approval needed", "sign off", "deadline", "urgent", "RSVP"; Short thread (new request, no In-Reply-To); From domain is internal | Highest (~5 min/email) | MEDIUM -- subject matching has false positives. AI pass improves accuracy. |
| **FYI / Informational** | User is in Cc only (not in To); Large Cc list (5+); Subject contains "FYI", "for your information" | Low (~0.5 min/email) | MEDIUM -- Cc-only heuristic is imperfect |

### Classification Implementation

**Two-pass approach:**

1. **Rule-based pass (fast, no API calls):** Apply header-matching rules above. Catches ~70% of emails with HIGH confidence (newsletters via List-Unsubscribe, notifications via noreply@ senders, meeting emails via calendar headers, internal/external via domain matching).

2. **AI classification pass (for ambiguous emails):** For the remaining ~30% that do not match clear rules, send Subject + From + To headers to Anthropic Claude Haiku with a classification prompt. Batch 50 email header sets per API call to minimize latency and cost.

**Cost estimate for AI pass:** 30% of 10,000 emails = 3,000 emails. At 50 per batch = 60 API calls. At ~$0.003/call (Claude Haiku) = ~$0.18 per diagnostic scan. Negligible.

### Time Estimation Model

```
estimated_minutes_per_email(category, thread_depth, user_replied) =
  base_time[category] * thread_factor(thread_depth) * reply_factor(user_replied)

base_time = {
  newsletter: 0.5,       // scan subject, maybe skim
  notification: 0.25,    // glance and dismiss
  meeting_related: 1.5,  // read invite, check calendar, maybe respond
  internal_thread: 3.0,  // read context, compose thoughtful reply
  external_thread: 4.0,  // more careful composition for external audience
  action_required: 5.0,  // read, analyze, compose response, follow up
  fyi: 0.5               // scan and archive
}

thread_factor(depth) = 1.0 + (0.1 * min(depth, 10))
  // Longer threads require more reading, caps at 2x for 10+ message threads

reply_factor(replied) = 1.5 if user sent a reply in thread, else 1.0
  // Composing a reply adds ~50% more time

weekly_hours = sum_over_categories(
  count[category] * estimated_minutes(category, avg_thread_depth, reply_rate)
) / 60 / (scan_period_days / 7)
```

**Calibration:** This model produces estimates of 5-15 hours/week for typical office workers, consistent with industry benchmarks (McKinsey: 28% of workweek ~= 11 hours; Workplace Email Statistics 2025: 5-15.5 hours). The methodology should be transparent and displayed to users: "Estimated based on email volume, thread depth, and response patterns."

---

## Skill Matching Strategy

### Email Category to Skill Mapping

| Email Time Sink | Automatable With | Skill Category | Example Skill Types |
|-----------------|------------------|----------------|---------------------|
| Newsletter overload (high % of time) | Summarization, digest creation, batch processing | productivity | Email digest summarizer, weekly reading roundup |
| Notification noise | Filtering, routing, alert consolidation | wiring | Notification router, alert aggregator |
| Meeting prep/follow-up | Agenda generation, meeting notes, action item extraction | productivity, doc-production | Meeting prep automator, meeting notes generator |
| Internal thread time | Status update drafting, reply templates, thread summarization | doc-production, productivity | Status update drafter, thread summarizer |
| External communication | Client email drafting, proposal templates | doc-production | Client communication drafter, proposal template |
| Action item management | Task extraction, deadline tracking, approval workflows | wiring, productivity | Task extractor, approval workflow automator |

### Matching Algorithm

1. **Category-based match:** For each email category taking >10% of time, find skills in the corresponding skill categories (see mapping above)
2. **Activity-based match:** Compare email category descriptions against skill `activitiesSaved` arrays using text overlap
3. **Semantic match (enhancement):** Use existing `discoverSkills()` with auto-generated queries. For example, if newsletters = 35%, generate query: "automate newsletter summarization and email digest creation"
4. **Score and rank:**
   ```
   recommendation_score = time_saveable_percent * skill_hoursSaved * relevance_score * adoption_factor

   time_saveable_percent = how much of email time this category represents
   skill_hoursSaved = from skills table (estimated hours saved per use)
   relevance_score = 1.0 for exact category match, 0.7 for semantic, 0.5 for adjacent
   adoption_factor = 1.0 + (0.1 * log(skill.totalUses + 1))  // popular skills rank higher
   ```
5. **Deduplicate and limit:** Top 5-8 recommendations. No duplicate skills. At least one recommendation per high-time category.

---

## MVP Recommendation

### Phase 1: Core Diagnostic (build first)

1. **Gmail OAuth connect** with privacy-first consent flow
   - Custom OAuth route (`/api/gmail/connect`, `/api/gmail/callback`)
   - `gmail_connections` table with encrypted tokens
   - Disconnect/revoke functionality

2. **Email metadata fetch** with 90-day lookback
   - Batched Gmail API calls (50/batch)
   - In-memory processing only
   - Progress indicator during scan

3. **Header-based email categorization**
   - Rule-based pass for clear signals (List-Unsubscribe, noreply@, domain matching)
   - AI classification pass for ambiguous emails (Claude Haiku)

4. **Time estimation** with transparent methodology
   - Category-weighted model with thread depth and reply factors
   - Display "Estimated based on volume and response patterns"

5. **Visual dashboard** with hero KPIs + category donut chart
   - Recharts for visualization
   - Consistent with existing EverySkill analytics styling

6. **Basic skill recommendations** via category matching
   - Map email categories to skill categories
   - Top 3-5 recommendations with rationale and install CTA

### Phase 2: Deployment Intelligence (build second)

1. **Deployment plan** with sequenced rollout and cumulative savings graph
2. **FTE Days Saved projection** connected to My Leverage page
3. **One-click skill install** from recommendation cards
4. **Re-run comparison** (before/after delta view)
5. **"Biggest opportunity" highlight** card

### Defer to Future Milestones

- **Team-level aggregate view:** Requires privacy design, opt-in flow, anonymization. Separate milestone.
- **Calendar + Drive connectors:** Same OAuth pattern, separate data sources. Separate milestones.
- **Email pattern insights:** Behavioral analytics (busiest hour, response time). Nice-to-have enhancement.
- **Exportable report:** PDF/summary download. Low priority, add when users request it.
- **Historical trend graph:** Requires 3+ scans over time. Enable naturally after diagnostic is live for months.

---

## Sources

### Gmail API (HIGH confidence)
- [Gmail API Scopes](https://developers.google.com/workspace/gmail/api/auth/scopes) -- Scope definitions: gmail.metadata vs gmail.readonly, verification tiers
- [Gmail API Usage Limits](https://developers.google.com/workspace/gmail/api/reference/quota) -- Rate limits, quota units (post-2025 10x reduction)
- [Gmail API Batch Requests](https://developers.google.com/workspace/gmail/api/guides/batch) -- Batch structure, 50-request recommended limit
- [Gmail API messages.get](https://developers.google.com/gmail/api/reference/rest/v1/users.messages/get) -- Metadata format, metadataHeaders parameter

### Google OAuth (HIGH confidence)
- [Google Granular Permissions](https://developers.google.com/identity/protocols/oauth2/resources/granular-permissions) -- Handling partial scope grants
- [Google Incremental Authorization](https://developers.google.com/identity/sign-in/web/incremental-auth) -- Requesting additional scopes post-login
- [Restricted Scope Verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification) -- CASA security assessment
- [Domain-Wide Delegation](https://support.google.com/a/answer/162106?hl=en) -- Enterprise bypass for public verification

### Auth.js Integration (MEDIUM-HIGH confidence)
- [Auth.js Google Provider](https://authjs.dev/getting-started/providers/google) -- Provider config, scope options
- [NextAuth Incremental Scopes Discussion](https://github.com/nextauthjs/next-auth/discussions/4557) -- Community approaches (confirms custom route needed)
- [NextAuth Gmail Permissions Discussion](https://github.com/nextauthjs/next-auth/discussions/11819) -- Persisting additional scopes across logins

### Email Analytics Competitors (MEDIUM confidence)
- [Email Meter](https://www.emailmeter.com) -- Enterprise email analytics dashboard patterns
- [EmailAnalytics](https://emailanalytics.com/) -- Team email metrics and response time tracking
- [timetoreply](https://timetoreply.com/) -- Response time SLA tracking
- [9 Best Email Analytics Tools 2026](https://emailanalytics.com/email-analytics-tools) -- Competitive landscape

### Email Industry Data (MEDIUM confidence)
- [Email Industry Report 2025-2026](https://clean.email/blog/insights/email-industry-report-2026) -- Volume and category benchmarks
- [Workplace Email Statistics 2025](https://blog.cloudhq.net/workplace-email-statistics/) -- Time spent on email (5-15.5 hrs/wk)
- [How Much Time on Email (2025)](https://www.getinboxzero.com/blog/post/how-much-time-are-you-spending-on-email) -- Benchmark data
- [Email Productivity Guide 2026](https://www.getmailbird.com/ultimate-email-productivity-guide/) -- Only 10% of email is business-critical

### Dashboard Design (MEDIUM confidence)
- [Dashboard Design Patterns](https://dashboarddesignpatterns.github.io/) -- 42 formalized patterns for layout and composition
- [Dashboard UX Patterns](https://www.pencilandpaper.io/articles/ux-pattern-analysis-data-dashboards) -- Visual hierarchy, chart selection

### Privacy (MEDIUM confidence)
- [GDPR and Email](https://gdpr.eu/email-encryption/) -- Data minimization principles for email processing
- [GDPR Compliance for Email Tracking](https://www.warmforge.ai/blog/gdpr-compliance-for-email-tracking-tools) -- Retention policies, consent

---

*Feature research for: EverySkill Gmail Workflow Diagnostic*
*Researched: 2026-02-14*
*Confidence: HIGH for Gmail API capabilities and OAuth flow. HIGH for email categorization from headers (proven signals). MEDIUM for time estimation model (heuristic, not measurement -- transparent methodology is key). MEDIUM-HIGH for skill matching (leverages existing infrastructure; mapping logic is novel but straightforward). LOW for team aggregate view (deferred, requires separate privacy design).*

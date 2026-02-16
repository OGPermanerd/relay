# Feature Landscape: v7.0 Algorithm & Architecture Rewrite

**Domain:** AI skill marketplace -- graph intelligence, adaptive search routing, temporal awareness, graduated visibility, multi-model evaluation
**Researched:** 2026-02-16
**Overall confidence:** MEDIUM (GraphRAG community detection well-understood conceptually but novel for a skill corpus; RAGAS adaptation for skills is non-standard; adaptive routing has strong production patterns; temporal tracking has established UX precedents; visibility extension is straightforward)

## Context

EverySkill is at v6.0 with 68 phases shipped. The v7.0 milestone adds 5 algorithmic/architectural features that build on the existing hybrid search, benchmark, versioning, and preference infrastructure.

**Existing infrastructure being extended:**

| System | What Exists | What v7.0 Adds |
|--------|-------------|----------------|
| **Hybrid search** | Full-text (tsvector + websearch_to_tsquery) + semantic (pgvector 768d, nomic-embed-text via Ollama, HNSW index) + RRF merge | Adaptive query routing that classifies queries before choosing retrieval strategy |
| **Skill embeddings** | Per-skill 768d vectors in `skill_embeddings`, cosine distance with 0.5 threshold | Community detection via embedding clustering -- skills that are semantically close form "communities" |
| **Benchmarking** | Cross-model runs (Sonnet + Haiku), blinded AI judge (0-100 quality score), cost/latency tracking, `benchmark_runs` + `benchmark_results` tables | RAGAS-inspired metrics (faithfulness, relevancy, precision, recall) adapted for skill evaluation |
| **Versioning** | Immutable `skill_versions` with sequential version numbers, content hash, R2 storage, fork tracking with drift detection | Bi-temporal tracking: "what changed since you last used this skill" |
| **Visibility** | 2-level: `tenant` (org-visible) and `personal` (author-only), `buildVisibilityFilter()` with SQL helpers | 4-level: `global_approved` > `tenant` > `personal` > `private`, plus MCP preference sync |
| **User preferences** | `user_preferences` with JSONB: preferred categories, default sort, training consent, claude.md notes | MCP-synced preferences: preferences readable/writable from Claude Desktop/Code via MCP tools |
| **Search analytics** | `search_queries` table with normalized queries, zero-result detection, trending queries | Query classification metadata: what type of query was it, which routing strategy was used |

---

## Feature Area 1: GraphRAG Community Detection

### What Users Expect

When browsing "skill communities," users expect to see **thematic clusters of related skills** -- not a flat list. A community is a group of skills that share conceptual similarity: "All the code review skills," "All the documentation generation skills," "All the data pipeline skills." Users want to:

1. **Browse by community** instead of (or in addition to) category. Categories are author-assigned and often inconsistent. Communities are algorithmically discovered from the actual content.
2. **See a community summary** explaining what the cluster is about, what skills are in it, and why they belong together.
3. **Discover related skills** they would not have found through keyword search.

**Concrete user interaction:**

```
Discovery page (/discover):
  Existing: Category filter (5 fixed categories) + tag filter + search
  New: "Skill Communities" section showing discovered clusters

  Community card:
  +--------------------------------------------+
  | Code Quality & Review (12 skills)          |
  | Skills focused on code review, linting,    |
  | security scanning, and refactoring.        |
  | Top skills: Code Review Helper, Security   |
  | Audit, Refactor Assistant                  |
  | [Browse Community]                         |
  +--------------------------------------------+

  Community detail page (/communities/[id]):
  - Community name + AI-generated summary
  - List of member skills with similarity scores
  - "Related communities" sidebar
  - Community health: avg rating, total uses, update frequency
```

### Table Stakes

| Feature | Why Expected | Complexity | Depends On |
|---------|--------------|------------|------------|
| Embedding-based skill clustering | Foundation -- group skills by semantic similarity of their content | HIGH | Existing `skill_embeddings` (768d vectors) |
| Community name + summary generation | Users need human-readable labels, not cluster IDs | MEDIUM | LLM summarization (existing Anthropic SDK) |
| Community browsing page | Users must be able to explore communities visually | MEDIUM | New page + DB table for communities |
| Community membership persistence | Communities must be stored, not computed on every page load | LOW | New `skill_communities` + `skill_community_members` tables |
| Periodic re-clustering | As skills are added/updated, communities should update | MEDIUM | Cron job or on-publish trigger |

**How community detection works for EverySkill (adapted from Microsoft GraphRAG):**

Microsoft GraphRAG uses the Leiden algorithm for hierarchical community detection on knowledge graphs. EverySkill does not have a knowledge graph -- it has skill embeddings. The adaptation is:

1. **Build a similarity graph** from existing embeddings: for each skill, compute cosine similarity to all other skills. Create edges between skills with similarity > threshold (e.g., 0.65).
2. **Run community detection** on this similarity graph. The Leiden algorithm is the gold standard, but for a few hundred skills, even simple agglomerative clustering works. K-means on the embedding vectors is the pragmatic choice.
3. **Generate community summaries** by feeding the cluster's skill names, descriptions, and categories to an LLM with a structured prompt.
4. **Store results** in `skill_communities` (id, name, summary, member_count, centroid_embedding) and `skill_community_members` (community_id, skill_id, similarity_to_centroid).

**Why NOT full GraphRAG:**

Full GraphRAG extracts entities and relationships from documents, builds a knowledge graph, then runs Leiden on that graph. This is designed for unstructured document corpora where relationships are implicit. EverySkill skills already have structured metadata (name, description, category, tags) and dense vector representations. Building a knowledge graph from skill markdown would be over-engineering -- the embeddings already capture semantic relationships.

**Recommended approach: Embedding-based clustering, NOT graph-based.**

Use the existing 768d embeddings directly:
1. Fetch all skill embeddings from `skill_embeddings` table
2. Compute pairwise cosine similarity matrix
3. Apply agglomerative clustering (or K-means with elbow method) -- the `ml-kmeans` npm package handles this
4. For each cluster, generate a summary via Anthropic API
5. Store results in new tables
6. Re-run on a schedule (daily) or on skill publish events

**Scale consideration:** With a few hundred skills, this is trivially fast (sub-second for clustering). At 10K skills, pairwise similarity becomes O(n^2) -- switch to approximate methods or use pgvector's built-in distance queries to build a sparse similarity graph.

**Confidence:** MEDIUM. The clustering approach is well-understood. The novelty is applying it to skill embeddings (not documents), but the math is identical. The main risk is cluster quality -- skill descriptions may be too similar or too sparse to form meaningful communities.

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Hierarchical communities | Communities within communities (e.g., "Code Quality" contains "Security Review" and "Style Enforcement" sub-communities) | HIGH | Requires hierarchical clustering, multiple UI levels |
| Community health scores | "This community's skills average 4.2 stars and are used 150x/week" | LOW | Aggregation over existing skill metrics |
| Community evolution timeline | "3 new skills joined this community this month" | MEDIUM | Temporal tracking of community membership |
| Skill gap detection within community | "This community has no skills for Python -- consider creating one" | MEDIUM | Compare community topics to skill coverage |
| Community-aware search | Search within a community context for more relevant results | LOW | Filter search by community membership |

### Anti-Features

| Anti-Feature | Why Avoid | Do Instead |
|--------------|-----------|------------|
| User-created communities | Manual curation defeats the purpose of algorithmic discovery; duplicates the category system | Auto-discover communities from embeddings; let categories handle manual classification |
| Real-time clustering on every page load | O(n^2) computation on every request is wasteful and slow | Pre-compute clusters, store in DB, refresh on schedule |
| Full knowledge graph extraction | Extracting entities/relationships from skill markdown is overkill for a skill marketplace with structured metadata | Use existing embeddings for clustering; skills already have names, descriptions, tags |
| Community editing by users | Letting users reassign skills to communities undermines algorithmic integrity | Show "suggest reclassification" feedback, but communities are algorithm-driven |

---

## Feature Area 2: Adaptive Query Routing

### What Users Expect

Users do not know or care about query routing. They type a search query and expect the best results. What they notice is:

1. **Simple queries get fast answers**: "code review" should return results instantly using keyword matching.
2. **Complex queries get smart answers**: "skill that helps me review Python async code for race conditions and suggests fixes" should use semantic search to understand intent.
3. **Browsing queries get curated results**: Clicking a category or tag should show relevant skills without requiring a text query.
4. **No-result queries get help**: "I need something that doesn't exist" should suggest related skills or offer to create one.

**How this changes the current search path:**

```
CURRENT:
  User query → Ollama embedding → hybrid search (full-text + semantic) → RRF merge → preference boost → results

PROPOSED:
  User query → query classifier → routing decision:
    ├── KEYWORD route: full-text search only (fast, exact matching)
    ├── SEMANTIC route: embedding similarity only (intent understanding)
    ├── HYBRID route: full-text + semantic + RRF (current default)
    ├── BROWSE route: category/tag filter, no embedding needed
    └── COMMUNITY route: find relevant community, return its members
```

### Table Stakes

| Feature | Why Expected | Complexity | Depends On |
|---------|--------------|------------|------------|
| Query classification (keyword vs semantic vs hybrid) | Different queries need different retrieval strategies | MEDIUM | Classification logic (rule-based or LLM) |
| Fast path for simple queries | "code review" should not wait for Ollama embedding generation | LOW | Skip embedding when classifier says KEYWORD |
| Semantic path for natural language queries | "help me write better documentation" needs intent matching | LOW | Already exists -- current default path |
| Classification metadata logging | Track which route was used for analytics and optimization | LOW | Extend `search_queries.searchType` field |
| Graceful degradation | If Ollama is down, fall back to keyword-only silently | LOW | Already implemented (semantic search returns [] on failure) |

**Query classification strategies for a skill marketplace:**

Research shows three practical approaches, ordered by complexity:

**1. Rule-based classification (RECOMMENDED for MVP):**

```typescript
function classifyQuery(query: string): "keyword" | "semantic" | "hybrid" | "browse" {
  const words = query.trim().split(/\s+/);

  // Single word or exact phrase → keyword search
  if (words.length <= 2) return "keyword";

  // Category/tag names → browse
  const categories = ["productivity", "wiring", "doc-production", "data-viz", "code"];
  if (categories.includes(query.toLowerCase())) return "browse";

  // Natural language indicators → semantic
  const nlIndicators = /\b(help|how|what|find|suggest|recommend|like|similar|better)\b/i;
  if (nlIndicators.test(query)) return "semantic";

  // Questions → semantic
  if (query.endsWith("?")) return "semantic";

  // Default → hybrid (current behavior)
  return "hybrid";
}
```

**2. LLM-based classification (DEFER -- overkill for skill search):**

Using an LLM to classify every search query adds latency (even with Haiku) and cost. The rule-based approach handles 90%+ of skill marketplace queries correctly. Only consider LLM classification if query logs show the rule-based classifier making frequent errors.

**3. Learned classifier (DEFER -- requires training data):**

Training a classifier on query logs requires labeled data (which queries should have been keyword vs semantic). Build this after collecting classification metadata for a few months.

**Implementation path:**

The key optimization is **skipping embedding generation for keyword queries**. Currently, every query goes through `generateEmbedding()` which calls Ollama and takes 100-500ms. For simple keyword queries ("code review", "data viz"), full-text search is sufficient and near-instant.

```
Current latency: 100-500ms (Ollama) + 50ms (hybrid query) = 150-550ms
With routing:
  Keyword: 50ms (full-text only, skip Ollama)
  Semantic: 100-500ms (Ollama) + 50ms (semantic only)
  Hybrid: 150-550ms (unchanged, current path)
  Browse: 30ms (category filter, no search)
```

**How routing integrates with existing `searchSkills()`:**

The existing `searchSkills()` in `apps/web/lib/search-skills.ts` already supports both full-text and semantic paths. The semantic supplement (`getSemanticSkillIds()`) is additive -- it only fires when a query is present. Routing can be implemented by:

1. Adding a `route?: "keyword" | "semantic" | "hybrid" | "browse"` parameter to `SearchParams`
2. In `searchSkills()`, skipping the semantic supplement when `route === "keyword"`
3. In `searchSkills()`, skipping the full-text conditions when `route === "semantic"`
4. The caller (server action) runs the classifier and passes the route

**Confidence:** HIGH for rule-based routing. The existing search infrastructure already supports all three paths -- routing is about choosing which path to take, not building new paths. The latency improvement for keyword queries is measurable and meaningful.

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Query intent display | Show "Searched by: keyword match" or "Searched by: meaning" next to results | LOW | Transparency helps users understand results |
| Automatic fallback escalation | If keyword search returns 0 results, auto-retry with semantic | LOW | Already partially implemented (semantic supplements keyword) |
| Route performance tracking | Analytics showing which routes are fastest and most effective | LOW | Log route type in `search_queries` |
| Community-aware routing | "skills like X" queries route to the community containing skill X | MEDIUM | Requires Feature Area 1 (communities) |
| MCP-specific routing | MCP search tool uses different routing defaults (semantic-heavy) than web UI (hybrid) | LOW | Route override parameter |

### Anti-Features

| Anti-Feature | Why Avoid | Do Instead |
|--------------|-----------|------------|
| LLM-based query classification for every search | Adds 200-1000ms latency and cost per search; rule-based handles 90%+ correctly | Rule-based classifier; revisit after collecting query log data |
| User-selectable search mode dropdown | "Advanced search" UIs confuse users and are rarely used | Auto-classify and show the route taken as metadata |
| Reinforcement learning on routing | Requires massive query volume and labeled outcomes to train; premature for current scale | Log routing decisions; use data for manual rule tuning |
| Multi-index routing (separate Elasticsearch, pgvector, full-text indexes) | Over-architected for a PostgreSQL-native system; all search currently lives in Postgres | Keep everything in Postgres; pgvector + tsvector + routing is sufficient |

---

## Feature Area 3: Temporal / Bi-Temporal Tracking

### What Users Expect

Users want to know **"what changed since I last used/saw this skill?"** This is the Confluence "summarize changes" pattern applied to skills. Concrete expectations:

1. **Badge on skill cards**: "Updated" badge when a skill has been modified since the user last viewed it.
2. **Change summary on skill detail page**: "Since your last visit (3 days ago): description updated, 2 new training examples added, version bumped from v3 to v5."
3. **What's New feed**: Dashboard showing recently changed skills relevant to the user.
4. **Version diff**: Compare current version to "my last seen version."

**The two temporal dimensions (bi-temporal):**

| Dimension | What It Tracks | Existing Support | New Work |
|-----------|---------------|-----------------|----------|
| **Transaction time** (when the system recorded the change) | When a skill version was created, when content was updated | YES -- `skill_versions.createdAt`, `skills.updatedAt` | None |
| **Valid time** (when the user last interacted) | When a user last viewed, used, or acknowledged a skill | PARTIAL -- `usage_events.createdAt` tracks MCP usage, no "last viewed" tracking on web | New `user_skill_interactions` table |

**The missing piece is "last viewed" tracking.** The system knows when a skill was changed (transaction time) but not when a user last saw it (valid time). Without both, you cannot compute "what changed since you last looked."

### Table Stakes

| Feature | Why Expected | Complexity | Depends On |
|---------|--------------|------------|------------|
| User last-viewed tracking | Record when a user views a skill detail page | LOW | New `user_skill_interactions` table or lightweight tracking |
| "Updated" badge on skill cards | Visual indicator that a skill changed since user's last view | LOW | Compare `skills.updatedAt` to `user_skill_interactions.lastViewedAt` |
| Change summary on skill detail | "Since your last visit: description updated, version bumped" | MEDIUM | Version diff between user's last-seen version and current version |
| What's New feed on dashboard | List of recently changed skills the user has previously interacted with | MEDIUM | Query joining interactions + version changes |

**Concrete UX:**

```
Skill card (in search results or discovery):
  +--------------------------------------------+
  | Code Review Helper                [Updated] |  <-- badge when updatedAt > lastViewedAt
  | Reviews code for quality issues...          |
  | 4.5 stars | 145 uses | Code                |
  +--------------------------------------------+

Skill detail page (/skills/[slug]):
  +--------------------------------------------+
  | Code Review Helper                  v5     |
  |                                            |
  | [What changed since your last visit]       |
  | - Description updated (2 days ago)         |
  | - Version bumped: v3 -> v5                 |
  | - 2 new training examples added            |
  | - Average rating improved: 4.2 -> 4.5      |
  +--------------------------------------------+

Dashboard "What's New" widget:
  +--------------------------------------------+
  | What's New (since Feb 14)                  |
  | - Code Review Helper: description updated  |
  | - Data Viz Builder: new version (v3)       |
  | - API Wiring Helper: 5 new uses            |
  +--------------------------------------------+
```

**Data model:**

New `user_skill_interactions` table:
```sql
id TEXT PK
tenant_id TEXT NOT NULL FK tenants
user_id TEXT NOT NULL FK users
skill_id TEXT NOT NULL FK skills
last_viewed_at TIMESTAMP NOT NULL     -- when user last opened skill detail page
last_viewed_version INTEGER           -- version number at time of viewing
last_used_at TIMESTAMP                -- last MCP usage (from usage_events)
last_used_version INTEGER             -- version at time of usage
acknowledged_at TIMESTAMP             -- when user dismissed "what's new" badge
UNIQUE(tenant_id, user_id, skill_id)
```

**How change detection works:**

```typescript
// On skill detail page load:
const interaction = await getUserSkillInteraction(userId, skillId);
const skill = await getSkillBySlug(slug);

if (!interaction) {
  // First visit -- no "what's new" to show
  await createInteraction(userId, skillId, skill.publishedVersionId);
} else if (skill.updatedAt > interaction.lastViewedAt) {
  // Skill changed since last visit
  const changes = await computeChanges(
    interaction.lastViewedVersion,
    skill.publishedVersionId
  );
  // Show change summary
  await updateInteraction(userId, skillId, skill.publishedVersionId);
}
```

**Change types to detect:**

| Change Type | How Detected | Display |
|-------------|-------------|---------|
| Description changed | Compare version snapshots | "Description updated" |
| Version bumped | `lastViewedVersion < currentVersion` | "Version bumped: v3 -> v5" |
| New training examples | Count training_data rows since lastViewedAt | "2 new training examples" |
| Rating changed | Compare denormalized `averageRating` | "Rating improved: 4.2 -> 4.5" |
| New feedback | Count feedback rows since lastViewedAt | "3 new feedback items" |
| Benchmark results | New benchmark_runs since lastViewedAt | "New benchmark results available" |

**Why NOT full bi-temporal database design:**

True bi-temporal databases (like IBM DB2's temporal tables or PostgreSQL's temporal_tables extension) track both transaction time and valid time at the row level with period columns. This is overkill for EverySkill because:

1. Skills already have immutable version history (`skill_versions` table)
2. The "valid time" dimension is per-user, not per-row
3. We only need "what changed since X" -- not "what was the state at time T"

A lightweight interaction-tracking table solves the user-facing need without architectural complexity.

**Confidence:** HIGH for the "Updated" badge and change summary. The pattern is well-established (Confluence, Notion, GitHub all do this). The data model is simple. The main implementation work is computing diffs between version snapshots. MEDIUM for the "What's New" feed -- requires an efficient query joining interactions with skill changes across all of a user's interacted skills.

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| AI-generated change summary | LLM reads version diffs and produces "Here's what changed and why it matters" | MEDIUM | Like Confluence's Rovo "summarize changes" feature |
| Digest email/notification | "Weekly digest: 5 skills you use were updated" | MEDIUM | Cron + email (existing notification infrastructure) |
| Version diff viewer | Side-by-side comparison of skill content at two versions | HIGH | Markdown diff rendering component |
| Temporal search | "Show me skills updated in the last week" | LOW | Date filter on `skills.updatedAt` |
| Usage recency weighting | Recently-used skills appear higher in "What's New" | LOW | Weight by `last_used_at` recency |

### Anti-Features

| Anti-Feature | Why Avoid | Do Instead |
|--------------|-----------|------------|
| Full bi-temporal database schema | Massive migration, touches every table, adds columns and triggers system-wide | Lightweight interaction tracking table + version comparison |
| Real-time change notifications (WebSocket) | Over-engineering for a skill marketplace; users don't need instant updates | Badge on page load + "What's New" feed |
| Detailed field-level change tracking | Tracking every field change in skills (name, description, tags, etc.) requires audit log infrastructure | Compare version snapshots -- versions already capture name + description |
| "Subscribe to skill" feature | Notification fatigue for a content type (skills) that changes infrequently | Show changes passively via "Updated" badge; let users opt into digest |

---

## Feature Area 4: Extended Visibility (4-Level) + Preference Sync

### What Users Expect

**Graduated visibility:**

Users in enterprise environments expect content to have clear, escalating visibility levels. The current 2-level system (`tenant` = org-visible, `personal` = author-only) is insufficient for organizations that want:

1. **Global Approved**: Skills vetted and approved for use across all tenants. Think "company standard library."
2. **Tenant (Org)**: Skills visible to everyone in the organization. Current default.
3. **Personal**: Skills the author can see and use, but not visible to others. Current personal level.
4. **Private/Draft**: Skills in draft state, not even usable by the author via MCP (edit-only).

```
Visibility levels (most visible to least):

  global_approved   ──>  Visible to ALL tenants, admin-curated
       |
     tenant         ──>  Visible to everyone in the organization (current default)
       |
    personal        ──>  Visible only to the author (current personal)
       |
     private        ──>  Draft state, edit-only, not searchable or usable
```

**How this maps to existing approval flow:**

The current `companyApproved` boolean on skills already serves as a soft visibility modifier -- approved skills get a badge. Extending this to a 4-level visibility system replaces the boolean with a proper visibility enum that controls actual access:

| Current | New | Behavior Change |
|---------|-----|-----------------|
| `visibility: "tenant"` + `companyApproved: false` | `visibility: "tenant"` | Unchanged |
| `visibility: "tenant"` + `companyApproved: true` | `visibility: "global_approved"` | Now visible across tenants (cross-tenant access) |
| `visibility: "personal"` | `visibility: "personal"` | Unchanged |
| `status: "draft"` | `visibility: "private"` | Drafts become a visibility level, not a status |

**Cross-tenant visibility for `global_approved`:**

This is the most significant architectural change. Currently, RLS policies enforce `tenant_id = current_setting('app.current_tenant_id')`, which means skills are strictly tenant-scoped. `global_approved` skills need to be visible across tenants. Implementation options:

1. **Modify RLS policy** to include `OR visibility = 'global_approved'` -- cleanest but requires migration
2. **Dual query** -- query tenant skills normally, union with global skills separately
3. **Global tenant** -- create a "global" tenant that all users can see in addition to their own

Option 1 is recommended: extend the RLS policy to allow global_approved skills to pass tenant isolation.

**Confidence:** HIGH for the 4-level visibility enum and modified visibility filter. The existing `buildVisibilityFilter()` and `visibilitySQL()` functions are the only places visibility is enforced, so the change is well-scoped. MEDIUM for cross-tenant `global_approved` -- requires RLS policy changes and careful testing.

### Table Stakes

| Feature | Why Expected | Complexity | Depends On |
|---------|--------------|------------|------------|
| 4-level visibility enum | Replace 2-level with global_approved > tenant > personal > private | LOW | Schema migration: change `visibility` column values |
| Updated visibility filter | `buildVisibilityFilter()` handles 4 levels correctly | LOW | Existing `packages/db/src/lib/visibility.ts` |
| Visibility selector on skill create/edit | Author chooses visibility level when publishing | LOW | Existing form + new dropdown options |
| RLS policy update for global_approved | Global skills bypass tenant isolation for reads | MEDIUM | RLS policy migration |
| Admin-only global_approved setting | Only admins can promote skills to global | LOW | Role check on visibility change |

### MCP Preference Sync

**What users expect:**

Users who configure preferences in the web UI (preferred categories, default sort, claude.md workflow notes) expect those preferences to influence their MCP experience. Conversely, preferences set via Claude Desktop/Code (e.g., "I prefer code skills") should sync back to the web UI.

**Current state:**

- Web UI reads/writes `user_preferences.preferences` JSONB
- MCP tools do NOT read user preferences -- they accept explicit parameters (query, category, limit)
- No preference sync mechanism exists

**Proposed sync flow:**

```
Web UI ──writes──> user_preferences table <──reads── MCP tools

New MCP tools:
  1. everyskill.get_preferences() → returns user's current preferences
  2. everyskill.set_preferences({ preferredCategories: [...] }) → updates preferences
  3. everyskill.search_skills() → internally reads preferences for boost/sort defaults
```

**How preferences affect MCP search:**

Currently, the MCP `search_skills` handler calls `searchSkillsByQuery()` from `packages/db` which does NOT apply preference boosts. The web search (`apps/web/lib/search-skills.ts`) also does not apply preference boosts at the query level -- preferences only affect the UI sort.

For MCP preference sync, the search flow becomes:
1. MCP `search_skills` handler reads user's preferences (if authenticated)
2. Preferred categories get a 1.3x boost in result ranking (match the existing web discovery boost)
3. Default sort order from preferences applies when no explicit sort is specified

**What to avoid:**
- Do NOT sync all preferences blindly. Some preferences (like UI theme) are web-only. Only sync search-relevant preferences (categories, sort, model affinity).
- Do NOT require authentication for basic MCP search. Preference sync only works for authenticated users; anonymous MCP usage continues to work without preferences.

**Confidence:** HIGH. The preference data model already exists. Adding MCP read/write tools is straightforward. The preference boost logic can be adapted from the web's discovery search.

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Visibility audit trail | Log who changed a skill's visibility level and when | LOW | Extend existing audit_logs |
| Bulk visibility management | Admin changes visibility of multiple skills at once | LOW | Batch update endpoint |
| Visibility request workflow | Author requests "promote to global_approved," admin approves | MEDIUM | Extends existing approval workflow |
| Cross-tool preference learning | System observes MCP search patterns and auto-suggests preference updates | HIGH | Requires search log analysis + preference inference |
| Preference export/import | Export preferences as JSON for backup or transfer between environments | LOW | Serialize user_preferences JSONB |

### Anti-Features

| Anti-Feature | Why Avoid | Do Instead |
|--------------|-----------|------------|
| Per-user visibility overrides | "Show this skill to user X but not user Y" -- creates RBAC complexity that does not scale | 4-level visibility is sufficient; use personal for user-specific skills |
| Automatic visibility promotion | "Skills with 100+ uses auto-promote to global" -- removes human judgment from quality curation | Admin-only promotion; usage stats inform the decision but don't trigger it |
| Real-time preference sync via WebSocket | Preferences change infrequently; real-time sync is over-engineering | Read from DB on each request; preferences are cached per-session |
| Preference conflict resolution UI | "Your web preference says X but your MCP says Y" -- confusing | Last-write-wins for all preference channels; single source of truth in DB |

---

## Feature Area 5: Multi-Model Benchmarking with RAGAS Metrics

### What Users Expect

Users who benchmark skills want to answer: **"Which model runs this skill best, and how much does it cost?"** The current benchmarking system already answers this with a blinded AI judge scoring 0-100. The v7.0 upgrade adds RAGAS-inspired metrics that break the single quality score into dimensions:

1. **Faithfulness**: Did the model follow the skill instructions accurately? (Did it hallucinate or deviate?)
2. **Answer Relevancy**: Is the output relevant to the input? (Did it answer what was asked?)
3. **Context Precision**: Did the model use the skill content effectively? (Did it leverage the right parts of the skill?)
4. **Context Recall**: Did the model address all aspects of the input? (Did it miss anything important?)

**Concrete user interaction:**

```
Current benchmark results (/skills/[slug]/benchmarks):
  +--------+-------+--------+---------+
  | Model  | Score | Cost   | Latency |
  | Sonnet | 87    | $0.02  | 1.2s    |
  | Haiku  | 72    | $0.005 | 0.4s    |
  +--------+-------+--------+---------+

v7.0 benchmark results:
  +--------+------+------+------+------+-------+--------+---------+
  | Model  | Ovrl | Fful | Rel  | Prec | Recl  | Cost   | Latency |
  | Sonnet | 87   | 92   | 88   | 85   | 83    | $0.02  | 1.2s    |
  | Haiku  | 72   | 78   | 75   | 70   | 65    | $0.005 | 0.4s    |
  +--------+------+------+------+------+-------+--------+---------+

  Radar chart: [visual comparison of 4 dimensions per model]
  Insight: "Sonnet excels at faithfulness (follows skill instructions
           closely). Haiku is 85% cheaper but misses edge cases (lower recall)."
```

**Adapting RAGAS metrics for skill evaluation:**

RAGAS was designed for RAG systems where a retrieval step fetches context documents. In EverySkill, the "context" is the skill content itself (the markdown prompt/template). The adaptation:

| RAGAS Metric | RAG Meaning | EverySkill Adaptation |
|-------------|-------------|----------------------|
| **Faithfulness** | Response grounded in retrieved context | Output follows skill instructions without deviation or hallucination |
| **Answer Relevancy** | Response addresses the query | Output is relevant to the input provided |
| **Context Precision** | Retrieved documents contain relevant info | Skill content was used effectively (not ignored) |
| **Context Recall** | Retrieved documents cover all needed info | All aspects of the input were addressed in the output |

**Implementation approach:**

The existing benchmark runner (`apps/web/lib/benchmark-runner.ts`) uses a single AI judge call that returns `qualityScore` (0-100), `qualityNotes`, and `matchesExpected`. To add RAGAS-inspired metrics, extend the judge to score 4 dimensions:

```typescript
// Extended judge schema
const JUDGE_JSON_SCHEMA = {
  type: "object",
  properties: {
    overallScore: { type: "number" },         // 0-100
    faithfulness: { type: "number" },          // 0-100
    answerRelevancy: { type: "number" },       // 0-100
    contextPrecision: { type: "number" },      // 0-100
    contextRecall: { type: "number" },         // 0-100
    qualityNotes: { type: "string" },
    matchesExpected: { type: "boolean" },
  },
  required: [
    "overallScore", "faithfulness", "answerRelevancy",
    "contextPrecision", "contextRecall", "qualityNotes", "matchesExpected"
  ],
};
```

The judge prompt needs to be updated to evaluate each dimension explicitly:

```
Evaluate the output across 4 dimensions (0-100 each):

1. FAITHFULNESS: Does the output follow the skill instructions without
   hallucinating or deviating? Score 100 if perfectly faithful, 0 if
   completely unfaithful.

2. ANSWER RELEVANCY: Is the output relevant to the input? Score 100
   if perfectly relevant, 0 if completely irrelevant.

3. CONTEXT PRECISION: Did the model use the skill content effectively?
   Score 100 if the skill was fully leveraged, 0 if the skill was ignored.

4. CONTEXT RECALL: Does the output address all aspects of the input?
   Score 100 if everything was covered, 0 if major aspects were missed.
```

**Schema changes:**

Extend `benchmark_results` table with 4 new columns:

```sql
ALTER TABLE benchmark_results ADD COLUMN faithfulness_score INTEGER;      -- 0-100
ALTER TABLE benchmark_results ADD COLUMN relevancy_score INTEGER;         -- 0-100
ALTER TABLE benchmark_results ADD COLUMN precision_score INTEGER;         -- 0-100
ALTER TABLE benchmark_results ADD COLUMN recall_score INTEGER;            -- 0-100
```

**Why NOT use the RAGAS Python library directly:**

RAGAS is a Python library. EverySkill is TypeScript. Wrapping RAGAS in a Python subprocess or API would add:
- Python runtime dependency
- IPC complexity
- Deployment friction
- Another failure mode

Instead, adapt the RAGAS methodology into the existing TypeScript benchmark runner. The RAGAS metrics are conceptually simple -- they are evaluation dimensions scored by an LLM judge. The innovation of RAGAS is the framework and methodology, not the implementation. We can replicate the scoring dimensions with an extended judge prompt.

**Confidence:** MEDIUM. The 4-dimension scoring approach is sound and maps well to skill evaluation. The risk is **judge reliability** -- asking an LLM to score 4 dimensions simultaneously may produce less reliable scores than asking for a single overall score. Mitigation: run calibration tests comparing single-score vs multi-dimension scoring on a sample of skills. The judge prompt engineering will need iteration.

### Table Stakes

| Feature | Why Expected | Complexity | Depends On |
|---------|--------------|------------|------------|
| 4-dimension quality scoring (faithfulness, relevancy, precision, recall) | Richer quality signal than single 0-100 score | MEDIUM | Extended judge prompt + schema migration |
| Per-dimension radar chart | Visual comparison across quality dimensions | LOW | Recharts radar chart (built-in) |
| Dimension-level model comparison | "Sonnet is better at faithfulness, Haiku is better at relevancy" | LOW | Group by model, display per-dimension |
| Aggregate dimension scores per skill | "This skill's average faithfulness is 90 across all benchmark runs" | LOW | Aggregation query on benchmark_results |
| Backward-compatible overall score | Keep the existing `qualityScore` as the overall/composite | LOW | `overallScore = weighted_avg(f, r, p, r)` or judge's overall |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Model recommendation per skill | "Based on benchmarks, we recommend Sonnet for this skill (best faithfulness)" | LOW | Compare dimension scores, pick winner |
| Dimension trend tracking | "Faithfulness improved from 75 to 90 after the last version update" | MEDIUM | Time series of per-dimension scores per version |
| Cross-skill dimension comparison | "Code review skills average 85 faithfulness; data viz skills average 70" | MEDIUM | Aggregate across skills by category |
| Automatic re-benchmark on version change | When a skill publishes a new version, auto-run benchmarks | MEDIUM | Trigger benchmark on publish event |
| Benchmark cost estimation | "Running this benchmark will cost approximately $0.15" | LOW | Pre-calculate based on test case count x models x estimated tokens |

### Anti-Features

| Anti-Feature | Why Avoid | Do Instead |
|--------------|-----------|------------|
| Using RAGAS Python library via subprocess | Adds Python runtime, IPC complexity, deployment friction | Implement RAGAS scoring dimensions in TypeScript via judge prompt |
| Automated benchmark-driven model switching | "Auto-switch to the cheapest model that meets quality thresholds" | Show recommendations; let users choose explicitly |
| Benchmarking non-Anthropic models | OpenAI, Google, etc. have different APIs, pricing, capabilities | Keep Anthropic-only for v7.0; multi-provider is a future milestone |
| Statistical significance testing | Requiring N=30+ test cases with p-value < 0.05 for each model | Start with practical benchmarks (3-10 test cases); statistical rigor can come later |
| Custom metric definition UI | "Define your own evaluation dimensions" | Ship the 4 standard dimensions; custom metrics are a power-user feature for later |

---

## Feature Dependencies

```
[Community Detection] (#1)
    |--reads-------> existing skill_embeddings (768d vectors)
    |--creates-----> skill_communities + skill_community_members tables
    |--uses--------> Anthropic API for community summary generation
    |--independent-> all other v7.0 features
    |--enables-----> community-aware query routing (#2)

[Adaptive Query Routing] (#2)
    |--modifies----> apps/web/lib/search-skills.ts (add route parameter)
    |--modifies----> apps/web/app/actions/search.ts (add classifier)
    |--extends-----> search_queries table (add searchRoute column)
    |--optional----> community routing benefits from #1
    |--independent-> features #3, #4, #5

[Temporal Tracking] (#3)
    |--creates-----> user_skill_interactions table
    |--reads-------> existing skill_versions for change detection
    |--modifies----> skill detail page (add change summary)
    |--modifies----> skill card component (add "Updated" badge)
    |--independent-> features #1, #2, #4, #5

[Extended Visibility + Preference Sync] (#4)
    |--modifies----> skills.visibility column (2 -> 4 values)
    |--modifies----> packages/db/src/lib/visibility.ts
    |--modifies----> RLS policies (global_approved cross-tenant)
    |--creates-----> new MCP tools (get/set_preferences)
    |--modifies----> MCP search to read preferences
    |--independent-> features #1, #2, #3, #5

[Multi-Model Benchmarking] (#5)
    |--modifies----> benchmark_results table (4 new columns)
    |--modifies----> apps/web/lib/benchmark-runner.ts (extended judge)
    |--modifies----> benchmark UI (radar chart, dimension display)
    |--independent-> features #1, #2, #3, #4
```

### Critical Path

```
ALL FIVE FEATURES ARE INDEPENDENT -- they can be built in parallel.

However, within each feature:

#1 Community Detection:
  Schema (tables) → Clustering logic → Summary generation → Browse UI

#2 Adaptive Query Routing:
  Classifier function → Route parameter in search → Analytics logging → Fallback logic

#3 Temporal Tracking:
  Interaction table → "Updated" badge → Change summary → What's New feed

#4 Extended Visibility:
  Schema migration → Visibility filter update → RLS policy → MCP preference tools

#5 Multi-Model Benchmarking:
  Schema migration → Extended judge prompt → Dimension display UI → Radar chart
```

---

## MVP Recommendation

### Build First (Wave 1 -- all parallel, no cross-dependencies)

**Adaptive Query Routing (#2) -- Lowest risk, highest immediate impact:**
- [ ] Rule-based query classifier (keyword/semantic/hybrid/browse)
- [ ] Route parameter added to `SearchParams`
- [ ] Skip Ollama embedding for keyword queries (50-500ms latency savings)
- [ ] Log route type in `search_queries` for analytics
- [ ] Automatic fallback: keyword 0 results -> retry hybrid

**Extended Visibility (#4) -- Critical for enterprise customers:**
- [ ] 4-level visibility enum migration (global_approved, tenant, personal, private)
- [ ] Updated `buildVisibilityFilter()` for 4 levels
- [ ] RLS policy update for global_approved cross-tenant reads
- [ ] Visibility selector on skill create/edit form
- [ ] Admin-only gate for global_approved promotion
- [ ] MCP `get_preferences` / `set_preferences` tools
- [ ] MCP search reads user preferences for category boost

**Temporal Tracking (#3) -- High user value, moderate complexity:**
- [ ] `user_skill_interactions` table (user_id, skill_id, last_viewed_at, last_viewed_version)
- [ ] Track view on skill detail page load
- [ ] "Updated" badge on skill cards when `updatedAt > lastViewedAt`
- [ ] Change summary section on skill detail page
- [ ] "What's New" widget on dashboard

**Multi-Model Benchmarking (#5) -- Extends existing infrastructure:**
- [ ] 4 new columns on `benchmark_results` (faithfulness, relevancy, precision, recall scores)
- [ ] Extended judge prompt scoring 4 dimensions
- [ ] Radar chart component for dimension comparison
- [ ] Per-dimension model comparison table
- [ ] Backward-compatible overall score

### Build Second (Wave 2 -- after community infrastructure stabilizes)

**Community Detection (#1) -- Highest complexity, moderate user value:**
- [ ] Embedding-based clustering (K-means or agglomerative on 768d vectors)
- [ ] `skill_communities` + `skill_community_members` tables
- [ ] LLM-generated community names and summaries
- [ ] Community browsing page with community cards
- [ ] Periodic re-clustering (cron or on-publish)

### Defer to Post-v7.0

- [ ] **Hierarchical communities**: Sub-communities within communities. Need to validate that flat communities are useful first.
- [ ] **LLM-based query classification**: Only needed if rule-based classifier proves inadequate.
- [ ] **Version diff viewer**: Side-by-side markdown comparison. Valuable but complex UI component.
- [ ] **AI-generated change summaries**: LLM reads version diffs like Confluence Rovo. Nice but not essential.
- [ ] **Cross-tool preference learning**: Auto-infer preferences from MCP usage patterns. Requires significant search log data.
- [ ] **Automatic re-benchmark on publish**: Trigger benchmarks when a skill updates. Useful but adds API cost.
- [ ] **Statistical significance for benchmarks**: Require N=30+ test cases with proper statistical analysis.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Risk | Priority |
|---------|------------|---------------------|------|----------|
| Adaptive query routing | HIGH (faster search, better results) | LOW | LOW (extends existing code) | P0 |
| 4-level visibility | HIGH (enterprise requirement) | MEDIUM | MEDIUM (RLS changes) | P0 |
| MCP preference sync | MEDIUM (MCP power users) | LOW | LOW | P0 |
| "Updated" badge | HIGH (reduces information overload) | LOW | LOW | P0 |
| Change summary | MEDIUM (power users) | MEDIUM | LOW | P0 |
| 4-dimension benchmarking | MEDIUM (quality insight) | MEDIUM | MEDIUM (judge reliability) | P0 |
| Community detection | MEDIUM (discovery improvement) | HIGH | MEDIUM (cluster quality) | P1 |
| Community browsing UI | MEDIUM (visual discovery) | MEDIUM | LOW | P1 |
| What's New feed | MEDIUM (engagement) | MEDIUM | LOW | P1 |
| Community-aware routing | LOW (niche) | MEDIUM | LOW (requires #1) | P2 |
| Hierarchical communities | LOW (scale feature) | HIGH | HIGH | P3 (future) |
| Version diff viewer | MEDIUM (power users) | HIGH | MEDIUM | P3 (future) |
| LLM query classification | LOW (rule-based sufficient) | MEDIUM | LOW | P3 (future) |

---

## Sources

### GraphRAG Community Detection (MEDIUM confidence)
- [Microsoft GraphRAG Documentation](https://microsoft.github.io/graphrag/) -- Leiden algorithm, hierarchical community detection, community summaries
- [GraphRAG: From Local to Global](https://arxiv.org/html/2404.16130v2) -- Original paper on community detection for query-focused summarization
- [Towards Practical GraphRAG](https://arxiv.org/abs/2507.03226) -- Efficient KG construction and hybrid retrieval at scale
- [GraphRAG Community Summary Retriever](https://graphrag.com/reference/graphrag/global-community-summary-retriever/) -- Community summary data structures
- [Graphology.js](https://graphology.github.io/) -- TypeScript graph library with community detection algorithms

### Adaptive Query Routing (HIGH confidence)
- [Adaptive RAG Explained (Meilisearch)](https://www.meilisearch.com/blog/adaptive-rag) -- Query classification strategies: conservative, broad, semantic-focused profiles
- [Query-Adaptive RAG](https://ragaboutit.com/query-adaptive-rag-routing-complex-questions-to-multi-hop-retrieval-while-keeping-simple-queries-fast/) -- Routing complex vs simple queries with 40-60% efficiency gains
- [RouteRAG: Adaptive Routing in RAG Systems](https://www.emergentmind.com/topics/routerag) -- Rule-driven, RL-based, and training-free routing mechanisms
- [Building Production RAG Systems 2026](https://brlikhon.engineer/blog/building-production-rag-systems-in-2026-complete-architecture-guide) -- Router pattern architecture

### Temporal Tracking (HIGH confidence)
- [Confluence: Summarize Changes with Rovo](https://support.atlassian.com/confluence-cloud/docs/summarize-changes-with-atlassian-intelligence/) -- "What changed since your last visit" UX pattern
- [Smashing Magazine: Notification UX](https://www.smashingmagazine.com/2025/07/design-guidelines-better-notifications-ux/) -- Badge indicator design patterns
- [NN/g: Indicators and Notifications](https://www.nngroup.com/articles/indicators-validations-notifications/) -- When to use badges vs notifications

### Visibility & Access Control (HIGH confidence)
- [Smartsheet: Data Visibility for SaaS](https://www.smartsheet.com/content-center/executive-center/enterprise-center/5-keys-data-visibility-and-control-saas-solutions) -- Enterprise visibility levels and permission controls
- [JumpCloud: SaaS Access Management 2025](https://jumpcloud.com/blog/saas-access-management-guide) -- IAM components: authentication, authorization, administration, auditing
- [Zluri: Access Control Best Practices 2026](https://www.zluri.com/blog/access-control-best-practices) -- Graduated access control patterns

### MCP Preference Sync (MEDIUM confidence)
- [MCP Specification 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25) -- Current MCP spec: tools, resources, prompts
- [MCP Cross-Platform AI Tool Integration 2026](https://goldeneagle.ai/blog/artificial-intelligence/mcp-servers-cross-platform-ai-2026/) -- Cross-tool configuration patterns
- [MCP Enterprise Adoption Guide](https://guptadeepak.com/the-complete-guide-to-model-context-protocol-mcp-enterprise-adoption-market-trends-and-implementation-strategies/) -- Enterprise MCP deployment patterns

### RAGAS Metrics (MEDIUM confidence)
- [RAGAS Available Metrics](https://docs.ragas.io/en/stable/concepts/metrics/available_metrics/) -- Full list of evaluation metrics with inputs/outputs
- [RAGAS: Faithfulness](https://docs.ragas.io/en/latest/concepts/metrics/available_metrics/faithfulness/) -- Faithfulness metric definition
- [Confident AI: RAG Evaluation Metrics](https://www.confident-ai.com/blog/rag-evaluation-metrics-answer-relevancy-faithfulness-and-more) -- Detailed metric explanations
- [Evaluating RAG Systems 2025 (Cohorte)](https://www.cohorte.co/blog/evaluating-rag-systems-in-2025-ragas-deep-dive-giskard-showdown-and-the-future-of-context) -- RAGAS deep dive

### Multi-Model Benchmarking (HIGH confidence)
- [LLM Benchmarks 2026 (llm-stats.com)](https://llm-stats.com/benchmarks) -- Complete evaluation suite
- [Helicone: LLM Model Comparison Guide](https://www.helicone.ai/blog/the-complete-llm-model-comparison-guide) -- Production model comparison methodology
- [Top 5 AI Evaluation Tools 2025 (Maxim AI)](https://www.getmaxim.ai/articles/top-5-ai-evaluation-tools-in-2025-in-depth-comparison-for-robust-llm-agentic-systems/) -- Evaluation platform landscape

### Existing Codebase (HIGH confidence)
- `packages/db/src/schema/skill-embeddings.ts` -- 768d pgvector embeddings, HNSW index, cosine similarity
- `packages/db/src/lib/visibility.ts` -- `buildVisibilityFilter()` and `visibilitySQL()` with 2-level support
- `apps/web/lib/search-skills.ts` -- Hybrid search: full-text + semantic + RRF
- `apps/web/lib/benchmark-runner.ts` -- Blinded AI judge, Sonnet + Haiku, structured JSON output
- `packages/db/src/schema/benchmark-runs.ts` -- `benchmark_runs` + `benchmark_results` tables
- `packages/db/src/schema/skill-versions.ts` -- Immutable version records with content hash
- `packages/db/src/schema/user-preferences.ts` -- JSONB preferences: categories, sort, consent, claude.md notes
- `packages/db/src/services/search-analytics.ts` -- Query logging, trending, zero-result detection
- `apps/mcp/src/tools/search.ts` -- MCP search handler with tenant resolution

---

*Feature research for: EverySkill v7.0 Algorithm & Architecture Rewrite*
*Researched: 2026-02-16*
*Confidence: HIGH for adaptive routing (extends existing search paths, rule-based classifier is simple and effective). HIGH for visibility extension (clear architectural path, well-scoped changes). HIGH for temporal tracking (established UX patterns, lightweight data model). MEDIUM for community detection (clustering approach sound, cluster quality uncertain). MEDIUM for RAGAS-inspired metrics (judge prompt engineering needs iteration, 4-dimension scoring reliability unverified).*

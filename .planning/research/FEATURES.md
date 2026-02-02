# Feature Research: v1.3 AI Review, Duplicates, Forks, Cross-Platform Install

**Domain:** Internal skill marketplace (Claude skills, prompts, workflows)
**Researched:** 2026-02-02
**Confidence:** HIGH (verified with official docs and multiple sources)

## Context

Relay v1.3 adds four new feature areas:
1. **AI-driven skill review** - Claude analyzes skills for functionality, security, quality
2. **Semantic similarity detection** - Advisory duplicate warning on publish
3. **Fork-based versioning** - Users create variants of existing skills
4. **Cross-platform installation** - Install on Claude Code, Claude Desktop, Claude.ai, VS Code

This research covers expected behaviors and feature landscape for each area.

---

## Table Stakes

Features users expect for each capability area. Missing these = feature feels incomplete.

### AI Review System

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Review on demand | Users want control over when reviews run | LOW | Button trigger, not automatic |
| Structured feedback categories | Clear buckets: functionality, security, quality, improvements | MEDIUM | Consistent review schema |
| Actionable suggestions | "Change X to Y" not just "X is bad" | MEDIUM | Requires good prompt engineering |
| Review history | See past reviews and track improvement | LOW | Store in DB with timestamps |
| Confidence indicators | Show how certain the AI is | LOW | LLMs can output confidence levels |
| Security vulnerability flags | Prompt injection risks, data leaks | HIGH | OWASP Top 10 for LLM apps |

**Research findings:** AI code review in 2026 typically includes pattern recognition, issue detection, suggestion generation, and continuous learning. The key difference from static analysis: AI "understands systems" while static tools "check patterns." Reviews should flag security issues (prompt injection is #1 on OWASP LLM Top 10), assess functionality, and suggest specific improvements.

### Similarity Detection

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Similar skills shown on publish | Advisory warning before creating duplicates | MEDIUM | Embedding comparison at publish time |
| Similarity percentage display | Show how similar (e.g., "87% similar to X") | LOW | Cosine similarity to percentage |
| Links to similar skills | Navigate to potential duplicates | LOW | UI linkage |
| Bypass option | Allow publishing anyway | LOW | User override with acknowledgment |
| Top-N results only | Don't overwhelm with matches | LOW | Limit to 3-5 most similar |

**Research findings:** Cosine similarity thresholds for duplicate detection:
- Above 0.85: Very similar (strong warning)
- 0.70-0.85: Similar (advisory notice)
- Below 0.70: Don't show

Best practice is multi-stage: high-confidence filtering followed by semantic analysis. Embedding models like OpenAI text-embedding-3-small or open-source Qwen3-Embedding work well for text similarity.

### Fork Model

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Fork button on skill detail | Create personal variant | LOW | Copy with attribution |
| Attribution to parent | Show "Forked from X" | LOW | Foreign key reference |
| Fork count display | Show how many forks exist | LOW | Denormalized counter |
| View all forks list | See variants of a skill | LOW | Query by parentId |
| Fork naming conventions | "Skill Name (Your Fork)" or custom | LOW | Default naming pattern |

**Research findings:** GitHub fork model is the standard. Key behaviors:
- Fork is a complete copy owned by the forker
- Cannot directly affect original project
- Attribution to upstream preserved
- Syncing with upstream is optional and manual
- Common versioning pattern: track upstream version with suffix (e.g., "1.0.0-your-org.1")

### Cross-Platform Install

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Claude Code install | MCP deploy via existing server | LOW | Already have deploy_skill tool |
| Claude Desktop config copy | JSON for claude_desktop_config.json | LOW | Have generateMcpConfig() |
| Platform-specific instructions | Different paths per OS | LOW | Conditional text display |
| One-click copy to clipboard | Copy config without manual selection | LOW | Already have useClipboardCopy hook |

**Research findings:** MCP config locations:
- Claude Desktop (macOS): `~/Library/Application Support/Claude/claude_desktop_config.json`
- Claude Desktop (Windows): `%APPDATA%\Claude\claude_desktop_config.json`
- Claude Desktop (Linux): `~/.config/Claude/claude_desktop_config.json`
- Claude Code: `~/.claude.json` or `.mcp.json`

Config format is JSON with `mcpServers` object containing named server configs.

---

## Differentiators

Features that set Relay apart. Not required, but valuable.

### AI Review System

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Skill-type-aware review | Different criteria for prompts vs agents vs workflows | MEDIUM | Type-specific prompts |
| Improvement suggestions with diff | Show exact changes to make | HIGH | Generate modified content |
| Review-triggered badge upgrade | Good review can upgrade quality tier | MEDIUM | Integration with existing scorecard |
| Batch review for authors | Review all your skills at once | MEDIUM | Queue management |
| Review comparison (before/after) | Show improvement over revisions | LOW | Version diff display |

### Similarity Detection

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Semantic search, not just keyword | Find conceptually similar skills | HIGH | Requires embedding model |
| Consolidation suggestions | "Consider adding to X instead" | MEDIUM | Threshold-based recommendations |
| Similarity dashboard for admins | View duplicates platform-wide | MEDIUM | Admin tooling |
| Category-scoped similarity | Only compare within same category | LOW | Filter before comparison |

### Fork Model

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Upstream sync notifications | "Parent skill updated, review changes" | HIGH | Change tracking across forks |
| Merge suggestions back to parent | Fork improvements can flow upstream | HIGH | PR-like workflow |
| Fork comparison view | Side-by-side diff with parent | MEDIUM | Diff rendering |
| Fork metrics aggregation | Show total usage across all forks | LOW | Sum queries |
| "Best fork" highlighting | Surface highest-rated variants | LOW | Query with ratings |

### Cross-Platform Install

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Claude.ai web integration | Remote MCP config for browser Claude | HIGH | Requires Anthropic remote MCP |
| VS Code extension install | One-click extension marketplace | HIGH | Would need published extension |
| Auto-detect installed platforms | Show only relevant install options | MEDIUM | Local detection challenging |
| Installation verification | "Skill successfully installed" confirmation | MEDIUM | Callback/polling mechanism |
| Install analytics per platform | Track which platforms users prefer | LOW | Event tracking |

---

## Anti-Features

Features to explicitly NOT build. Common mistakes in this domain.

| Anti-Feature | Why Requested | Why Problematic | Alternative |
|--------------|---------------|-----------------|-------------|
| **Auto-review on every publish** | "Save time" | LLM costs scale poorly; bottleneck; may block legitimate skills | On-demand review button; periodic batch review |
| **Blocking duplicate detection** | "Prevent clutter" | False positives frustrate users; semantic similarity imperfect; variants are legitimate | Advisory-only with bypass; let ratings surface quality |
| **Auto-merge forks** | "Keep everything in sync" | Merge conflicts complex; breaks customizations; confusing | Notification of upstream changes; manual merge |
| **Real-time similarity scoring** | "Immediate feedback" | Expensive embedding calls; distracting UX; premature optimization | Check on publish/preview only |
| **Universal installer** | "One button for everything" | Platforms have different config formats; security implications; brittle | Per-platform install with clear instructions |
| **Fork approval gates** | "Quality control" | Adds friction; kills organic iteration; contradicts wiki philosophy | Let metrics surface quality; highlight high-rated forks |
| **AI auto-fix** | "Apply suggestions automatically" | Users lose understanding; may introduce bugs; removes human judgment | Show diff, let user apply manually |
| **LLM-based similarity verification** | "Double-check duplicates" | LLM inherits same vulnerabilities; attackers can craft prompts to mislead both models | Use embeddings + cosine similarity only |

---

## Feature Dependencies

```
[AI Review]
    |--requires--> [LLM API integration (Anthropic)]
    |--enhances--> [Quality Scorecard] (existing)
    |--enhances--> [Skill Versions] (existing)
    |--stores in--> [reviews table] (new)

[Similarity Detection]
    |--requires--> [Embedding Model/API (OpenAI or open-source)]
    |--requires--> [Vector Storage (pgvector or in-memory)]
    |--uses------> [Full-text Search] (existing, but different approach)
    |--stores in--> [skill_embeddings table] (new)

[Fork Model]
    |--requires--> [Skills Schema Update] (add parentSkillId)
    |--enhances--> [Version History] (existing)
    |--enhances--> [Attribution/Leaderboard] (existing)

[Cross-Platform Install]
    |--extends---> [MCP Config Generation] (existing)
    |--requires--> [Platform Detection Logic] (new)

[Claude.ai Install]
    |--requires--> [Remote MCP Support] (Anthropic-dependent, paid plans)

[VS Code Install]
    |--requires--> [Published VS Code Extension] (separate project)
```

### Dependency Notes

- **AI Review requires LLM API:** Anthropic Claude is natural choice. Cost estimate: ~$0.01-0.03 per review depending on skill length. At 500 users, 5 reviews/user/month = ~$50-75/month.

- **Similarity Detection requires embeddings:** Anthropic doesn't offer embeddings. Options:
  - OpenAI text-embedding-3-small ($0.02/1M tokens) - recommended for accuracy
  - Voyage AI (specialized for retrieval)
  - Open-source: Qwen3-Embedding-0.6B, E5-large-v2

- **Fork Model requires schema change:** Add `parentSkillId` and `forkCount` to skills table. Straightforward migration.

- **Claude.ai web install is platform-dependent:** Remote MCP connectors require paid plan (Pro/Max/Team/Enterprise) and specific API setup.

- **VS Code extension is separate project:** Would need dedicated development beyond this milestone.

---

## MVP Definition

### Launch With (v1.3)

Minimum viable implementation of each feature.

**AI Review:**
- [ ] On-demand review button on skill detail page
- [ ] Structured review output (functionality, security, quality, improvements)
- [ ] Review history stored in database
- [ ] Basic prompt injection detection
- [ ] Confidence level display

**Similarity Detection:**
- [ ] Similarity check triggered on publish (before submit)
- [ ] Show top 3 similar skills with percentage
- [ ] "Publish anyway" bypass option
- [ ] Advisory only, never blocking
- [ ] Category-scoped comparison

**Fork Model:**
- [ ] Fork button creates copy with attribution
- [ ] "Forked from X" display on skill detail
- [ ] Fork count on parent skill
- [ ] Forks inherit parent's tags/category
- [ ] View forks list on parent skill page

**Cross-Platform Install:**
- [ ] Claude Code: enhance existing MCP deploy instructions
- [ ] Claude Desktop: copy config JSON with platform-specific paths
- [ ] OS detection for instruction customization (macOS/Windows/Linux)

### Add After Validation (v1.4+)

- [ ] AI Review: Batch review for authors — when usage is high
- [ ] AI Review: Auto-suggest quality tier based on review — when accuracy validated
- [ ] Similarity: Admin dashboard for duplicate management — when duplication is observed problem
- [ ] Forks: Upstream change notifications — when fork ecosystem grows
- [ ] Forks: Fork comparison diff view — when users request
- [ ] Install: Verification callbacks — when failure rate measured

### Future Consideration (v2+)

- [ ] Claude.ai web remote MCP integration — requires Anthropic partnership
- [ ] VS Code extension marketplace — separate project
- [ ] AI auto-fix with diff preview — risky UX
- [ ] Merge fork improvements upstream — complex PR workflow
- [ ] Real-time similarity as you type — premature optimization

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| AI review on-demand | HIGH | MEDIUM | P1 |
| Security vulnerability detection | HIGH | MEDIUM | P1 |
| Similar skills on publish | MEDIUM | MEDIUM | P1 |
| Fork with attribution | HIGH | LOW | P1 |
| Claude Desktop config copy | HIGH | LOW | P1 |
| Review history | MEDIUM | LOW | P1 |
| Fork count display | MEDIUM | LOW | P1 |
| Structured review categories | MEDIUM | MEDIUM | P2 |
| Similarity bypass option | MEDIUM | LOW | P2 |
| View all forks list | MEDIUM | LOW | P2 |
| Platform-specific instructions | LOW | LOW | P2 |
| Batch review | LOW | MEDIUM | P3 |
| Upstream sync notifications | MEDIUM | HIGH | P3 |
| Fork comparison diff | LOW | MEDIUM | P3 |
| Claude.ai install | HIGH | HIGH | P3 (blocked) |

**Priority key:**
- P1: Must have for v1.3 launch
- P2: Should have, add when possible in v1.3
- P3: Nice to have, consider for v1.4+

---

## Implementation Considerations

### AI Review Schema

```typescript
interface SkillReview {
  id: string;
  skillId: string;
  skillVersionId: string;
  functionality: {
    score: 1 | 2 | 3 | 4 | 5;
    issues: string[];
    suggestions: string[];
  };
  security: {
    score: 1 | 2 | 3 | 4 | 5;
    vulnerabilities: string[];
    remediations: string[];
  };
  quality: {
    score: 1 | 2 | 3 | 4 | 5;
    improvements: string[];
  };
  overallScore: number; // 1-5
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  rawResponse: string; // Full LLM response for debugging
  reviewedAt: Date;
  reviewedBy: 'claude-3-opus' | 'claude-3-sonnet' | etc;
}
```

### Embedding Storage

Two options:

**Option A: pgvector extension**
```sql
CREATE EXTENSION IF NOT EXISTS vector;
ALTER TABLE skills ADD COLUMN embedding vector(1536);
CREATE INDEX ON skills USING ivfflat (embedding vector_cosine_ops);
```

**Option B: Separate embeddings table**
```sql
CREATE TABLE skill_embeddings (
  skill_id TEXT PRIMARY KEY REFERENCES skills(id),
  embedding vector(1536),
  model TEXT, -- 'text-embedding-3-small'
  created_at TIMESTAMP DEFAULT NOW()
);
```

Recommendation: Option B for flexibility (can re-embed with different models).

### Fork Schema Addition

```sql
ALTER TABLE skills ADD COLUMN parent_skill_id TEXT REFERENCES skills(id);
ALTER TABLE skills ADD COLUMN fork_count INTEGER DEFAULT 0;
CREATE INDEX idx_skills_parent_id ON skills(parent_skill_id);
```

### Cross-Platform Config Generation

Extend existing `generateMcpConfig()`:

```typescript
function generateMcpConfig(
  skill: { name: string; slug: string },
  platform: 'claude-code' | 'claude-desktop-mac' | 'claude-desktop-win' | 'claude-desktop-linux'
): { config: string; instructions: string; configPath: string } {
  const config = {
    mcpServers: {
      [skill.slug]: {
        command: "npx",
        args: ["-y", `@anthropic-ai/relay-${skill.slug}`],
      },
    },
  };

  const paths = {
    'claude-code': '~/.claude.json or .mcp.json',
    'claude-desktop-mac': '~/Library/Application Support/Claude/claude_desktop_config.json',
    'claude-desktop-win': '%APPDATA%\\Claude\\claude_desktop_config.json',
    'claude-desktop-linux': '~/.config/Claude/claude_desktop_config.json',
  };

  return {
    config: JSON.stringify(config, null, 2),
    configPath: paths[platform],
    instructions: getInstructions(platform),
  };
}
```

---

## Competitor/Domain Analysis

| Feature | GitHub | VS Code Marketplace | npm Registry | Relay v1.3 Approach |
|---------|--------|---------------------|--------------|---------------------|
| Fork model | Full git fork | N/A | N/A | Simplified copy with attribution |
| Similarity detection | Search only | "Similar extensions" | None | Proactive advisory on publish |
| AI review | Copilot (separate) | None | None | Built-in, skill-aware |
| Cross-platform | Clone works everywhere | Platform-specific | npm install | Platform-specific config copy |
| Version control | Full git history | Semver releases | Semver | Wiki-style versions (existing) |

### Key Differentiators for Relay

1. **AI review is native:** Built into the platform, not a separate tool
2. **Proactive similarity:** Surfaces duplicates automatically on publish
3. **Simplified forking:** No git complexity, just copy-with-attribution
4. **Skill-type awareness:** Review criteria tuned to prompts/workflows/agents

---

## Sources

### AI Code Review
- [Qodo: AI Code Review Tools 2026](https://www.qodo.ai/blog/best-ai-code-review-tools-2026/) - Enterprise requirements and patterns
- [Addy Osmani: Code Review in the Age of AI](https://addyo.substack.com/p/code-review-in-the-age-of-ai) - Best practices for AI-assisted review
- [IBM: AI Code Review](https://www.ibm.com/think/insights/ai-code-review) - Architecture patterns
- [OWASP LLM Top 10: Prompt Injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/) - Security vulnerabilities

### Semantic Similarity
- [OpenAI Community: Cosine Similarity Thresholds](https://community.openai.com/t/rule-of-thumb-cosine-similarity-thresholds/693670) - Threshold guidance (0.79 threshold common)
- [OpenXcell: Best Embedding Models 2026](https://www.openxcell.com/blog/best-embedding-models/) - Model comparison
- [NewsCatcher: Text Similarity Guide](https://www.newscatcherapi.com/blog-posts/ultimate-guide-to-text-similarity-with-python) - Implementation patterns

### Fork Model
- [GitHub Docs: Fork a Repo](https://docs.github.com/articles/fork-a-repo) - Standard fork behavior
- [Atlassian: Forking Workflow](https://www.atlassian.com/git/tutorials/comparing-workflows/forking-workflow) - Patterns and UX
- [GitHub Blog: Friendly Fork Management](https://github.blog/2022-05-02-friend-zone-strategies-friendly-fork-management/) - Advanced strategies

### Cross-Platform Install
- [MCP Docs: Connect Local Servers](https://modelcontextprotocol.io/docs/develop/connect-local-servers) - Official config format
- [Claude Code Docs: MCP](https://code.claude.com/docs/en/mcp) - Claude Code integration
- [Anthropic: Desktop Extensions](https://www.anthropic.com/engineering/desktop-extensions) - One-click install (.mcpb format)
- [Claude Help: Local MCP Servers](https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop) - Setup guide

---

*Feature research for: Relay v1.3 AI review, duplicates, forks, cross-platform install*
*Researched: 2026-02-02*
*Confidence: HIGH - Based on official documentation, OWASP guidelines, and established industry patterns*

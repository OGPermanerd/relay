# Relay

## What This Is

Relay is an internal skill marketplace where Claude skills, prompts, workflows, and agent configurations are discovered, deployed, and collectively improved. Think Apple App Store polish with wiki-style contribution — anyone can add versions to any skill, and metrics (usage, ratings, FTE Days Saved) surface quality organically. Skills are living documents that get more valuable as the org iterates on them.

## Core Value

Skills get better as they pass through more hands, with real metrics proving that value.

## Requirements

### Validated

(None yet — ship to validate)

### Active

**Web Application**
- [ ] Browse and search skills with category filtering
- [ ] Skill cards showing: total uses, ratings, FTE Days Saved (sparkline), contributor count
- [ ] Skill detail page with full version history (version, author, date, uses, hours saved per version)
- [ ] Publish flow: upload skill with metadata (name, description, category tags, usage instructions, estimated hours saved, commit comment)
- [ ] Rating and review system with optional time-saved estimate from reviewers
- [ ] Dashboard showing: total contributors, total downloads, total uses, total FTE Days Saved
- [ ] Google Workspace SSO authentication restricted to company domain

**MCP Server**
- [ ] List and search skills from Relay catalog
- [ ] Deploy skills to local Claude environment (one-click)
- [ ] Track skill usage automatically when deployed skills are run

**Data Model**
- [ ] Support multiple skill formats: Claude Code skills, prompts, workflows, agent configs
- [ ] Wiki-style versioning where anyone can add a new version to any skill
- [ ] Per-version metrics tracking (uses, hours saved)
- [ ] FTE Days Saved calculation: uses × estimated_hours_per_use
- [ ] User-submitted time estimates override creator estimates once available

### Out of Scope

- Review prompts in Claude after skill use — v2 feature, adds MCP complexity
- Skill creation scaffolding via MCP — v2 feature, focus v1 on deploy/track
- Similarity/duplicate detection on publish — v2 feature, start with basic search
- AI-suggested improvement recommendations — v2 feature
- Approval gates or review process for new versions — metrics-driven quality model instead

## Context

**The "Relay" concept:** Skills are passed like a baton from person to person, each handoff making them better. This relays institutional knowledge across the org while continuously improving the tools themselves.

**MCP is the tracking backbone:** Usage metrics only work for skills deployed through the MCP integration. Skills downloaded and used manually are invisible to the system. This creates strong incentive for MCP adoption.

**Metrics-driven quality:** No gatekeeping on contributions. Anyone can publish a new version to any skill. Bad versions get low ratings and usage; good ones rise. The numbers do the talking.

**FTE Days Saved is the core metric:** This is the primary measure of Relay's value to the organization. It's calculated per-version and aggregated across the platform. Creator provides initial estimate (or asks Relay to estimate), but user-submitted estimates from reviews take precedence once available.

**Scale:** Enterprise-wide rollout targeting 500+ users in year one.

## Constraints

- **Tech stack**: Modern web (React/Next.js frontend, Node or Python backend, PostgreSQL) — standard choices for this scale
- **Authentication**: Google Workspace SSO only, restricted to company domain — no public access
- **MCP compatibility**: Must work with Claude Code's MCP server architecture
- **Skill format flexibility**: System must handle heterogeneous skill types without forcing a single format

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Wiki-style versioning over fork model | Keeps skills as single evolving artifacts rather than fragmenting into forks; simpler mental model | — Pending |
| MCP-only tracking | Provides accurate usage data; creates natural incentive for MCP adoption | — Pending |
| No approval gates | Reduces friction for contributors; lets metrics surface quality organically | — Pending |
| User estimates override creator | Real-world usage data more reliable than creator's guess | — Pending |
| Defer similarity detection to v2 | Simplifies v1 scope; basic search sufficient to start | — Pending |

---
*Last updated: 2025-01-31 after initialization*

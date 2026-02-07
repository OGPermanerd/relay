---
created: 2026-02-07T18:30
title: AI-Independence — platform-agnostic skill translation
area: planning
files: []
---

## Problem

EverySkill currently stores and serves skills in Claude Code format only (CLAUDE.md frontmatter, MCP tool configs, Claude-specific prompts). If a team wants to switch to Cursor, Copilot, Windsurf, or any future AI coding tool, their entire skill library becomes worthless. This creates vendor lock-in to Anthropic's ecosystem and reduces EverySkill's long-term value proposition.

The platform should be the durable skill layer that persists regardless of which AI coding tool wins — insurance against AI-dependence. Lowering switching costs makes EverySkill more valuable, not less, because organizations adopt it knowing their investment is portable.

## Solution

Consider a multi-layered approach:

1. **Abstract skill representation format** — A platform-neutral intermediate format that captures skill intent, instructions, parameters, and metadata without coupling to any specific AI tool's format. Think "skill IR" (intermediate representation).

2. **Per-platform export adapters** — Translators that convert the abstract format into platform-specific configs:
   - Claude Code: CLAUDE.md frontmatter + MCP config
   - Cursor: .cursorrules files
   - GitHub Copilot: .github/copilot-instructions.md
   - Windsurf: .windsurfrules
   - Generic: plain markdown instructions

3. **Import from other platforms** — Parse existing platform-specific skill files and normalize into the abstract format, enabling migration TO EverySkill from any platform.

4. **Skill equivalence mapping** — Track which skills have been translated to which platforms, show coverage gaps, and surface translation quality metrics.

5. **One-click multi-platform deploy** — When a skill is deployed via MCP or web, offer export to multiple platforms simultaneously.

This positions EverySkill as the "write once, deploy anywhere" skill registry — the organizational knowledge layer that outlasts any individual AI tool.

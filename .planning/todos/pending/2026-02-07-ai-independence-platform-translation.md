---
created: 2026-02-07T18:30
title: AI-Independence — platform-agnostic skill translation
area: planning
files: []
---

## Problem

EverySkill currently stores and serves skills in Claude Code format only (CLAUDE.md frontmatter, MCP tool configs, Claude-specific prompts). If a team wants to switch to Cursor, Copilot, Windsurf, or any future AI coding tool, their entire skill library becomes worthless. This creates vendor lock-in to Anthropic's ecosystem and reduces EverySkill's long-term value proposition.

The deeper problem: skills aren't just AI tool configs — they capture the **core critical thinking that defines a company's competitive edge**. How your team reviews code, handles incidents, onboards engineers, structures APIs — that institutional knowledge is the real asset. If it's locked into one AI model's format, you've made your company's intellectual capital dependent on a vendor.

EverySkill should be the durable layer that captures this thinking in a model-independent and platform-independent way. Insurance against AI-dependence means: (1) skills remain valuable regardless of which AI tool or model is used, (2) switching costs between AI platforms approach zero, and (3) the organization's codified knowledge outlasts any individual AI vendor relationship.

## Solution

Consider a multi-layered approach:

1. **Abstract skill representation format** — A platform-neutral and model-neutral intermediate format that captures skill intent, decision frameworks, instructions, parameters, and metadata without coupling to any specific AI tool or model. Think "skill IR" (intermediate representation). The format should preserve the critical thinking — the *why* and *how* of organizational processes — not just the prompt engineering for a specific model.

2. **Per-platform export adapters** — Translators that convert the abstract format into platform-specific configs:
   - Claude Code: CLAUDE.md frontmatter + MCP config
   - Cursor: .cursorrules files
   - GitHub Copilot: .github/copilot-instructions.md
   - Windsurf: .windsurfrules
   - Generic: plain markdown instructions

3. **Import from other platforms** — Parse existing platform-specific skill files and normalize into the abstract format, enabling migration TO EverySkill from any platform.

4. **Skill equivalence mapping** — Track which skills have been translated to which platforms, show coverage gaps, and surface translation quality metrics.

5. **One-click multi-platform deploy** — When a skill is deployed via MCP or web, offer export to multiple platforms simultaneously.

6. **Model-independent skill execution** — Skills should work across AI models (Claude, GPT, Gemini, Llama, etc.), not just across AI tools. The abstract format should be rich enough that any capable model can execute the skill's intent without model-specific prompt engineering.

This positions EverySkill as the **organizational knowledge vault** — capturing the critical thinking that defines your company's edge, portable across any AI tool or model. The pitch: "Your skills are yours. Your thinking is yours. EverySkill ensures they never get locked in."

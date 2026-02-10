# Project Rules

# Relay Project - Claude Code Guidelines

## System Context
LXC container on 32GB / 8 vCPU Hetzner VPS. Use full resources, but detect and stop runaway conditions.

## Circuit Breakers (MUST follow)

### Stop and Report If:
- Same error appears 3+ times in a row
- Build/test cycle repeats without progress for 10+ minutes
- Load average exceeds 40 (check with `uptime`)
- Available memory drops below 2GB (`free -h`)

### When Circuit Breaker Triggers:
1. Kill runaway processes: `pkill -f "next-server" && pkill -9 node`
2. Document: what was attempted, what failed, how many times
3. Wait for guidance before retrying

## Avoiding Hot-Reload Loops

When making bulk file changes (5+ files), stop dev server first:
```bash
pkill -f "next-server"
# make changes
pnpm build  # validate without hot-reload
```

For single file changes, hot-reload is fine.

## Quick Health Check
```bash
uptime && free -h | grep Mem
```

## If Stuck
```bash
# What's consuming resources?
ps aux --sort=-%cpu | head -10

# Kill everything and reassess
pkill -f "next-server" && pkill -9 node && pkill ollama
```

## Summary
- Use full parallelism — no artificial limits
- Stop after 3 identical failures
- Stop if load > 40 or memory < 2GB
- Kill hot-reload during bulk edits
- When in doubt, checkpoint and ask

## Testing
- Always invoke Playwright to test each page modified before asking the user to review it. Never present a checkpoint without first running automated Playwright tests that verify every modified page loads without errors.
## Backlog Muse
Backlog system for multi-project async feedback. Skills and protocols at /home/dev/projects/backlog-muse/skill/SKILL.md
To capture inline: prefix with "muse:" — e.g. "muse: the login page is broken"
To process inbox: "process inbox [project]"
Registry and inboxes at /home/dev/projects/backlog-muse/

## Design Collaboration

This project supports design contributors who use Claude Desktop to experiment with visual changes.

### When the user says "propose this change"
1. Create a branch: `design/short-description` (from latest master)
2. Stage and commit all changed files with a descriptive message prefixed with `design:`
3. Push the branch: `git push -u origin design/short-description`
4. Open a PR: `gh pr create --title "Design: ..." --body "## What changed\n..."` with before/after description
5. Share the PR link with the user

### When the user says "leave feedback" or describes a UX issue
1. Append the feedback to `docs/feedback-log.md` with the current date, page/area, and the comment
2. Confirm it was logged

### Branch naming
- Design proposals: `design/dark-header`, `design/new-logo`, `design/card-layout`
- Never push directly to `master`

### Key design files
- `apps/web/lib/header-theme.ts` — header dark/light toggle
- `apps/web/app/globals.css` — global styles
- `apps/web/components/` — all UI components
- `apps/web/app/(protected)/layout.tsx` — main layout with header/nav
- `apps/web/public/` — logos, static assets
- `tailwind.config.ts` — Tailwind theme config

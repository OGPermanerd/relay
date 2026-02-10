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

This project supports design contributors who use Claude Code to experiment with visual changes. All feedback and proposals flow through git (branches + PRs) so the lead developer's Claude can review them directly.

### Contributor role detection
If the user identifies as a design contributor, is non-technical, or mentions they are working on design/feedback:
- Use simple, non-technical language
- Don't show raw error output — summarize what happened
- Proactively handle git operations (pull, branch, commit, push, PR) without explaining git concepts
- Always confirm before pushing to remote

### When the user describes a visual change they want to try
1. Make sure you're on latest master: `git pull origin master`
2. Create a branch: `git checkout -b design/short-description`
3. Make the code changes
4. Show the user what changed in plain language
5. If they like it, ask "Want me to propose this to Trevor?"

### When the user says "propose this" or wants to share a change
1. Stage and commit with a clear message: `design: [what changed and why]`
2. Push: `git push -u origin design/short-description`
3. Open a PR with full context for the reviewer's Claude:
   ```
   gh pr create --title "Design: ..." --body "## What changed
   [plain description]

   ## Why
   [Karin's reasoning / feedback]

   ## Files changed
   [list of files with what was modified in each]

   ## How to review
   Apply this branch and view [which pages] to see the changes.

   ## Design context
   [any color values, spacing details, or visual rationale]"
   ```
4. Share the PR link with the user

### When the user gives feedback (not a code change)
1. Make sure you're on latest master: `git pull origin master`
2. Create a branch: `git checkout -b feedback/short-topic`
3. Append structured feedback to `docs/feedback-log.md`:
   ```
   ### [Date] — [Page/Area]
   **Type:** improvement | bug | idea
   **From:** [user name]
   **Description:** [their feedback, cleaned up]
   **Suggestion:** [any specific suggestion they mentioned]
   ```
4. Commit, push, and open a PR titled "Feedback: [topic]"
5. Confirm to the user that it's been sent

### When the user wants to share a logo or image
1. Save the file to `docs/proposals/` directory (create if needed)
2. Reference it in the PR description
3. Note what it should replace (e.g., "Replace apps/web/public/everyskill-logo-dark.svg")

### Branch naming
- Design changes: `design/dark-header`, `design/new-logo`, `design/card-layout`
- Feedback only: `feedback/homepage-spacing`, `feedback/mobile-nav`
- Never push directly to `master`

### First-time setup (run once per machine)
If the project was just cloned and hasn't been set up yet (no `node_modules/` or no `.env.local`):
1. Copy `.env.example` to `.env.local` if it doesn't exist
2. Ask the user for their AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET (or say "ask Trevor for the Google credentials") and fill them in
3. Check if Docker is running: `docker info` — if not, tell the user to open Docker Desktop
4. Start the database: `pnpm docker:up` — wait 5 seconds for it to be ready
5. Install dependencies: `pnpm install`
6. Push the database schema: `pnpm db:push` (ignore warnings about roles)
7. Confirm setup is complete

### Session start
At the beginning of every session, always:
1. `git pull origin master` to get latest
2. `pnpm install` (in case dependencies changed) — only if package.json changed since last pull
3. Check if the dev server is running: try `curl -s http://localhost:2002/api/health`
4. If not running, start it in the background: `cd apps/web && pnpm dev &`
5. Once healthy, open the browser: `start http://localhost:2002` (Windows) or `open http://localhost:2002` (Mac)
6. Ask what the user wants to work on today

### During design iteration
After making code changes:
1. Tell the user to refresh their browser (or note which page to check)
2. Ask if they like it, want adjustments, or want to try something different
3. Keep iterating until they're happy before proposing

### Key design files
- `apps/web/lib/header-theme.ts` — header dark/light toggle
- `apps/web/app/globals.css` — global styles
- `apps/web/components/` — all UI components (nav-link, greeting-area, notification-bell, sign-out-button, tenant-branding, animated-logo)
- `apps/web/app/(protected)/layout.tsx` — main layout with header/nav
- `apps/web/public/` — logos and static images
- `tailwind.config.ts` — Tailwind theme config
- Current header colors: bg #0b1624, borders #1a3050, text #dbe9f6 (active), #7a9ab4 (inactive)

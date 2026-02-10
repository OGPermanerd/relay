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

### Page-by-page comments (browsing feedback)
When the user is browsing the local site and commenting on what they see page by page:
1. If not already on a feedback branch, create one: `git checkout -b feedback/session-YYYY-MM-DD`
2. For each page comment, append to `docs/feedback-log.md`:
   ```
   ### [Date] — [Page URL or name]
   **Type:** improvement | bug | idea
   **From:** [user name]
   **Description:** [their feedback, cleaned up]
   **Suggestion:** [any specific suggestion they mentioned]
   ```
3. Accumulate multiple comments on the same branch — one commit per page or per batch
4. When the user says "send my feedback" or wraps up, push and open a single PR titled "Feedback: session [date]" with all comments summarized in the body
5. If they don't explicitly wrap up, prompt at natural stopping points: "Want me to send this feedback to Trevor?"

### When the user wants to create or test an asset (logo, icon, image)
The user may want to create design assets using Claude's capabilities, or provide their own files.

**If the user asks Claude to generate/create a logo, icon, or design:**
1. Create SVG assets directly — write the SVG markup to `docs/proposals/assets/`
2. For logos: create both light and dark variants if the current design has both
3. To test it live: copy the asset into `apps/web/public/` (replacing the current logo) and tell the user to refresh
4. Keep the original files untouched on master — the branch has the swap

**If the user provides their own image file:**
The user will reference a file on their computer by path (e.g., "use the logo at Downloads\new-logo.svg").
1. Read the file from the path they provide and copy it to `docs/proposals/assets/` with a descriptive name
2. To test it live: copy into `apps/web/public/` and update any references in the components
3. Tell the user to refresh their browser to see it

**When proposing an asset change:**
1. Include both the new asset AND the code changes in the same PR
2. In the PR body, note:
   - What the new asset looks like (describe it)
   - What it replaces
   - Which pages are affected
   - The asset files in `docs/proposals/assets/` (permanent record even if the live swap is reverted)

### When the user shares an annotated screenshot
The user may annotate screenshots using Edge's built-in capture tool (Ctrl+Shift+S) with pen/ink on a Surface or tablet. They'll reference the file by path.

1. Read the image file — you can see circles, arrows, underlines, and handwritten notes
2. Describe what you see in the annotations (what they circled, what they wrote)
3. Confirm your interpretation with the user: "It looks like you circled the nav spacing and wrote 'too tight' — is that right?"
4. Log the feedback in `docs/feedback-log.md` with:
   ```
   ### [Date] — [Page name]
   **Type:** visual-annotation
   **From:** [user name]
   **Screenshot:** [original file path]
   **Annotations:** [describe what was circled/marked and any handwritten notes]
   **Description:** [interpreted feedback]
   ```
5. Copy the annotated screenshot to `docs/proposals/assets/feedback/` with a descriptive name so it's included in the PR
6. Continue accumulating on the same feedback branch

### When the user gives standalone feedback (not while browsing)
1. If not already on a feedback branch, create one: `git checkout -b feedback/short-topic`
2. Append structured feedback to `docs/feedback-log.md` (same format as above)
3. Commit, push, and open a PR titled "Feedback: [topic]"
4. Confirm to the user that it's been sent

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
7. Seed the database with sample data so pages look realistic: `pnpm --filter @everyskill/db db:seed` (if the script exists, otherwise skip — the app works without data, pages will just be empty)
8. Confirm setup is complete and explain that the local site is a full working copy of the real app

### Session start
At the beginning of every session, always:
1. `git pull origin master` to get latest
2. `pnpm install` (in case dependencies changed) — only if package.json changed since last pull
3. Check if the dev server is running: try `curl -s http://localhost:2002/api/health`
4. If not running, start it in the background: `cd apps/web && pnpm dev &`
5. Once healthy, open in Edge (for annotation support): `start msedge http://localhost:2002` (Windows) or `open http://localhost:2002` (Mac)
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

# Design Contributor Setup Guide

This guide gets you from zero to running EverySkill locally so you can experiment with design changes and propose them via pull request.

## Prerequisites

You need these installed on your Mac:

1. **Git** — probably already installed. Open Terminal and run `git --version`
2. **Node.js 22+** — install from https://nodejs.org (LTS is fine)
3. **pnpm** — after Node is installed, run: `npm install -g pnpm`
4. **Docker Desktop** — for the local database. Download from https://www.docker.com/products/docker-desktop/
5. **Claude Desktop** — your AI assistant for making changes

## Step 1: Get Repository Access

Ask Trevor to add your GitHub account as a collaborator on the repo. If you don't have a GitHub account, create one at https://github.com.

## Step 2: Clone the Repo

Open Terminal and run:

```bash
git clone https://github.com/OGPermanerd/relay.git ~/projects/everyskill
cd ~/projects/everyskill
```

## Step 3: Set Up Environment

```bash
# Copy the example env file
cp .env.example .env.local
```

Now edit `.env.local` and fill in the Google OAuth credentials. Ask Trevor to send you the `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` values directly (these are secrets and not stored in the repo).

## Step 4: Start the Database

```bash
# Start PostgreSQL in Docker
pnpm docker:up

# Wait a few seconds, then set up the database schema
pnpm db:push
```

## Step 5: Install Dependencies and Run

```bash
# Install all packages
pnpm install

# Start the dev server
cd apps/web && pnpm dev
```

The app is now running at **http://localhost:2002**. Sign in with your Google account.

## Step 6: Open in Claude Desktop

1. Open Claude Desktop
2. Click the project/folder icon and select `~/projects/everyskill`
3. Claude will read the project's instructions automatically and understand the design workflows

## Daily Workflow

### Starting your day
```bash
cd ~/projects/everyskill
git pull                    # get latest changes
pnpm install                # in case dependencies changed
pnpm docker:up              # make sure DB is running
cd apps/web && pnpm dev     # start dev server
```

### Working with Claude Desktop

Once the project is open in Claude Desktop, you can say things like:

- **"Try making the header background a gradient from #1a1a2e to #16213e"**
- **"Use this logo instead"** (drag and drop an image file into the chat)
- **"Make the nav links larger and add more spacing"**
- **"Show me what the skills page looks like with a card layout instead of a table"**

Claude will edit the code and you'll see changes live at http://localhost:2002.

### When you like a change

Say: **"Propose this change"**

Claude will:
1. Create a branch named `design/your-change-description`
2. Commit the changes with a clear description
3. Push the branch and open a pull request
4. Give you the PR link

Trevor's Claude will review the PR and either merge it, suggest tweaks, or discuss.

### Leaving feedback without code changes

Say: **"Leave feedback: the spacing on the analytics page feels too tight"**

Claude will add it to the project feedback log for Trevor to review.

## Useful Things to Know

- **The design lives in these files:**
  - `apps/web/app/globals.css` — global styles
  - `apps/web/lib/header-theme.ts` — header color scheme (`"dark"` or `"light"`)
  - `apps/web/components/` — all UI components
  - `apps/web/app/(protected)/layout.tsx` — the main app layout with header
  - `apps/web/public/` — logos and static images
  - `tailwind.config.ts` — Tailwind theme (colors, fonts, spacing)

- **Don't worry about breaking things** — your changes stay on your machine and your branch. Nothing goes live until Trevor approves.

- **If something breaks**, tell Claude: "Reset my changes and start fresh" — it will `git stash` or `git checkout` to get you back to a clean state.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `pnpm: command not found` | Run `npm install -g pnpm` |
| `docker: command not found` | Install Docker Desktop and restart Terminal |
| Database connection error | Run `pnpm docker:up` and wait 10 seconds |
| Port 2002 already in use | Kill the old process: `npx kill-port 2002` |
| Google sign-in doesn't work | Check `.env.local` has the correct `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` |

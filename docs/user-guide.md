# EverySkill User Guide

## What is EverySkill?

EverySkill is your organization's skill marketplace for AI tools. Share prompts, workflows, and agent configurations with your team, track their impact, and continuously improve them together.

---

## Signing In

1. Go to `https://everyskill.ai`
2. Click **Sign in with Google** using your company email
3. You're in — your account is created automatically

---

## Home Page

After signing in, you'll see:

- **Platform stats** — total FTE days saved, uses, and downloads across your org
- **Trending skills** — skills with growing usage
- **Leaderboard** — top contributors by impact
- **Quick actions** — "Share a Skill" and "Install a Skill"

---

## Browsing Skills (`/skills`)

The skills page is a searchable, filterable table of all published skills.

### Search
Type in the search bar to find skills by name or description.

### Filters
- **Category** — Prompt, Workflow, Agent, MCP
- **Sort by** — Uses, Quality, Rating, Days Saved
- **Author** — filter by a specific contributor

### Skill Details
Click any skill to see its full detail page:
- Description, category, tags
- Usage stats and ratings
- AI review scores
- Full content/instructions
- Install button
- Similar skills
- Fork history

---

## Installing a Skill

### For Claude Desktop / Claude Code (MCP)

The recommended way to use skills is through MCP integration, which makes all skills available directly in your AI tool.

**One-time setup:**

1. Go to your **Profile** page
2. Find the **Integration Setup** section
3. Follow the 3-step wizard:

   **Step 1:** Click "Generate Connection Key" — copy the key immediately (shown only once)

   **Step 2:** Add this to your AI tool's MCP config:
   ```json
   {
     "mcpServers": {
       "everyskill-skills": {
         "command": "npx",
         "args": ["-y", "@everyskill/mcp"],
         "env": {
           "EVERYSKILL_API_KEY": "your-key-here"
         }
       }
     }
   }
   ```

   **Step 3:** Restart your AI tool

After setup, you can ask Claude: *"List all available skills from EverySkill"* or use any skill by name.

### Manual Install

On any skill's detail page, click the **Install** button to see platform-specific instructions:
- **Claude Desktop** — auto-install script (bash or PowerShell)
- **Claude Code** — config snippet
- **Other IDEs** — generic MCP config
- **Other Systems** — API endpoint details

---

## Sharing a Skill (`/skills/new`)

### Creating a New Skill

1. Click **Share a Skill** on the home page or navigate to `/skills/new`
2. Fill in the form:
   - **Name** — descriptive title
   - **Description** — what the skill does and when to use it
   - **Category** — Prompt, Workflow, Agent, or MCP
   - **Tags** — keywords for discovery
   - **Usage Instructions** — how to use the skill effectively
   - **Hours Saved** — estimated time saved per use
   - **Content** — the actual skill (markdown with instructions)

3. Submit — the system checks for similar existing skills:
   - If duplicates found, you can **Create as Variation** (fork) or **Publish Anyway**
   - If no duplicates, the skill enters the review pipeline

### Importing from a File

You can drag & drop a markdown file into the form. If it contains EverySkill frontmatter (from a previously exported skill), the form auto-fills.

### Review Process

After submission:
1. AI automatically reviews your skill for quality, clarity, and safety
2. If it passes, the skill is auto-published
3. If it needs human review, an admin will approve or request changes
4. You'll get a notification when the status changes

### My Skills (`/my-skills`)

View all skills you've created, their status, usage stats, and ratings.

---

## Forking a Skill

See a skill you want to improve? Fork it:

1. Open the skill's detail page
2. Click **Fork**
3. A new skill is created with the same content, tagged "Forked from [original]"
4. Edit and publish your version

The original skill shows a fork count, and your fork links back to the parent.

---

## Rating & Reviewing

On any skill's detail page:
- **Star rating** — 1 to 5 stars
- **Comment** — optional written review
- **Hours saved estimate** — your actual time saved (overrides the creator's estimate)

Honest ratings help the best skills rise to the top.

---

## Your Profile (`/profile`)

Your profile shows:
- **Contribution stats** — skills shared, total uses, avg rating, FTE days saved
- **Contributor tier** — Platinum, Gold, Silver, or Bronze based on your contributions
- **Integration Setup** — manage your MCP connection and API keys

### Contributor Tiers

| Tier | Criteria |
|------|----------|
| Platinum | 10+ skills, 4.5+ avg rating, 500+ uses |
| Gold | 5+ skills, 4.0+ avg rating, 100+ uses |
| Silver | 3+ skills, 3.5+ avg rating, 25+ uses |
| Bronze | 1+ skill shared |

Your tier badge appears next to your name in the header.

---

## Notifications

The bell icon in the header shows unread notifications:
- Skill status changes (approved, changes requested)
- Review notifications for admins
- Platform updates

Configure notification preferences at **Settings → Notifications** (`/settings/notifications`):
- Toggle email and in-app notifications per type
- Set trending digest frequency (weekly or never)

---

## Analytics (`/analytics`)

See how skills are being used across your organization:
- **Overview** — key metrics and trends
- **Employees** — who's using which skills
- **Skills** — adoption and impact per skill
- **Export** — download data as CSV

---

## Tips

- **Search in your AI tool** — once MCP is set up, ask Claude to find and use skills naturally
- **Fork and improve** — if a skill almost works for you, fork it and make it better
- **Rate everything** — your ratings help everyone find the best skills
- **Track your impact** — the FTE Days Saved metric shows the real value you're creating

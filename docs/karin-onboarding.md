# Welcome to EverySkill Design — Setup for Karin

Hi Karin! This guide gets you set up to give design feedback and propose changes to EverySkill using Claude Desktop. No coding or terminal required.

## What you'll be doing

- Browse the live app at **https://everyskill.ai** and tell Claude what you think
- Describe design changes you'd like to see (colors, layout, logos, spacing)
- Claude will capture your feedback and package design proposals for Trevor to review

## Setup (5 minutes)

### Step 1: Open Claude Desktop

You should already have this installed. Open it up.

### Step 2: Create a new Project

1. In the left sidebar, click **Projects** (or the folder icon)
2. Click **Create Project**
3. Name it: **EverySkill Design**

### Step 3: Set the project instructions

In the project settings, find the **Custom Instructions** or **System Prompt** field and paste everything from the section below marked "PASTE THIS AS PROJECT INSTRUCTIONS".

### Step 4: Start chatting

Open a new chat inside the **EverySkill Design** project. You're ready to go!

---

## PASTE THIS AS PROJECT INSTRUCTIONS

```
You are helping Karin, a design contributor for EverySkill (https://everyskill.ai), an internal AI skill marketplace. Karin reviews the live app and proposes visual improvements.

ABOUT THE APP:
- EverySkill is a skill marketplace where teams share, discover, and improve AI skills (prompts, workflows, agent configs)
- It has a dark navy header, skill browse page with table layout, analytics dashboard, user profiles, and admin settings
- The tech stack is Next.js, Tailwind CSS, TypeScript — but Karin doesn't need to know this
- The live app is at https://everyskill.ai

YOUR ROLE:
Help Karin with three workflows:

1. DESIGN FEEDBACK
When Karin describes something she likes or dislikes about a page, format it as structured feedback:

📋 FEEDBACK
Page: [which page/area]
Date: [today's date]
Type: [improvement / bug / idea]
Description: [what she said, cleaned up]
Priority: [her sense of importance, or ask]

Collect these throughout the conversation. When she says "send my feedback" or at the end of a session, compile all feedback into a single organized summary she can copy and email to Trevor.

2. DESIGN PROPOSALS
When Karin wants to try a visual change (new colors, different layout, logo swap, etc.):
- Discuss the idea with her — ask clarifying questions about her vision
- Describe what the change would look like in specific detail
- Write the exact code changes needed (CSS/component edits) as a "Design Proposal"
- Format it clearly so Trevor's Claude can apply it directly

📐 DESIGN PROPOSAL
Title: [short name]
Description: [what changes and why]
Pages affected: [which pages]
Files to change:
- `[file path]`: [description of change]
Code changes:
[exact code diffs or replacement snippets]

3. LOGO AND ASSET CHANGES
When Karin shares an image (drag and drop) or describes a logo/icon change:
- Note the file name and what it should replace
- The current logos live in `apps/web/public/` (everyskill-logo.svg and everyskill-logo-dark.svg)
- Source logos are in `logos/` directory
- Format as a design proposal with the asset swap noted

COMMUNICATION STYLE:
- Be friendly and conversational
- Never use technical jargon unless she asks
- When she describes something visually ("make it more airy", "the blue feels cold"), translate that into specific design language (spacing, color values, opacity)
- Show her color swatches as hex codes with descriptions: "#1a1a2e — deep midnight navy"
- If she's unsure, offer 2-3 options to choose from

CURRENT DESIGN DETAILS (for reference):
- Header: dark theme, background #0b1624, borders #1a3050
- Nav text: #7a9ab4 (inactive), #dbe9f6 (active/hover)
- Active nav border: #9fc5ff
- Body background: gray-50 (Tailwind)
- Accent colors: blue-500, blue-600
- Font: system sans-serif stack
- Logo: SVG, displayed at 48px height in header
- Contributor tiers: Platinum (purple), Gold (yellow), Silver (gray), Bronze (orange)

KEY FILES (for proposals):
- apps/web/lib/header-theme.ts — "dark" or "light" header mode
- apps/web/app/globals.css — global styles
- apps/web/app/(protected)/layout.tsx — main layout with header
- apps/web/components/ — all UI components
- apps/web/public/ — logos and images
- tailwind.config.ts — theme colors, fonts, spacing

At the start of each session, greet Karin and ask what she'd like to work on today. Suggest she browse https://everyskill.ai first if she hasn't recently.
```

---

## How to use it — Examples

Once you're in a chat inside your EverySkill Design project, just talk naturally. Here are some things you can say:

### Giving feedback
- "I just looked at the home page and the trending skills section feels cramped"
- "The sign-out button is really hard to find"
- "I love the dark header but the nav links need more contrast"
- "Send my feedback" ← Claude compiles everything into an email-ready summary

### Proposing design changes
- "What if we made the header a gradient instead of flat?"
- "Try a warmer color palette — think sunset tones"
- "The skills table should use cards on mobile"
- "Can we make the logo bigger in the header?"

Claude will describe the change in detail and write the exact code Trevor needs to implement it.

### Working with logos
- Drag and drop a new logo file into the chat
- "Use this as the dark mode logo"
- "Can you make the logo area wider?"

### At the end of a session
- "Wrap up my session" ← Claude summarizes all feedback and proposals
- Copy the summary and email it to Trevor — his Claude can read it and apply any proposals directly

---

## Tips

- **Browse the live app first** at https://everyskill.ai — sign in with your k@fncr.com Google account
- **Be specific** — "the blue on the header" is good, "the thing on the page" is harder to act on
- **It's OK to change your mind** — say "actually, go back to the first option"
- **Screenshots help** — paste a screenshot into the chat if you want to point at something specific
- **Nothing goes live** until Trevor approves it — you can't break anything!

## Questions?

Ask Trevor, or just ask Claude in your project — it knows the app inside and out.

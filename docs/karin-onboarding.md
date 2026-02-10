# EverySkill Design Contributor — Getting Started

Hi Karin! This gets you set up to give design feedback and try out visual changes on EverySkill. Your Claude will send everything to Trevor's Claude through git — no email or copy-paste needed.

## One-time setup (15 minutes)

### 1. Install everything from PowerShell

Open **PowerShell** (search for it in the Start menu) and run these commands one at a time:

```powershell
winget install Git.Git
winget install OpenJS.NodeJS.LTS
```

Close PowerShell and reopen it (so it picks up the new tools), then run:

```powershell
npm install -g @anthropic-ai/claude-code
```

That's it — Git, Node.js, and Claude Code are all installed.

### 2. Set up your GitHub account

If you don't have one already:
1. Create an account at https://github.com
2. Send Trevor your GitHub username so he can give you access to the project

### 3. Run Claude Code for the first time

Open **PowerShell** and type:

```
claude
```

Claude will start up and ask you to sign in. Follow the prompts to connect your Anthropic account.

### 4. Let Claude set up the project

Once Claude is running, paste this message:

```
I'm Karin, a design contributor for EverySkill. Please help me get set up:

1. Clone https://github.com/OGPermanerd/relay.git into a folder called everyskill in my home directory
2. Read the CLAUDE.md to understand the design collaboration workflow
3. Tell me you're ready and explain what I can do
```

Claude will clone the project and read the instructions. You're done with setup!

## How to start a feedback session

Any time you want to give feedback or try design changes, open **PowerShell** and type:

```
cd ~/everyskill
claude
```

Then say something like:

> "Hi! I just browsed everyskill.ai and I have some feedback and ideas."

Claude will pull the latest code and ask what you'd like to work on.

## What you can do

### Give feedback on the live site
Browse https://everyskill.ai in your browser, then tell Claude:

- "The header feels too dark — it needs more contrast"
- "The spacing on the skills page is cramped on my screen"
- "I love the logo but the nav links are hard to read"
- "The sign-out button should be more visible"

Claude will write up your feedback, commit it, and send it to Trevor as a pull request.

### Try out design changes
Describe what you want to see:

- "What if we used a warmer color palette? Think sunset tones"
- "Make the header a gradient instead of flat"
- "Try making the logo bigger"
- "What would it look like with rounded cards instead of a table?"

Claude will make the changes in the code. You won't see them live (that requires a local dev server), but Claude will describe exactly what it changed and create a pull request with full details for Trevor.

### Share a new logo or image
Drag an image file into the Claude chat, or say:

- "I made a new logo, use this" (then paste or drag the file)
- "Try this color for the header background: #2d1b4e"

### Wrap up a session
When you're done:

- "That's all for today, send everything to Trevor"

Claude will make sure all your feedback and proposals are committed and pushed.

## What happens after you submit?

1. Trevor's Claude sees your pull request
2. It reads your feedback and the exact code changes
3. Trevor reviews it and either merges it (goes live!), tweaks it, or discusses with you
4. You'll see the PR status on GitHub

## Tips

- **You can't break anything** — your changes go on a separate branch, never the live site
- **Be specific** — "the blue on the header" is better than "the thing on the page"
- **Screenshots help** — paste screenshots into the Claude chat
- **It's OK to change your mind** — "undo that" or "go back to how it was" works
- **Each session is fresh** — Claude pulls the latest code at the start

## Quick reference

| You say | What happens |
|---------|-------------|
| "I have feedback about the home page" | Claude writes structured feedback → PR |
| "Try making the header lighter" | Claude edits the code → shows you what changed |
| "I like this, propose it" | Claude commits + pushes + opens a PR |
| "Undo that" | Claude reverts the change |
| "Wrap up my session" | Claude commits any remaining work + pushes |

## Need help?

Just ask Claude — it knows the entire codebase. Or message Trevor.

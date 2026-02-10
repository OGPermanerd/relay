# Claude Desktop Welcome Message for Design Contributors

Copy everything below the line and paste it as your first message in Claude Desktop after attaching the `~/projects/everyskill` folder.

---

Hi Claude! I'm a design contributor on EverySkill. Before we start, please read the CLAUDE.md in this project — it has the design collaboration conventions.

Here's how I'd like to work together:

**My role:** I review the live app at https://everyskill.ai and experiment with visual changes locally at http://localhost:2002.

**What I need you to help with:**

1. **Design experiments** — When I describe a visual change (colors, layout, spacing, logos, fonts), make the code changes so I can see them locally. I'll tell you if I like them or want to try something different.

2. **Proposing changes** — When I say "propose this change", create a git branch, commit, push, and open a pull request so Trevor can review it. Follow the conventions in CLAUDE.md.

3. **Leaving feedback** — When I say "leave feedback" followed by a comment about a page or feature, log it in docs/feedback-log.md with today's date.

4. **Explaining the app** — If I ask what something does or how a page works, explain it simply without technical jargon.

**Before we start, please:**
- Check if the dev server is running at http://localhost:2002 (try `curl -s http://localhost:2002/api/health`)
- If not, start it: `cd apps/web && pnpm dev`
- Confirm you're ready

**Here are some examples of things I might ask:**
- "The header feels too dark, try a lighter navy"
- "Swap the logo for this one" (I'll drag a file in)
- "What if the skills page used cards instead of a table?"
- "Leave feedback: the sign-out button is hard to find on mobile"
- "I like this — propose this change"
- "Undo that, go back to how it was"
- "Show me what the profile page looks like"

Let's go!

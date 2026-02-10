# EverySkill Tenant Admin Guide

## What is a Tenant Admin?

When your organization is set up on EverySkill, the **first person to sign in** with your company email domain is automatically promoted to admin. Admins can manage skills, users, and organization settings.

---

## Getting Started

1. Visit `https://everyskill.ai` (or your organization's subdomain if configured)
2. Click **Sign in with Google** using your company email
3. If you're the first person from your domain, you'll be admin automatically

---

## Admin Menu

The **Admin** link appears in the navigation bar (only visible to admins). It leads to these pages:

### Skill Reviews (`/admin/reviews`)

All new skills go through a review pipeline before being published:

1. **Author submits** a skill → status becomes `pending_review`
2. **AI review** runs automatically — scores quality, clarity, completeness, and safety
3. If the AI review passes all thresholds, the skill is **auto-approved**
4. Otherwise, it lands in your review queue

**Actions you can take:**
- **Approve** — publishes the skill to the marketplace
- **Request Changes** — sends it back to the author with a message explaining what to fix
- **Reject** — removes it from the queue

### Organization Settings (`/admin/settings`)

Configure your organization:

- **Organization Name** — displayed in the header and throughout the app
- **Email Domain** — the `@domain.com` that controls who can sign in (e.g., `fncr.com`)
- **Logo URL** — your company logo for branding

Also configures the **semantic similarity engine** (Ollama) for duplicate skill detection.

### Skills Management (`/admin/skills`)

Overview of all skills in your organization with summary stats (total skills, total uses).

### Merge Tool (`/admin/merge`)

When duplicate skills exist:

1. Select the **source** skill (the duplicate to remove)
2. Select the **target** skill (the one to keep)
3. Confirm — all usage events, ratings, and forks transfer to the target, then the source is deleted

### API Keys (`/admin/keys`)

Generate and manage API keys for employees who use MCP integration:

- **Generate** keys for any user
- **View** key prefix + last used date
- **Revoke** keys instantly

### Compliance (`/admin/compliance`)

Tracks which employees have the MCP integration actively running (PostToolUse hooks firing). Shows:

- Users with active hooks (last 30 days)
- Compliance rate percentage
- Last activity timestamp per user

---

## Managing Users

### How Users Join

Anyone with a Google account matching your email domain can sign in — no invitations needed. Their account is created automatically on first sign-in as a **member**.

### Promoting a User to Admin

Currently done via database. Contact your system administrator to run:

```sql
UPDATE users SET role = 'admin' WHERE email = 'colleague@yourcompany.com';
```

### Removing a User

Contact your system administrator to remove a user from the database.

---

## Skill Lifecycle

```
Author creates skill
        │
        ▼
    [draft]
        │  author submits for review
        ▼
  [pending_review]
        │  AI reviews automatically
        ▼
  [ai_reviewed] ──────────────────┐
        │                         │
   (passes threshold)      (needs human review)
        │                         │
        ▼                         ▼
  [auto-approved]         Admin review queue
        │                    │          │
        │              [approve]   [request changes]
        │                    │          │
        ▼                    ▼          ▼
   [published]         [published]  [changes_requested]
                                        │
                                   author edits + resubmits
```

---

## Setting Up MCP for Your Team

MCP (Model Context Protocol) lets employees use EverySkill skills directly from Claude Desktop, Claude Code, or other AI tools.

### Rollout Steps

1. Ensure your org's email domain is configured in Admin Settings
2. Have each employee go to their **Profile** page
3. They click **Integration Setup** and follow the 3-step wizard:
   - Generate a connection key
   - Configure their AI tool with the provided JSON config
   - Restart their AI tool
4. Monitor adoption on the **Compliance** page

### What Employees Need

- A Google account with your company email
- Claude Desktop, Claude Code, or another MCP-compatible tool
- The `EVERYSKILL_API_KEY` environment variable set to their generated key

---

## Analytics (`/analytics`)

The analytics dashboard shows organization-wide skill adoption:

- **Overview** — total uses, unique users, top skills, trend charts
- **Employees** — per-user breakdown of skill usage and participation
- **Skills** — which skills are most/least used, rating trends
- **CSV Export** — download any view for reporting

Time range options: 7 days, 14 days, 30 days, 90 days, 1 year, all-time.

---

## FAQ

**Q: Can I restrict sign-in to specific people (not the whole domain)?**
A: Not currently. Anyone with a `@yourdomain.com` Google account can sign in. You can remove individual users after the fact via the database.

**Q: Can I have multiple email domains for one organization?**
A: Not yet — each tenant supports one email domain. Multiple domains require multiple tenants.

**Q: How do I change my organization's email domain?**
A: Go to Admin → Settings and update the Email Domain field. Existing users keep their accounts; new sign-ins must match the new domain.

**Q: What happens if I deactivate the organization?**
A: No one from that email domain can sign in. Existing sessions (up to 8 hours) continue to work until they expire.

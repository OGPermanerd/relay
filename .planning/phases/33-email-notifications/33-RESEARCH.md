# Phase 33: Email & Notifications - Research

**Researched:** 2026-02-08
**Domain:** Email delivery, notification systems, background jobs
**Confidence:** HIGH

## Summary

Phase 33 implements a comprehensive notification system with email delivery via Resend and in-app notifications. The research identifies industry-standard patterns for React-based email templates using React Email, notification preferences management with database-backed settings, and background job scheduling for digest emails. The stack is well-established: Resend for email delivery (currently stubbed to console.log), React Email for type-safe templates, and Vercel Cron Jobs for scheduled digests. Key architectural concerns include tenant-awareness (leveraging Phase 25 infrastructure), avoiding N+1 query problems in notification counts, and ensuring GDPR/CAN-SPAM compliance through granular opt-out controls.

**Primary recommendation:** Use Resend with React Email for all email delivery (stub to console until API key available), create separate notifications and notification_preferences tables with tenant_id, implement unread count aggregation with proper indexing, and use Vercel Cron Jobs for digest scheduling. Build notification UI as a dropdown from header bell icon with real-time count, reusing existing RelativeTime and layout patterns.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| resend | ^4.0.0 | Email delivery API | Official Vercel-recommended email service, simple API, React Email integration |
| @react-email/components | ^0.0.28 | Email template components | Industry standard for React-based email templates, full TypeScript support |
| @react-email/render | ^1.0.3 | Convert React to HTML email | Generates inline CSS HTML from React components, async with React 19 |
| zod | ^3.25.0 | Runtime validation | Already in project, validates email template data and notification payloads |
| drizzle-orm | ^0.42.0 | Database queries | Already in project, used for notifications and preferences tables |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @react-email/font | ^0.2.0 | Web fonts in emails | If custom fonts needed (optional) |
| @react-email/tailwind | ^1.0.4 | Tailwind styles in email | If matching web app styles (optional) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Resend | SendGrid | More enterprise features but heavier API, more config overhead |
| Resend | Postmark | Excellent deliverability but higher cost, less Next.js integration |
| Resend | Nodemailer | Full control but managing SMTP, IP reputation, bounce handling manually |
| React Email | MJML | Alternative email templating but not React-based, JSX advantages lost |
| Vercel Cron | Inngest | More powerful orchestration but external dependency, cost, auth complexity |
| Vercel Cron | Custom scheduler | More control but managing state, retries, observability manually |

**Installation:**
```bash
# In apps/web
pnpm add resend @react-email/components @react-email/render

# Development preview (optional)
pnpm add -D react-email
```

## Architecture Patterns

### Recommended Project Structure
```
apps/web/
├── emails/                    # React Email templates
│   ├── grouping-proposal.tsx  # NOTIF-04: Someone wants to group under your skill
│   ├── trending-digest.tsx    # NOTIF-05: Daily/weekly trending skills
│   ├── platform-update.tsx    # NOTIF-06: Feature releases
│   └── components/            # Shared email components (header, footer, button)
├── app/
│   ├── api/
│   │   └── cron/
│   │       ├── daily-digest/route.ts    # Vercel Cron endpoint
│   │       └── weekly-digest/route.ts   # Vercel Cron endpoint
│   ├── actions/
│   │   └── notifications.ts   # Server actions for in-app notifications
│   └── (protected)/
│       ├── layout.tsx         # Add notification bell icon here
│       └── notifications/
│           └── page.tsx       # NOTIF-02: Notification center
│       └── settings/
│           └── notifications/
│               └── page.tsx   # NOTIF-03: Preferences page
├── components/
│   ├── notification-bell.tsx  # Bell icon with unread badge
│   └── notification-list.tsx  # Dropdown notification list
└── lib/
    ├── email.ts               # Resend client, send functions (stubbed)
    └── notifications.ts       # Notification creation helpers

packages/db/src/
├── schema/
│   ├── notifications.ts       # In-app notifications table
│   └── notification-preferences.ts  # User preferences table
└── services/
    ├── notifications.ts       # CRUD for notifications
    └── notification-preferences.ts  # Preference management
```

### Pattern 1: Stubbed Email Delivery (Current Phase)
**What:** Resend client configured but outputs to console.log instead of sending
**When to use:** When API key not available but need to build full infrastructure
**Example:**
```typescript
// apps/web/lib/email.ts
import { Resend } from 'resend';
import { render } from '@react-email/render';

// Stub mode: no API key, log to console
const STUB_MODE = !process.env.RESEND_API_KEY;
const resend = STUB_MODE ? null : new Resend(process.env.RESEND_API_KEY);

export async function sendEmail({
  to,
  subject,
  react
}: {
  to: string;
  subject: string;
  react: React.ReactElement;
}) {
  const html = await render(react);

  if (STUB_MODE) {
    console.log('[EMAIL STUB]', {
      to,
      subject,
      html: html.substring(0, 200) + '...',
      timestamp: new Date().toISOString()
    });
    return { success: true, id: 'stub-' + Date.now() };
  }

  const result = await resend!.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to,
    subject,
    html
  });

  return result;
}
```

### Pattern 2: Notification Database Schema with Tenant Isolation
**What:** Two tables with tenant_id, proper indexes, RLS policies matching Phase 25 patterns
**When to use:** All notification storage and preference queries
**Example:**
```typescript
// packages/db/src/schema/notifications.ts
import { pgTable, text, timestamp, boolean, index, pgPolicy } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { tenants } from "./tenants";
import { users } from "./users";

export const notifications = pgTable(
  "notifications",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    tenantId: text("tenant_id").notNull().references(() => tenants.id),
    userId: text("user_id").notNull().references(() => users.id),
    type: text("type").notNull(), // grouping_proposal | trending_digest | platform_update
    title: text("title").notNull(),
    message: text("message").notNull(),
    actionUrl: text("action_url"),
    metadata: text("metadata"), // JSON string for type-specific data
    isRead: boolean("is_read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (table) => [
    index("notifications_user_id_idx").on(table.userId),
    index("notifications_tenant_id_idx").on(table.tenantId),
    index("notifications_user_unread_idx").on(table.userId, table.isRead), // Optimize unread count
    pgPolicy("tenant_isolation", {
      as: "restrictive",
      for: "all",
      using: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
    }),
  ]
);
```

### Pattern 3: Unread Count Aggregation (Avoid N+1)
**What:** Single query with COUNT aggregate, cached in component state
**When to use:** Bell icon unread badge
**Example:**
```typescript
// packages/db/src/services/notifications.ts
import { db } from "../client";
import { notifications } from "../schema";
import { eq, and, count } from "drizzle-orm";

export async function getUnreadCount(userId: string): Promise<number> {
  const [result] = await db
    .select({ count: count() })
    .from(notifications)
    .where(and(
      eq(notifications.userId, userId),
      eq(notifications.isRead, false)
    ));
  return result?.count ?? 0;
}
```

### Pattern 4: React Email Template with Type Safety
**What:** React component with props interface, Zod validation at call site
**When to use:** All email templates
**Example:**
```typescript
// apps/web/emails/grouping-proposal.tsx
import { Html, Head, Body, Container, Section, Text, Link, Button } from '@react-email/components';

interface GroupingProposalEmailProps {
  recipientName: string;
  proposerName: string;
  proposerEmail: string;
  skillName: string;
  parentSkillName: string;
  message: string;
  actionUrl: string;
}

export default function GroupingProposalEmail({
  recipientName,
  proposerName,
  skillName,
  parentSkillName,
  actionUrl
}: GroupingProposalEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: 'sans-serif', backgroundColor: '#f9fafb' }}>
        <Container style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
          <Section style={{ backgroundColor: '#ffffff', padding: '32px', borderRadius: '8px' }}>
            <Text style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px' }}>
              Skill Grouping Request
            </Text>
            <Text style={{ fontSize: '16px', lineHeight: '24px', marginBottom: '16px' }}>
              Hi {recipientName},
            </Text>
            <Text style={{ fontSize: '16px', lineHeight: '24px', marginBottom: '16px' }}>
              {proposerName} wants to group their skill <strong>{skillName}</strong> under your skill <strong>{parentSkillName}</strong>.
            </Text>
            <Button
              href={actionUrl}
              style={{
                backgroundColor: '#2563eb',
                color: '#ffffff',
                padding: '12px 24px',
                borderRadius: '6px',
                textDecoration: 'none',
                display: 'inline-block'
              }}
            >
              View Request
            </Button>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
```

### Pattern 5: Vercel Cron Job with Secret Verification
**What:** API route protected by CRON_SECRET header, idempotent digest generation
**When to use:** Scheduled digest emails
**Example:**
```typescript
// apps/web/app/api/cron/daily-digest/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Security: verify cron secret
  const authHeader = request.headers.get('authorization');
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

  if (authHeader !== expectedAuth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Idempotency: check if already ran today
  const today = new Date().toISOString().split('T')[0];
  // ... check last run timestamp in DB or cache

  // Fetch users with daily digest preference enabled
  // Generate digest emails
  // Send via stubbed Resend

  return NextResponse.json({ success: true, sent: 42 });
}
```

### Pattern 6: Notification Preferences with Opt-Out Defaults
**What:** Preferences table with per-type toggles, digest frequency enum, defaults allow all
**When to use:** GDPR/CAN-SPAM compliance, user control
**Example:**
```typescript
// packages/db/src/schema/notification-preferences.ts
import { pgTable, text, boolean, pgEnum, timestamp, index, pgPolicy } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const digestFrequencyEnum = pgEnum("digest_frequency", ["none", "daily", "weekly"]);

export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    tenantId: text("tenant_id").notNull().references(() => tenants.id),
    userId: text("user_id").notNull().unique().references(() => users.id),

    // Per-type toggles (default true = opt-out model)
    groupingProposalEmail: boolean("grouping_proposal_email").notNull().default(true),
    groupingProposalInApp: boolean("grouping_proposal_in_app").notNull().default(true),

    // Digest frequency
    trendingDigest: digestFrequencyEnum("trending_digest").notNull().default("weekly"),

    // Platform updates
    platformUpdatesEmail: boolean("platform_updates_email").notNull().default(true),
    platformUpdatesInApp: boolean("platform_updates_in_app").notNull().default(true),

    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("notification_preferences_tenant_id_idx").on(table.tenantId),
    pgPolicy("tenant_isolation", {
      as: "restrictive",
      for: "all",
      using: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
    }),
  ]
);
```

### Anti-Patterns to Avoid
- **Polling for notifications:** Use unread count cached in server component, refresh on user action or page load, not interval polling
- **Sending emails synchronously in request path:** Queue notification creation, send emails async (current phase: stub logs immediately, production: background job)
- **Global notification queries without userId filter:** Always filter by userId AND tenantId via RLS
- **Hand-rolling email HTML:** Use React Email components for cross-client compatibility
- **Storing preferences in JSON column:** Use typed columns for queryability (e.g., WHERE trending_digest = 'daily')

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Email HTML templates | Custom HTML strings with template literals | React Email components | Cross-client rendering is extremely complex (Outlook, Gmail, Apple Mail), React Email handles inline CSS, DOCTYPE, table layouts |
| SMTP connection management | Direct nodemailer with custom retry logic | Resend API | IP reputation, bounce handling, deliverability monitoring, SPF/DKIM/DMARC setup all managed |
| Cron job scheduler | Custom setInterval or node-cron in long-running process | Vercel Cron Jobs | Serverless architecture has no persistent process, Vercel handles scheduling, retries, observability |
| Notification read/unread state | Client-side localStorage or cookie flags | Database with isRead boolean + readAt timestamp | Multi-device sync, audit trail, query for analytics |
| Email unsubscribe tokens | Custom JWT or signed URLs | Database preference check + user settings page | Revocable, auditable, GDPR-compliant, no token expiry issues |
| Digest batching logic | Custom aggregation with file-based tracking | SQL GROUP BY with date ranges + preferences join | Handles concurrency, tenant isolation, preference filtering in one query |

**Key insight:** Email deliverability and cross-client rendering are far harder than they appear. Resend + React Email solve 90% of edge cases (SPF records, inline CSS, table layouts, tracking pixels, bounce handling). Custom solutions underestimate complexity and fail in production (Gmail clips messages, Outlook breaks layouts, ISPs blacklist IPs).

## Common Pitfalls

### Pitfall 1: N+1 Queries for Notification Lists
**What goes wrong:** Loading notifications one at a time or making separate queries for related data (user names, skill titles)
**Why it happens:** ORM convenience methods hide underlying queries, fetching notification.skill.title triggers N queries
**How to avoid:** Use Drizzle joins or WITH subqueries to fetch all related data in single query
**Warning signs:** Slow notification page load, database query count scales with notification count, multiple SELECT queries in logs

**Example prevention:**
```typescript
// BAD: N+1 queries
const notifications = await db.select().from(notifications).where(eq(notifications.userId, userId));
for (const notif of notifications) {
  const skill = await db.select().from(skills).where(eq(skills.id, notif.metadata.skillId)).limit(1);
  // ...
}

// GOOD: Single join query
const notifications = await db
  .select({
    id: notifications.id,
    title: notifications.title,
    message: notifications.message,
    createdAt: notifications.createdAt,
    skillName: skills.name,
    skillSlug: skills.slug
  })
  .from(notifications)
  .leftJoin(skills, eq(notifications.metadata, skills.id)) // Assume metadata stores skillId
  .where(eq(notifications.userId, userId))
  .orderBy(desc(notifications.createdAt))
  .limit(50);
```

### Pitfall 2: Email Deliverability Misconfiguration
**What goes wrong:** Emails land in spam or bounce entirely despite code working correctly
**Why it happens:** Missing SPF/DKIM/DMARC DNS records, unverified sender domain, "from" address doesn't match verified domain
**How to avoid:** Verify domain in Resend dashboard before sending, add all required DNS records (SPF, DKIM, DMARC), use subdomain for transactional emails (e.g., notify.everyskill.ai)
**Warning signs:** High bounce rate in Resend dashboard, emails never arrive, Gmail marks as spam, "via resend.com" warning in email clients

**Verification checklist:**
1. Add domain in Resend dashboard
2. Add DKIM TXT record: `resend._domainkey.everyskill.ai`
3. Add SPF TXT record: `v=spf1 include:_spf.resend.com ~all`
4. Add DMARC TXT record: `_dmarc.everyskill.ai` with policy `v=DMARC1; p=quarantine; rua=mailto:dmarc@everyskill.ai`
5. Wait 24-48 hours for DNS propagation
6. Test with mail-tester.com before production

### Pitfall 3: Vercel Cron Jobs Not Triggering
**What goes wrong:** Cron job configured but never runs, no logs, no emails sent
**Why it happens:** Only runs on production deployments (NOT preview), vercel.json missing or incorrect cron syntax, function timeout/error unreported
**How to avoid:** Deploy to production branch (not preview), verify vercel.json at project root, use CRON_SECRET for security, add comprehensive logging, check Vercel dashboard Cron Jobs tab
**Warning signs:** Zero invocations in Vercel dashboard, scheduled time passes with no logs, digest emails never sent

**Configuration example:**
```json
// vercel.json (project root)
{
  "crons": [
    {
      "path": "/api/cron/daily-digest",
      "schedule": "0 9 * * *"
    },
    {
      "path": "/api/cron/weekly-digest",
      "schedule": "0 9 * * 1"
    }
  ]
}
```

### Pitfall 4: Notification Count Badge Flickering
**What goes wrong:** Unread count badge appears/disappears or shows wrong count during page transitions
**Why it happens:** Server component re-fetches count on every navigation, race condition between mark-as-read action and count query, stale cache
**How to avoid:** Use optimistic UI updates (decrement immediately on client), server action returns updated count, bell icon uses client component with state
**Warning signs:** Badge flashes 0 then N, clicking notification doesn't update badge, badge shows 1 but list is empty

**Pattern:**
```typescript
// components/notification-bell.tsx (client component)
'use client';
import { useState, useTransition } from 'react';

export function NotificationBell({ initialCount }: { initialCount: number }) {
  const [count, setCount] = useState(initialCount);
  const [isPending, startTransition] = useTransition();

  const handleMarkRead = (notificationId: string) => {
    // Optimistic update
    setCount(prev => Math.max(0, prev - 1));

    startTransition(async () => {
      const newCount = await markNotificationRead(notificationId);
      setCount(newCount); // Server confirms actual count
    });
  };

  return (
    <button className="relative">
      <BellIcon />
      {count > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  );
}
```

### Pitfall 5: GDPR Non-Compliance with Opt-Out Only
**What goes wrong:** EU users receive emails without explicit consent, GDPR fines, user complaints
**Why it happens:** CAN-SPAM (US) allows opt-out model, GDPR (EU) requires opt-in, defaulting preferences to "true" violates GDPR for EU users
**How to avoid:** Detect user region (tenant domain or IP geolocation), require explicit opt-in during onboarding for EU users, default preferences to "false" for EU tenants, provide one-click unsubscribe in all emails
**Warning signs:** EU-based tenant complaints, legal notices, inability to export user data with preferences, missing unsubscribe link

**Compliance strategy:**
1. Check tenant region: if EU, require opt-in checkbox during first login
2. Email footer must include unsubscribe link: `/settings/notifications?unsubscribe=grouping_proposal`
3. Process unsubscribe within 10 business days (CAN-SPAM), immediately for GDPR
4. Log all preference changes with timestamp for audit trail
5. Provide data export including all notification preferences

### Pitfall 6: React Email Hydration Mismatches
**What goes wrong:** Email preview in development works but production emails have broken layouts or styles
**Why it happens:** React Email render() is async in React 19, missing await causes incomplete HTML, inline CSS not applied
**How to avoid:** Always await render(), use render({ pretty: false }) for production to minimize size, test with actual email clients not just browser preview
**Warning signs:** Emails show raw React code, styles not applied, Outlook breaks layout, Gmail clips message

**Correct usage:**
```typescript
// lib/email.ts
import { render } from '@react-email/render';
import GroupingProposalEmail from '@/emails/grouping-proposal';

export async function sendGroupingProposal(props: GroupingProposalEmailProps) {
  // MUST await render() in React 19
  const html = await render(<GroupingProposalEmail {...props} />, {
    pretty: false // Minify for production
  });

  return sendEmail({
    to: props.recipientEmail,
    subject: `${props.proposerName} wants to group a skill under yours`,
    html
  });
}
```

## Code Examples

Verified patterns from official sources:

### Resend Basic Integration (Next.js Server Action)
```typescript
// lib/email.ts
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendTransactionalEmail({
  to,
  subject,
  html
}: {
  to: string;
  subject: string;
  html: string;
}) {
  const { data, error } = await resend.emails.send({
    from: 'EverySkill <notifications@everyskill.ai>',
    to,
    subject,
    html,
    // Optional: track opens/clicks
    tags: [{ name: 'category', value: 'transactional' }]
  });

  if (error) {
    console.error('Resend error:', error);
    throw new Error('Failed to send email');
  }

  return data;
}
```

### React Email Complete Template with Layout
```typescript
// emails/components/email-layout.tsx
import { Html, Head, Body, Container, Section } from '@react-email/components';

export function EmailLayout({ children }: { children: React.ReactNode }) {
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: 'Arial, sans-serif', backgroundColor: '#f9fafb' }}>
        <Container style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
          <Section style={{ backgroundColor: '#ffffff', padding: '32px', borderRadius: '8px' }}>
            {children}
          </Section>
          <Section style={{ textAlign: 'center', padding: '16px', fontSize: '12px', color: '#6b7280' }}>
            <Text>© 2026 EverySkill. All rights reserved.</Text>
            <Link href="https://everyskill.ai/settings/notifications" style={{ color: '#2563eb' }}>
              Manage notification preferences
            </Link>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
```

### Notification Service with Tenant Context
```typescript
// packages/db/src/services/notifications.ts
import { db } from "../client";
import { notifications, users } from "../schema";
import { eq, and, desc } from "drizzle-orm";

export interface CreateNotificationParams {
  tenantId: string;
  userId: string;
  type: "grouping_proposal" | "trending_digest" | "platform_update";
  title: string;
  message: string;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
}

export async function createNotification(params: CreateNotificationParams) {
  const [notification] = await db
    .insert(notifications)
    .values({
      ...params,
      metadata: params.metadata ? JSON.stringify(params.metadata) : null
    })
    .returning();
  return notification;
}

export async function getUserNotifications(userId: string, limit = 50) {
  return db
    .select({
      id: notifications.id,
      type: notifications.type,
      title: notifications.title,
      message: notifications.message,
      actionUrl: notifications.actionUrl,
      isRead: notifications.isRead,
      createdAt: notifications.createdAt
    })
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function markNotificationAsRead(notificationId: string) {
  await db
    .update(notifications)
    .set({ isRead: true, readAt: new Date() })
    .where(eq(notifications.id, notificationId));
}
```

### Server Action for Creating Notification + Sending Email
```typescript
// app/actions/notifications.ts
'use server';

import { auth } from '@/auth';
import { createNotification } from '@everyskill/db/services/notifications';
import { getNotificationPreferences } from '@everyskill/db/services/notification-preferences';
import { sendEmail } from '@/lib/email';
import { render } from '@react-email/render';
import GroupingProposalEmail from '@/emails/grouping-proposal';

export async function notifyGroupingProposal({
  recipientId,
  recipientEmail,
  proposerName,
  skillName,
  parentSkillName,
  message
}: {
  recipientId: string;
  recipientEmail: string;
  proposerName: string;
  skillName: string;
  parentSkillName: string;
  message: string;
}) {
  const session = await auth();
  if (!session?.user?.tenantId) throw new Error('Not authenticated');

  const preferences = await getNotificationPreferences(recipientId);

  // Create in-app notification
  if (preferences?.groupingProposalInApp !== false) {
    await createNotification({
      tenantId: session.user.tenantId,
      userId: recipientId,
      type: 'grouping_proposal',
      title: 'Skill Grouping Request',
      message: `${proposerName} wants to group their skill under yours`,
      actionUrl: '/messages',
      metadata: { skillName, parentSkillName }
    });
  }

  // Send email notification
  if (preferences?.groupingProposalEmail !== false) {
    const emailHtml = await render(
      <GroupingProposalEmail
        recipientName={recipientEmail.split('@')[0]}
        proposerName={proposerName}
        skillName={skillName}
        parentSkillName={parentSkillName}
        message={message}
        actionUrl={`https://everyskill.ai/messages`}
      />
    );

    await sendEmail({
      to: recipientEmail,
      subject: `${proposerName} wants to group a skill under yours`,
      html: emailHtml
    });
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Nodemailer with SMTP | Resend/SendGrid/Postmark HTTP APIs | ~2020 | No SMTP config, better deliverability, simpler retry logic |
| Template strings with HTML | React Email / MJML | 2022-2023 | Type safety, component reuse, better cross-client compatibility |
| Custom cron with PM2/systemd | Vercel Cron Jobs / Inngest | 2023-2024 | No server management, automatic retries, observability built-in |
| Polling for notifications | Server-sent events / WebSockets | 2021-2022 | Real-time updates without polling overhead (not implemented this phase) |
| Global notification queries | Row-level security with tenant_id | 2024+ | Multi-tenant isolation at database level, no application-level filtering bugs |

**Deprecated/outdated:**
- **Direct SMTP with nodemailer:** Still works but managing IP reputation, bounce handling, and deliverability manually is not recommended for new projects
- **Template strings with inline HTML:** Fragile, no type safety, breaks in Outlook/Gmail without extensive testing
- **Long-polling for notifications:** Replaced by SSE or WebSockets for real-time, or periodic refetch for simpler cases
- **Storing preferences as JSON blobs:** Makes querying impossible (e.g., "all users with daily digest enabled"), use typed columns instead

## Open Questions

1. **Real-time notifications vs periodic refetch**
   - What we know: WebSockets/SSE provide real-time updates, periodic refetch simpler for serverless
   - What's unclear: User expectation for notification latency (instant vs 5-minute delay acceptable?)
   - Recommendation: Start with page-load refetch + optimistic updates, add real-time in future phase if users request it

2. **Notification retention policy**
   - What we know: Notifications should have limited retention to avoid unbounded growth
   - What's unclear: Delete after 90 days? Archive after 30 days? Keep unread indefinitely?
   - Recommendation: Implement soft-delete after 90 days with background cleanup job in future phase, document as TODO

3. **Email rate limiting per tenant**
   - What we know: Resend has account-wide rate limits, need tenant-level limits to prevent abuse
   - What's unclear: What's reasonable limit per tenant per day? 1000? 10000?
   - Recommendation: Start with no explicit limit, monitor Resend dashboard, add tenant-level throttling if abuse detected

4. **Digest email timezone handling**
   - What we know: Cron runs in UTC, users may want digest at local time (9am their timezone)
   - What's unclear: Store user timezone preference? Send all at same UTC time? Stagger by tenant?
   - Recommendation: Send all digests at 9am UTC initially, add timezone preference in future iteration if requested

## Sources

### Primary (HIGH confidence)
- [Send emails with Next.js - Resend](https://resend.com/docs/send-with-nextjs) - Integration patterns
- [React Email](https://react.email) - Component library
- [React Email Render utility](https://react.email/docs/utilities/render) - HTML generation
- [Vercel Cron Jobs Documentation](https://vercel.com/docs/cron-jobs) - Scheduling configuration
- [PostgreSQL Wiki: Database Schema Recommendations](https://wiki.postgresql.org/wiki/Database_Schema_Recommendations_for_an_Application) - Schema best practices

### Secondary (MEDIUM confidence)
- [Building In-App Notifications in Next.js - Stream](https://getstream.io/blog/in-app-notifications-nextjs/) - Architecture patterns
- [Email Deliverability in 2026: SPF, DKIM, DMARC Checklist](https://www.egenconsulting.com/blog/email-deliverability-2026.html) - DNS configuration
- [Privacy Laws 2026: Global Updates & Compliance Guide](https://secureprivacy.ai/blog/privacy-laws-2026) - GDPR/CAN-SPAM requirements
- [How to Secure Vercel Cron Job routes in Next.js 14 - CodingCat.dev](https://codingcat.dev/post/how-to-secure-vercel-cron-job-routes-in-next-js-14-app-router) - Security patterns

### Tertiary (LOW confidence)
- [Top 7 Notification Solutions for Next.js Application - DEV Community](https://dev.to/ethanleetech/top-7-notification-solutions-for-nextjs-application-160k) - Library comparison
- [Scalable Notification System Design for 50 Million Users - DEV Community](https://dev.to/ndohjapan/scalable-notification-system-design-for-50-million-users-database-design-4cl) - High-scale patterns (not immediately applicable)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Resend and React Email are industry standard for Next.js, Vercel Cron is official
- Architecture: HIGH - Patterns verified from official docs, database schema follows established multi-tenant patterns from Phase 25
- Pitfalls: MEDIUM-HIGH - Email deliverability and GDPR compliance best practices verified, Vercel Cron specific issues from official troubleshooting docs
- Code examples: HIGH - All examples adapted from official Resend and React Email documentation

**Research date:** 2026-02-08
**Valid until:** ~30 days (stable ecosystem, but check for Resend API changes and React Email React 19 updates)

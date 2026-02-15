import type { ClassifiedEmail } from "./email-classifier";
import type { CategoryBreakdownItem } from "./diagnostic-aggregator";

/**
 * Email work context extraction
 *
 * Extracts structured work signals from classified email metadata.
 * Focuses on what the user PRODUCES (sent emails, attachments, active threads)
 * rather than what they receive.
 *
 * Runs purely on in-memory data — no API calls.
 * Output feeds directly into the AI skill matching engine.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WorkContext {
  /** Top unique sent email subjects (RE:/FW: stripped, deduplicated by thread) */
  uniqueSentSubjects: string[];
  /** Top unique sent-with-attachment subjects */
  uniqueAttachmentSubjects: string[];
  /** Threads where user actively participates (sent replies) */
  activeThreads: { subject: string; userReplies: number }[];
  /** Mapped tool/service usage from sender domains */
  toolDomains: { domain: string; tool: string; count: number }[];
  /** Total sent messages in scan period */
  sentCount: number;
  /** Sent messages with attachments */
  sentWithAttachmentCount: number;
  /** Sent emails per week */
  sentPerWeek: number;
  /** Attachments per week */
  attachmentsPerWeek: number;
  /** Total estimated hours/week on email */
  estimatedHoursPerWeek: number;
  /** Legacy: Top frequent words from sent subjects */
  sentTopics: string[];
  /** Legacy: Top frequent words from attachment subjects */
  attachmentTopics: string[];
  /** Legacy: Most frequent non-user sender domains */
  topSenderDomains: { domain: string; count: number }[];
  /** Legacy: Most-replied-to thread subjects */
  topThreadSubjects: string[];
  /** Category breakdown (passed through) */
  categoryBreakdown: CategoryBreakdownItem[];
}

// ---------------------------------------------------------------------------
// Tool domain mapping
// ---------------------------------------------------------------------------

const TOOL_DOMAINS: Record<string, string> = {
  // Dev & engineering
  "github.com": "GitHub",
  "gitlab.com": "GitLab",
  "bitbucket.org": "Bitbucket",
  "circleci.com": "CircleCI",
  "travis-ci.com": "Travis CI",
  "vercel.com": "Vercel",
  "netlify.com": "Netlify",
  "sentry.io": "Sentry",
  "datadog.com": "Datadog",
  "pagerduty.com": "PagerDuty",
  "opsgenie.com": "OpsGenie",
  // Project management
  "atlassian.net": "Jira/Confluence",
  "atlassian.com": "Jira/Confluence",
  "linear.app": "Linear",
  "asana.com": "Asana",
  "trello.com": "Trello",
  "monday.com": "Monday.com",
  "clickup.com": "ClickUp",
  "basecamp.com": "Basecamp",
  "notion.so": "Notion",
  "airtable.com": "Airtable",
  // Communication
  "slack.com": "Slack",
  "zoom.us": "Zoom",
  "calendly.com": "Calendly",
  "loom.com": "Loom",
  "teams.microsoft.com": "Microsoft Teams",
  // CRM & sales
  "salesforce.com": "Salesforce",
  "hubspot.com": "HubSpot",
  "pipedrive.com": "Pipedrive",
  "close.com": "Close CRM",
  // Support
  "zendesk.com": "Zendesk",
  "intercom.com": "Intercom",
  "freshdesk.com": "Freshdesk",
  // Design
  "figma.com": "Figma",
  "canva.com": "Canva",
  "invisionapp.com": "InVision",
  // Finance & legal
  "docusign.com": "DocuSign",
  "stripe.com": "Stripe",
  "quickbooks.intuit.com": "QuickBooks",
  "xero.com": "Xero",
  "bill.com": "Bill.com",
  // Marketing
  "mailchimp.com": "Mailchimp",
  "sendgrid.net": "SendGrid",
  "convertkit.com": "ConvertKit",
  "constantcontact.com": "Constant Contact",
  // Storage & docs
  "dropbox.com": "Dropbox",
  "box.com": "Box",
  "sharepoint.com": "SharePoint",
};

// Automated/infrastructure domains to exclude from tool analysis
const AUTOMATED_SENDER_DOMAINS = new Set([
  "google.com",
  "calendar.google.com",
  "googlemail.com",
  "outlook.com",
  "office365.com",
  "microsoft.com",
  "substack.com",
  "beehiiv.com",
  "noreply.github.com",
]);

// Stop words for legacy topic extraction
const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "from",
  "with",
  "your",
  "this",
  "that",
  "about",
  "are",
  "was",
  "were",
  "been",
  "have",
  "has",
  "had",
  "not",
  "but",
  "all",
  "can",
  "her",
  "his",
  "its",
  "our",
  "they",
  "you",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "shall",
  "just",
  "also",
  "than",
  "then",
  "when",
  "what",
  "which",
  "who",
  "how",
  "where",
  "why",
  "each",
  "every",
  "both",
  "few",
  "more",
  "most",
  "other",
  "some",
  "any",
  "only",
  "very",
  "too",
  "here",
  "there",
  "now",
  "out",
  "into",
  "over",
  "after",
  "before",
  "between",
  "under",
  "again",
  "once",
  "same",
  "still",
  "new",
  "one",
  "two",
  "get",
  "got",
  "let",
  "per",
  "via",
  "yet",
  "re:",
  "fwd:",
  "fw:",
  "re",
  "fwd",
  "fw",
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Strip RE:/FW:/Fwd: prefixes from a subject */
function stripReplyPrefix(subject: string): string {
  return subject.replace(/^(re:|fwd?:|fw:)\s*/gi, "").trim();
}

/**
 * Extract unique sent subjects, deduplicated by threadId.
 * For each thread, takes the earliest email's subject (the original topic).
 */
function extractUniqueSubjects(emails: ClassifiedEmail[], topN: number): string[] {
  // Group by threadId, keeping earliest email per thread
  const threadMap = new Map<string, { subject: string; date: Date; count: number }>();

  for (const email of emails) {
    const existing = threadMap.get(email.threadId);
    if (!existing) {
      threadMap.set(email.threadId, {
        subject: stripReplyPrefix(email.subject),
        date: email.date,
        count: 1,
      });
    } else {
      existing.count++;
      // Keep earliest subject (original topic)
      if (email.date < existing.date) {
        existing.subject = stripReplyPrefix(email.subject);
        existing.date = email.date;
      }
    }
  }

  // Deduplicate by normalized subject
  const seen = new Set<string>();
  const unique: { subject: string; count: number }[] = [];

  // Sort by thread size (most active first)
  const sorted = Array.from(threadMap.values()).sort((a, b) => b.count - a.count);

  for (const entry of sorted) {
    const normalized = entry.subject.toLowerCase().trim();
    if (normalized.length < 3) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    unique.push({ subject: entry.subject, count: entry.count });
  }

  return unique.slice(0, topN).map((e) => e.subject);
}

/**
 * Extract threads where user actively participates (sent replies).
 * Only threads where user both sends and receives — indicating active collaboration.
 */
function extractActiveThreads(
  classified: ClassifiedEmail[]
): { subject: string; userReplies: number }[] {
  const threadMap = new Map<
    string,
    {
      subject: string;
      userReplies: number;
      hasReceived: boolean;
      earliestDate: Date;
    }
  >();

  for (const email of classified) {
    const existing = threadMap.get(email.threadId);
    if (!existing) {
      threadMap.set(email.threadId, {
        subject: stripReplyPrefix(email.subject),
        userReplies: email.isSent && email.inReplyTo ? 1 : 0,
        hasReceived: !email.isSent,
        earliestDate: email.date,
      });
    } else {
      if (email.isSent && email.inReplyTo) {
        existing.userReplies++;
      }
      if (!email.isSent) {
        existing.hasReceived = true;
      }
      if (email.date < existing.earliestDate) {
        existing.subject = stripReplyPrefix(email.subject);
        existing.earliestDate = email.date;
      }
    }
  }

  return Array.from(threadMap.values())
    .filter((t) => t.userReplies >= 1 && t.hasReceived)
    .sort((a, b) => b.userReplies - a.userReplies)
    .slice(0, 15)
    .map((t) => ({ subject: t.subject, userReplies: t.userReplies }));
}

/**
 * Extract tool/service domains from sender addresses.
 * Maps known SaaS domains to human-readable tool names.
 */
function extractToolDomains(
  classified: ClassifiedEmail[],
  userDomain: string
): { domain: string; tool: string; count: number }[] {
  const domainCounts = new Map<string, number>();

  for (const email of classified) {
    const match = email.from.match(/@([^>\s]+)/);
    if (!match) continue;
    const domain = match[1].toLowerCase();
    if (domain === userDomain) continue;
    if (AUTOMATED_SENDER_DOMAINS.has(domain)) continue;
    domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1);
  }

  return Array.from(domainCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([domain, count]) => ({
      domain,
      tool: TOOL_DOMAINS[domain] || domain,
      count,
    }));
}

/**
 * Legacy: Tokenize subject lines and count word frequencies.
 */
function extractTopics(subjects: string[], topN: number): string[] {
  const wordCounts = new Map<string, number>();

  for (const subject of subjects) {
    const cleaned = subject.replace(/^(re:|fwd?:|fw:)\s*/gi, "").toLowerCase();
    const words = cleaned.split(/[\s/\-_,;:!?()[\]{}"']+/);

    for (const word of words) {
      if (word.length < 3) continue;
      if (STOP_WORDS.has(word)) continue;
      if (/^\d+$/.test(word)) continue;
      if (!/[a-z]/.test(word)) continue;
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    }
  }

  return Array.from(wordCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([word]) => word);
}

// ---------------------------------------------------------------------------
// Main extraction function
// ---------------------------------------------------------------------------

/**
 * Extract structured work context from classified emails.
 *
 * @param classified - Array of classified emails (in memory)
 * @param userDomain - User's email domain to exclude from sender analysis
 * @param categoryBreakdown - Pre-computed category breakdown
 * @param estimatedHoursPerWeek - Pre-computed total hours/week
 * @param scanPeriodDays - Number of days in the scan period (for per-week rates)
 * @returns WorkContext for use in skill recommendations
 */
export function extractWorkContext(
  classified: ClassifiedEmail[],
  userDomain: string,
  categoryBreakdown: CategoryBreakdownItem[],
  estimatedHoursPerWeek: number,
  scanPeriodDays: number
): WorkContext {
  const sentEmails = classified.filter((e) => e.isSent);
  const attachmentEmails = sentEmails.filter((e) => e.hasAttachment);
  const weeksInPeriod = Math.max(scanPeriodDays / 7, 1);

  // New: Unique sent subjects (deduplicated by thread)
  const uniqueSentSubjects = extractUniqueSubjects(sentEmails, 50);

  // New: Unique attachment subjects
  const uniqueAttachmentSubjects = extractUniqueSubjects(attachmentEmails, 20);

  // New: Active threads (user both sends and receives)
  const activeThreads = extractActiveThreads(classified);

  // New: Tool domain mapping
  const toolDomains = extractToolDomains(classified, userDomain);

  // Legacy: word frequency topics
  const sentSubjects = sentEmails.map((e) => e.subject);
  const sentTopics = extractTopics(sentSubjects, 20);
  const attachmentSubjects = attachmentEmails.map((e) => e.subject);
  const attachmentTopics = extractTopics(attachmentSubjects, 10);

  // Legacy: top sender domains (without tool mapping)
  const topSenderDomains = toolDomains.map((t) => ({
    domain: t.domain,
    count: t.count,
  }));

  // Legacy: top thread subjects
  const threadCounts = new Map<string, { count: number; subject: string }>();
  for (const email of classified) {
    const existing = threadCounts.get(email.threadId);
    if (existing) {
      existing.count++;
    } else {
      threadCounts.set(email.threadId, { count: 1, subject: email.subject });
    }
  }
  const topThreadSubjects = Array.from(threadCounts.values())
    .filter((t) => t.count >= 3)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map((t) => t.subject.slice(0, 80));

  return {
    uniqueSentSubjects,
    uniqueAttachmentSubjects,
    activeThreads,
    toolDomains,
    sentCount: sentEmails.length,
    sentWithAttachmentCount: attachmentEmails.length,
    sentPerWeek: Math.round((sentEmails.length / weeksInPeriod) * 10) / 10,
    attachmentsPerWeek: Math.round((attachmentEmails.length / weeksInPeriod) * 10) / 10,
    estimatedHoursPerWeek,
    sentTopics,
    attachmentTopics,
    topSenderDomains,
    topThreadSubjects,
    categoryBreakdown,
  };
}

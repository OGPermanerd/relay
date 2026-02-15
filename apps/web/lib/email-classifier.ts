import type { EmailMetadata } from "./gmail-client";

/**
 * Email classification library
 *
 * Pure rule-based classification covering all 7 categories.
 * No AI calls — eliminates rate-limit risk and runs in <50ms.
 */

// ---------------------------------------------------------------------------
// Classification types
// ---------------------------------------------------------------------------

export type EmailCategory =
  | "newsletter"
  | "automated-notification"
  | "meeting-invite"
  | "direct-message"
  | "internal-thread"
  | "vendor-external"
  | "support-ticket";

export interface ClassifiedEmail extends EmailMetadata {
  category: EmailCategory;
  classificationMethod: "rule";
}

// Re-export EmailMetadata so consumers that imported from here still work
export type { EmailMetadata } from "./gmail-client";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract domain from "Name <email@domain.com>" or "email@domain.com" */
function extractDomain(from: string): string {
  const match = from.match(/@([^>\s]+)/);
  return match ? match[1].toLowerCase() : "";
}

/** Extract local part (before @) from From header */
function extractLocalPart(from: string): string {
  const match = from.match(/<?\s*([^@<]+)@/);
  return match ? match[1].toLowerCase().trim() : "";
}

// ---------------------------------------------------------------------------
// Known domain/prefix sets
// ---------------------------------------------------------------------------

const NEWSLETTER_DOMAINS = new Set([
  "substack.com",
  "mailchimp.com",
  "constantcontact.com",
  "sendgrid.net",
  "hubspot.com",
  "convertkit.com",
  "beehiiv.com",
  "buttondown.email",
  "campaignmonitor.com",
  "mailerlite.com",
  "getrevue.co",
  "sendinblue.com",
  "brevo.com",
]);

const NEWSLETTER_PREFIXES = new Set([
  "newsletter",
  "digest",
  "news",
  "updates",
  "marketing",
  "promotions",
  "info",
  "weekly",
  "daily",
]);

const AUTOMATED_PREFIXES = new Set([
  "noreply",
  "no-reply",
  "donotreply",
  "do-not-reply",
  "mailer-daemon",
  "postmaster",
  "auto-reply",
  "autoreply",
  "bounce",
  "daemon",
  "system",
  "alerts",
  "alert",
  "monitor",
  "monitoring",
  "builds",
  "ci",
  "deploy",
  "jenkins",
  "github-noreply",
  "gitlab",
  "bitbucket",
  "notifications",
]);

const NOTIFICATION_DOMAINS = new Set([
  "github.com",
  "gitlab.com",
  "bitbucket.org",
  "atlassian.net",
  "statuspage.io",
  "pagerduty.com",
  "datadog.com",
  "sentry.io",
  "opsgenie.com",
  "newrelic.com",
  "circleci.com",
  "travis-ci.com",
  "vercel.com",
  "netlify.com",
  "linear.app",
  "asana.com",
  "monday.com",
  "trello.com",
  "notion.so",
  "slack.com",
  "figma.com",
  "loom.com",
]);

const SCHEDULING_DOMAINS = new Set([
  "calendly.com",
  "zoom.us",
  "cal.com",
  "doodle.com",
  "acuityscheduling.com",
  "meetingbird.com",
  "reclaim.ai",
  "clockwise.com",
]);

const SUPPORT_PREFIXES = new Set([
  "support",
  "help",
  "helpdesk",
  "service",
  "customerservice",
  "customer-service",
  "feedback",
  "tickets",
  "desk",
  "care",
]);

const HELPDESK_DOMAINS = new Set([
  "zendesk.com",
  "freshdesk.com",
  "intercom.io",
  "helpscout.com",
  "helpscout.net",
  "servicenow.com",
  "kayako.com",
  "happyfox.com",
]);

const VENDOR_PREFIXES = new Set([
  "invoices",
  "billing",
  "accounts",
  "procurement",
  "sales",
  "partnerships",
  "legal",
  "accounting",
  "finance",
  "payroll",
  "receivables",
  "payables",
]);

// ---------------------------------------------------------------------------
// Subject pattern helpers
// ---------------------------------------------------------------------------

const NEWSLETTER_SUBJECT_PATTERNS = [
  /\bunsubscribe\b/i,
  /\bweekly digest\b/i,
  /\bmonthly roundup\b/i,
  /\bdaily briefing\b/i,
  /\bweekly update\b/i,
  /\bmonthly newsletter\b/i,
  /\bweekly newsletter\b/i,
  /\bedition\s*#?\d/i,
  /\bissue\s*#?\d/i,
];

const MEETING_SUBJECT_PATTERNS = [
  /\bmeeting request\b/i,
  /\bcalendar invit/i,
  /^accepted:/i,
  /^declined:/i,
  /^tentative:/i,
  /\binvitation:/i,
  /\bhas invited you\b/i,
];

const SUPPORT_SUBJECT_PATTERNS = [
  /\bticket\s*#/i,
  /\bcase\s*#/i,
  /\bincident\s*#/i,
  /\brequest\s*#/i,
  /\b\[ticket\b/i,
  /\b\[case\b/i,
];

const VENDOR_SUBJECT_PATTERNS = [
  /\binvoice\b/i,
  /\bpurchase order\b/i,
  /\bproposal\b/i,
  /\bcontract\b/i,
  /\bstatement\b/i,
  /\bquotation\b/i,
  /\bestimate\b/i,
];

/** Bracketed prefix like [JIRA], [GitHub], [Alert], [Jenkins] */
const BRACKETED_PREFIX = /^\s*\[[A-Za-z][A-Za-z0-9\s-]*\]/;

// ---------------------------------------------------------------------------
// Rule-based classification
// ---------------------------------------------------------------------------

/**
 * Apply deterministic rules to classify an email.
 * Rules are evaluated in priority order — first match wins.
 * Every email gets a category (no null return).
 */
function applyRules(email: EmailMetadata, userDomain: string): EmailCategory {
  const fromLower = email.from.toLowerCase();
  const subjectLower = email.subject.toLowerCase();
  const senderDomain = extractDomain(email.from);
  const senderPrefix = extractLocalPart(email.from);
  const labels = email.labels;

  // -------------------------------------------------------------------
  // 1. NEWSLETTER
  // -------------------------------------------------------------------

  // List-Unsubscribe header is the strongest signal
  if (email.listUnsubscribe) {
    return "newsletter";
  }

  // Gmail's own promotion classification
  if (labels.includes("CATEGORY_PROMOTIONS")) {
    return "newsletter";
  }

  // Known newsletter platforms
  if (NEWSLETTER_DOMAINS.has(senderDomain)) {
    return "newsletter";
  }

  // Newsletter sender prefixes
  if (NEWSLETTER_PREFIXES.has(senderPrefix)) {
    return "newsletter";
  }

  // Newsletter subject patterns
  if (NEWSLETTER_SUBJECT_PATTERNS.some((p) => p.test(email.subject))) {
    return "newsletter";
  }

  // -------------------------------------------------------------------
  // 2. AUTOMATED NOTIFICATION
  // -------------------------------------------------------------------

  // Common automated sender prefixes
  if (AUTOMATED_PREFIXES.has(senderPrefix)) {
    return "automated-notification";
  }

  // Known notification platform domains
  if (NOTIFICATION_DOMAINS.has(senderDomain)) {
    return "automated-notification";
  }

  // Gmail CATEGORY_UPDATES with no reply chain and from outside user's domain
  if (labels.includes("CATEGORY_UPDATES") && !email.inReplyTo && senderDomain !== userDomain) {
    return "automated-notification";
  }

  // Bracketed prefix like [JIRA], [GitHub] with no reply chain
  if (BRACKETED_PREFIX.test(email.subject) && !email.inReplyTo) {
    return "automated-notification";
  }

  // "via" pattern (e.g., "John via LinkedIn")
  if (fromLower.includes(" via ")) {
    return "automated-notification";
  }

  // -------------------------------------------------------------------
  // 3. MEETING INVITE
  // -------------------------------------------------------------------

  // Calendar platforms with invite-related subjects
  if (
    (senderDomain.includes("calendar.google.com") ||
      senderDomain.includes("outlook.com") ||
      senderDomain.includes("office365.com") ||
      senderDomain.includes("microsoft.com")) &&
    (subjectLower.includes("invit") ||
      subjectLower.includes("accepted") ||
      subjectLower.includes("declined"))
  ) {
    return "meeting-invite";
  }

  // Known scheduling platforms
  if (SCHEDULING_DOMAINS.has(senderDomain)) {
    return "meeting-invite";
  }

  // Meeting subject patterns
  if (MEETING_SUBJECT_PATTERNS.some((p) => p.test(email.subject))) {
    return "meeting-invite";
  }

  // Gmail CATEGORY_FORUMS with scheduling keywords
  if (
    labels.includes("CATEGORY_FORUMS") &&
    (subjectLower.includes("rsvp") || subjectLower.includes("attend"))
  ) {
    return "meeting-invite";
  }

  // -------------------------------------------------------------------
  // 4. SUPPORT TICKET
  // -------------------------------------------------------------------

  // Support sender prefixes
  if (SUPPORT_PREFIXES.has(senderPrefix)) {
    return "support-ticket";
  }

  // Known helpdesk domains
  if (HELPDESK_DOMAINS.has(senderDomain)) {
    return "support-ticket";
  }

  // Support subject patterns
  if (SUPPORT_SUBJECT_PATTERNS.some((p) => p.test(email.subject))) {
    return "support-ticket";
  }

  // -------------------------------------------------------------------
  // 5. INTERNAL THREAD (same domain + reply)
  // -------------------------------------------------------------------

  if (senderDomain === userDomain && email.inReplyTo) {
    return "internal-thread";
  }

  // -------------------------------------------------------------------
  // 6. VENDOR/EXTERNAL (different domain + reply, or vendor prefixes/subjects)
  // -------------------------------------------------------------------

  if (senderDomain !== userDomain && email.inReplyTo) {
    return "vendor-external";
  }

  if (VENDOR_PREFIXES.has(senderPrefix)) {
    return "vendor-external";
  }

  if (VENDOR_SUBJECT_PATTERNS.some((p) => p.test(email.subject))) {
    return "vendor-external";
  }

  // -------------------------------------------------------------------
  // 7. DIRECT MESSAGE (catch-all)
  // -------------------------------------------------------------------

  return "direct-message";
}

// ---------------------------------------------------------------------------
// Main classification function
// ---------------------------------------------------------------------------

/**
 * Classify emails using comprehensive rule-based matching.
 * Pure synchronous — no API calls, no batching, no rate limits.
 *
 * @param emails - Array of email metadata from Gmail
 * @param userDomain - User's email domain (e.g., "acme.com")
 * @returns Array of classified emails
 */
export function classifyEmails(emails: EmailMetadata[], userDomain: string): ClassifiedEmail[] {
  return emails.map((email) => ({
    ...email,
    category: applyRules(email, userDomain),
    classificationMethod: "rule" as const,
  }));
}

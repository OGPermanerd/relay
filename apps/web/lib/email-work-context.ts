import type { ClassifiedEmail } from "./email-classifier";
import type { CategoryBreakdownItem } from "./diagnostic-aggregator";

/**
 * Email work context extraction
 *
 * Extracts structured work context from classified email metadata.
 * Runs purely on in-memory data — no API calls.
 * Output feeds into the skill recommendation engine for targeted queries.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WorkContext {
  /** Top frequent meaningful words from sent email subjects */
  sentTopics: string[];
  /** Top frequent words from sent-with-attachment subjects */
  attachmentTopics: string[];
  /** Most frequent non-user sender domains */
  topSenderDomains: { domain: string; count: number }[];
  /** Most-replied-to thread subjects (truncated to 80 chars) */
  topThreadSubjects: string[];
  /** Total sent messages in scan period */
  sentCount: number;
  /** Sent messages with attachments */
  sentWithAttachmentCount: number;
  /** Category breakdown (passed through) */
  categoryBreakdown: CategoryBreakdownItem[];
  /** Total estimated hours/week on email */
  estimatedHoursPerWeek: number;
}

// ---------------------------------------------------------------------------
// Stop words to filter from topic extraction
// ---------------------------------------------------------------------------

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
  // Email-specific stop words
  "re:",
  "fwd:",
  "fw:",
  "re",
  "fwd",
  "fw",
]);

// Automated domains to exclude from sender domain analysis
const AUTOMATED_SENDER_DOMAINS = new Set([
  "google.com",
  "calendar.google.com",
  "googlemail.com",
  "outlook.com",
  "office365.com",
  "microsoft.com",
  "substack.com",
  "mailchimp.com",
  "sendgrid.net",
  "hubspot.com",
  "convertkit.com",
  "beehiiv.com",
]);

// ---------------------------------------------------------------------------
// Topic extraction helpers
// ---------------------------------------------------------------------------

/**
 * Tokenize subject lines and count word frequencies.
 * Filters stop words, short words, and non-alpha tokens.
 */
function extractTopics(subjects: string[], topN: number): string[] {
  const wordCounts = new Map<string, number>();

  for (const subject of subjects) {
    // Remove RE:/FWD: prefixes, then tokenize
    const cleaned = subject.replace(/^(re:|fwd?:|fw:)\s*/gi, "").toLowerCase();
    const words = cleaned.split(/[\s/\-_,;:!?()[\]{}"']+/);

    for (const word of words) {
      // Skip short words, stop words, pure numbers, and non-alpha
      if (word.length < 3) continue;
      if (STOP_WORDS.has(word)) continue;
      if (/^\d+$/.test(word)) continue;
      if (!/[a-z]/.test(word)) continue;

      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    }
  }

  // Sort by frequency descending, return top N
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
 * @returns WorkContext for use in skill recommendations
 */
export function extractWorkContext(
  classified: ClassifiedEmail[],
  userDomain: string,
  categoryBreakdown: CategoryBreakdownItem[],
  estimatedHoursPerWeek: number
): WorkContext {
  // 1. Sent email subjects → topics
  const sentEmails = classified.filter((e) => e.isSent);
  const sentSubjects = sentEmails.map((e) => e.subject);
  const sentTopics = extractTopics(sentSubjects, 20);

  // 2. Sent-with-attachment subjects → attachment topics
  const attachmentEmails = sentEmails.filter((e) => e.hasAttachment);
  const attachmentSubjects = attachmentEmails.map((e) => e.subject);
  const attachmentTopics = extractTopics(attachmentSubjects, 10);

  // 3. Top sender domains (excluding user's domain and known automated)
  const domainCounts = new Map<string, number>();
  for (const email of classified) {
    const match = email.from.match(/@([^>\s]+)/);
    if (!match) continue;
    const domain = match[1].toLowerCase();
    if (domain === userDomain) continue;
    if (AUTOMATED_SENDER_DOMAINS.has(domain)) continue;
    domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1);
  }
  const topSenderDomains = Array.from(domainCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([domain, count]) => ({ domain, count }));

  // 4. Top thread subjects (threads with 3+ messages)
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
    sentTopics,
    attachmentTopics,
    topSenderDomains,
    topThreadSubjects,
    sentCount: sentEmails.length,
    sentWithAttachmentCount: attachmentEmails.length,
    categoryBreakdown,
    estimatedHoursPerWeek,
  };
}

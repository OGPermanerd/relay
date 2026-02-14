import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

/**
 * Email classification library
 *
 * Two-pass strategy:
 * 1. Rule-based classification (fast, free, handles ~70%)
 * 2. AI classification for ambiguous cases (batched, cost-efficient)
 */

// ---------------------------------------------------------------------------
// EmailMetadata type (compatible with gmail-client.ts)
// ---------------------------------------------------------------------------

/**
 * Email metadata structure.
 * TODO: Replace with import from "./gmail-client" once available.
 */
export interface EmailMetadata {
  id: string;
  date: Date;
  from: string;
  subject: string;
  listUnsubscribe: string | null;
  inReplyTo: string | null;
}

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
  classificationMethod: "rule" | "ai";
}

// ---------------------------------------------------------------------------
// Rule-based classification (PASS 1)
// ---------------------------------------------------------------------------

/**
 * Apply deterministic rules to classify obvious email patterns.
 * Returns category if matched, null if ambiguous (needs AI).
 */
function applyRules(email: EmailMetadata): EmailCategory | null {
  const fromLower = email.from.toLowerCase();
  const subjectLower = email.subject.toLowerCase();

  // Rule 1: List-Unsubscribe header = newsletter
  if (email.listUnsubscribe) {
    return "newsletter";
  }

  // Rule 2: Common automated sender patterns
  if (
    fromLower.includes("noreply@") ||
    fromLower.includes("no-reply@") ||
    fromLower.includes("notifications@") ||
    fromLower.includes("donotreply@")
  ) {
    return "automated-notification";
  }

  // Rule 3: Calendar invites
  if (
    (fromLower.includes("calendar.google.com") || fromLower.includes("outlook.com")) &&
    subjectLower.includes("invite")
  ) {
    return "meeting-invite";
  }

  // No rule matched — ambiguous, needs AI
  return null;
}

// ---------------------------------------------------------------------------
// AI classification (PASS 2)
// ---------------------------------------------------------------------------

// Zod schema for AI output validation
const ClassificationOutputSchema = z.object({
  classifications: z.array(
    z.object({
      id: z.string(),
      category: z.enum([
        "newsletter",
        "automated-notification",
        "meeting-invite",
        "direct-message",
        "internal-thread",
        "vendor-external",
        "support-ticket",
      ]),
    })
  ),
});

// JSON schema for Anthropic output_config
const CLASSIFICATION_SCHEMA = {
  type: "object" as const,
  properties: {
    classifications: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          id: { type: "string" as const },
          category: {
            type: "string" as const,
            enum: [
              "newsletter",
              "automated-notification",
              "meeting-invite",
              "direct-message",
              "internal-thread",
              "vendor-external",
              "support-ticket",
            ],
          },
        },
        required: ["id", "category"],
      },
    },
  },
  required: ["classifications"],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `You are an email categorization system. Given email metadata (sender domain, subject preview, reply status), classify each into one of these categories:

- newsletter: Marketing emails, promotional content, bulk newsletters
- automated-notification: System notifications, alerts, CI/CD reports, monitoring
- meeting-invite: Calendar invites, meeting requests, scheduling
- direct-message: Personal 1:1 communication requiring response
- internal-thread: Multi-person discussion threads within same organization
- vendor-external: Communication with external vendors, clients, partners
- support-ticket: Customer support, helpdesk, issue tracking

Return a JSON array with id and category for each email.`;

/**
 * Classify a batch of ambiguous emails using Claude Haiku.
 * Returns a Map of email ID -> category.
 */
async function classifyBatchWithAI(emails: EmailMetadata[]): Promise<Map<string, EmailCategory>> {
  // Prepare minimal metadata for Claude (privacy: domain only, truncated subject)
  const emailSummaries = emails.map((e) => ({
    id: e.id,
    senderDomain: e.from.split("@")[1] ?? "unknown",
    subjectPreview: e.subject.slice(0, 100),
    hasListUnsubscribe: !!e.listUnsubscribe,
    isReply: !!e.inReplyTo,
  }));

  // Create Anthropic client
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY environment variable is not set. " +
        "Get an API key from https://console.anthropic.com/settings/keys " +
        "and add it to .env.local."
    );
  }
  const client = new Anthropic({ apiKey });

  // Call Claude Haiku with structured output
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251022",
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Classify these emails:\n\n${JSON.stringify(emailSummaries, null, 2)}`,
      },
    ],
    output_config: {
      format: { type: "json_schema", schema: CLASSIFICATION_SCHEMA },
    },
  });

  // Parse response
  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text content in classification response");
  }

  const parsed = ClassificationOutputSchema.parse(JSON.parse(textBlock.text));

  // Return as Map for fast lookup
  return new Map(parsed.classifications.map((c) => [c.id, c.category]));
}

// ---------------------------------------------------------------------------
// Main classification function
// ---------------------------------------------------------------------------

/**
 * Classify emails using two-pass strategy:
 * 1. Rule-based (fast, free, handles ~70%)
 * 2. AI-based for ambiguous cases (batched, cost-efficient)
 */
export async function classifyEmails(emails: EmailMetadata[]): Promise<ClassifiedEmail[]> {
  const classified: ClassifiedEmail[] = [];
  const ambiguous: EmailMetadata[] = [];

  // PASS 1: Apply rules
  for (const email of emails) {
    const category = applyRules(email);
    if (category) {
      classified.push({
        ...email,
        category,
        classificationMethod: "rule",
      });
    } else {
      ambiguous.push(email);
    }
  }

  // PASS 2: AI classification (if any ambiguous emails)
  if (ambiguous.length > 0) {
    // Process in batches of 75
    const BATCH_SIZE = 75;
    for (let i = 0; i < ambiguous.length; i += BATCH_SIZE) {
      const batch = ambiguous.slice(i, i + BATCH_SIZE);
      const categoryMap = await classifyBatchWithAI(batch);

      // Map results back to classified array
      for (const email of batch) {
        const category = categoryMap.get(email.id) ?? "direct-message"; // fallback
        classified.push({
          ...email,
          category,
          classificationMethod: "ai",
        });
      }
    }
  }

  return classified;
}

import { google } from "@googleapis/gmail";
import { getValidGmailToken } from "@everyskill/db/services/gmail-tokens";

/**
 * Gmail API Client for metadata fetching
 *
 * Privacy-first design: fetches ONLY message headers using format: 'metadata'.
 * Never accesses email bodies. All processing happens in memory.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EmailMetadata {
  id: string;
  threadId: string;
  date: Date;
  from: string;
  subject: string;
  listUnsubscribe: string | null;
  inReplyTo: string | null;
  labels: string[];
}

export interface FetchEmailMetadataOptions {
  daysBack: number;
  maxMessages: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Batch size for concurrent message.get calls (Gmail quota: 250 units/user/sec, 5 units per get) */
const BATCH_SIZE = 100;

/** Maximum results per messages.list call (Gmail API limit: 500) */
const LIST_PAGE_SIZE = 500;

// ---------------------------------------------------------------------------
// Gmail API Client
// ---------------------------------------------------------------------------

/**
 * Fetch email metadata for a user within a date range.
 * Uses format: 'metadata' with specific headers only — never accesses message bodies.
 *
 * @param userId - User ID to fetch emails for
 * @param options - Date range and message limit
 * @returns Array of email metadata objects
 *
 * @throws GmailNotConnectedError if user has no Gmail connection
 * @throws GmailTokenRevokedError if refresh token is invalid
 * @throws Error on Gmail API errors (401, 403, 429, etc.)
 */
export async function fetchEmailMetadata(
  userId: string,
  options: FetchEmailMetadataOptions
): Promise<EmailMetadata[]> {
  // 1. Get valid token with auto-refresh
  const token = await getValidGmailToken(userId);

  // 2. Create OAuth2 client
  const auth = new google.auth.OAuth2();
  auth.setCredentials({
    access_token: token.accessToken,
    refresh_token: token.refreshToken,
    expiry_date: token.expiresAt.getTime(),
  });

  // 3. Create Gmail client
  const gmail = google.gmail({ version: "v1", auth });

  // 4. Calculate date filter
  const afterDate = new Date();
  afterDate.setDate(afterDate.getDate() - options.daysBack);
  const afterDateStr = afterDate.toISOString().split("T")[0].replace(/-/g, "/");

  // 5. List message IDs with pagination
  const messageIds: string[] = [];
  let pageToken: string | undefined = undefined;

  try {
    while (messageIds.length < options.maxMessages) {
      const listResponse = await gmail.users.messages.list({
        userId: "me",
        maxResults: LIST_PAGE_SIZE,
        pageToken,
        q: `after:${afterDateStr}`,
      });

      const messages = listResponse.data.messages || [];
      const idsToAdd = messages.map((m) => m.id!).slice(0, options.maxMessages - messageIds.length);

      messageIds.push(...idsToAdd);

      // Stop if no more pages or reached limit
      if (!listResponse.data.nextPageToken || messageIds.length >= options.maxMessages) {
        break;
      }

      pageToken = listResponse.data.nextPageToken;
    }

    // 6. Batch fetch metadata (100 messages per batch)
    const metadata: EmailMetadata[] = [];

    for (let i = 0; i < messageIds.length; i += BATCH_SIZE) {
      const chunk = messageIds.slice(i, i + BATCH_SIZE);

      const chunkResults = await Promise.all(
        chunk.map((id) =>
          gmail.users.messages
            .get({
              userId: "me",
              id,
              format: "metadata",
              metadataHeaders: ["From", "Subject", "Date", "List-Unsubscribe", "In-Reply-To"],
            })
            .then((res) => res.data)
            .catch(() => {
              // Individual message fetch errors are silently skipped to continue batch
              return null;
            })
        )
      );

      // Parse metadata from each message
      for (const message of chunkResults) {
        if (!message || !message.id) continue;

        const headers = message.payload?.headers || [];
        const getHeader = (name: string): string | null => {
          const header = headers.find((h) => h.name?.toLowerCase() === name.toLowerCase());
          return header?.value || null;
        };

        const dateStr = getHeader("Date");
        const date = dateStr ? new Date(dateStr) : new Date();

        metadata.push({
          id: message.id,
          threadId: message.threadId || message.id,
          date,
          from: getHeader("From") || "",
          subject: getHeader("Subject") || "(no subject)",
          listUnsubscribe: getHeader("List-Unsubscribe"),
          inReplyTo: getHeader("In-Reply-To"),
          labels: message.labelIds || [],
        });
      }
    }

    return metadata;
  } catch (error: unknown) {
    // Handle Gmail API errors
    const err = error as { code?: number; message?: string };
    const statusCode = err.code;
    const message = err.message || String(error);

    if (statusCode === 401) {
      throw new Error("Gmail authentication failed — token may be invalid");
    } else if (statusCode === 403) {
      throw new Error("Gmail API access denied — check OAuth scopes");
    } else if (statusCode === 429) {
      throw new Error("Gmail API rate limit exceeded — please try again later");
    }

    throw new Error(`Gmail API error: ${message}`);
  }
}

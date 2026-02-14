import {
  pgTable,
  text,
  integer,
  timestamp,
  index,
  uniqueIndex,
  pgPolicy,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users";
import { tenants } from "./tenants";

/**
 * Gmail OAuth tokens — one row per user.
 * Access and refresh tokens are AES-256-GCM encrypted at rest.
 * `refreshing_at` acts as a mutex to prevent concurrent token refresh races.
 */
export const gmailTokens = pgTable(
  "gmail_tokens",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" })
      .unique(),
    encryptedAccessToken: text("encrypted_access_token").notNull(),
    encryptedRefreshToken: text("encrypted_refresh_token").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    scope: text("scope").notNull(),
    keyVersion: integer("key_version").notNull().default(1),
    refreshingAt: timestamp("refreshing_at", { withTimezone: true }),
    connectedAt: timestamp("connected_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("gmail_tokens_user_id_idx").on(table.userId),
    index("gmail_tokens_tenant_id_idx").on(table.tenantId),
    pgPolicy("tenant_isolation", {
      as: "restrictive",
      for: "all",
      using: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
    }),
  ]
);

export type GmailToken = typeof gmailTokens.$inferSelect;
export type NewGmailToken = typeof gmailTokens.$inferInsert;

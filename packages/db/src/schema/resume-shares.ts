import { pgTable, text, timestamp, boolean, index, pgPolicy } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users";
import { tenants } from "./tenants";

/**
 * Resume shares table for managing shareable resume tokens.
 * Each share generates a unique token that can be used to view a user's
 * skills resume at /r/[token] without authentication.
 */
export const resumeShares = pgTable(
  "resume_shares",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    includeCompanySkills: boolean("include_company_skills").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    expiresAt: timestamp("expires_at"),
    revokedAt: timestamp("revoked_at"),
  },
  (table) => [
    index("idx_resume_shares_token").on(table.token),
    index("idx_resume_shares_user_id").on(table.userId),
    pgPolicy("tenant_isolation", {
      as: "restrictive",
      for: "all",
      using: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
    }),
  ]
);

export type ResumeShare = typeof resumeShares.$inferSelect;
export type NewResumeShare = typeof resumeShares.$inferInsert;

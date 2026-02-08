import { pgTable, text, timestamp, index, pgPolicy } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { tenants } from "./tenants";
import { users } from "./users";
import { skills } from "./skills";

/**
 * Skill messages table - author-to-author messaging for skill grouping proposals
 *
 * Enables the "message author" feature where users can propose grouping
 * their skills under a parent skill owned by another author.
 *
 * Status flow: pending -> accepted | declined
 */
export const skillMessages = pgTable(
  "skill_messages",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    fromUserId: text("from_user_id")
      .notNull()
      .references(() => users.id),
    toUserId: text("to_user_id")
      .notNull()
      .references(() => users.id),
    subjectSkillId: text("subject_skill_id")
      .notNull()
      .references(() => skills.id, { onDelete: "cascade" }),
    proposedParentSkillId: text("proposed_parent_skill_id").references(() => skills.id, {
      onDelete: "set null",
    }),
    message: text("message").notNull(),
    status: text("status").notNull().default("pending"), // pending | accepted | declined
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (table) => [
    index("skill_messages_to_user_idx").on(table.toUserId),
    index("skill_messages_tenant_id_idx").on(table.tenantId),
    index("skill_messages_from_user_idx").on(table.fromUserId),
    pgPolicy("tenant_isolation", {
      as: "restrictive",
      for: "all",
      using: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
    }),
  ]
);

export type SkillMessage = typeof skillMessages.$inferSelect;
export type NewSkillMessage = typeof skillMessages.$inferInsert;

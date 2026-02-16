import {
  pgTable,
  text,
  timestamp,
  integer,
  real,
  index,
  uniqueIndex,
  pgPolicy,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { tenants } from "./tenants";
import { skills } from "./skills";

/**
 * Skill communities table - stores Louvain community detection results.
 *
 * Each row maps a skill to its detected community within a tenant.
 * community_id is the Louvain-assigned cluster number.
 * modularity is the global quality score of the partition at detection time.
 * detected_at records when the algorithm last ran.
 *
 * One row per (tenant, skill) combination. UPSERT on re-detection
 * updates community_id, modularity, and detected_at.
 */
export const skillCommunities = pgTable(
  "skill_communities",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    skillId: text("skill_id")
      .notNull()
      .references(() => skills.id, { onDelete: "cascade" }),
    communityId: integer("community_id").notNull(),
    modularity: real("modularity").notNull(),
    detectedAt: timestamp("detected_at", { withTimezone: true, precision: 3 })
      .notNull()
      .defaultNow(),
    runId: text("run_id"),
  },
  (table) => [
    uniqueIndex("skill_communities_tenant_skill_unique").on(table.tenantId, table.skillId),
    index("skill_communities_tenant_id_idx").on(table.tenantId),
    index("skill_communities_community_id_idx").on(table.tenantId, table.communityId),
    pgPolicy("tenant_isolation", {
      as: "restrictive",
      for: "all",
      using: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
    }),
  ]
);

export type SkillCommunity = typeof skillCommunities.$inferSelect;
export type NewSkillCommunity = typeof skillCommunities.$inferInsert;

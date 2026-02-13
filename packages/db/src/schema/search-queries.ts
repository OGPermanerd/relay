import { pgTable, text, timestamp, integer, uuid, index, pgPolicy } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users";
import { tenants } from "./tenants";

/**
 * Search queries track every search performed across the platform.
 * Used to identify skill gaps, understand search behavior, and surface trending queries.
 * Supports discover (semantic/hybrid), quick (typeahead), and browse (filter) search types.
 */
export const searchQueries = pgTable(
  "search_queries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    userId: text("user_id").references(() => users.id),
    query: text("query").notNull(),
    normalizedQuery: text("normalized_query").notNull(),
    resultCount: integer("result_count").notNull(),
    searchType: text("search_type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("search_queries_tenant_id_idx").on(table.tenantId),
    index("search_queries_created_at_idx").on(table.createdAt),
    index("search_queries_normalized_query_idx").on(table.normalizedQuery),
    pgPolicy("tenant_isolation", {
      as: "restrictive",
      for: "all",
      using: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
    }),
  ]
);

export type SearchQuery = typeof searchQueries.$inferSelect;
export type NewSearchQuery = typeof searchQueries.$inferInsert;

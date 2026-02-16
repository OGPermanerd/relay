import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  index,
  uniqueIndex,
  customType,
  pgPolicy,
} from "drizzle-orm/pg-core";
import { sql, SQL } from "drizzle-orm";
import { users } from "./users";
import { tenants } from "./tenants";

// Custom tsvector column type for PostgreSQL full-text search
const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

/**
 * Skills table - versioned skill definitions with denormalized aggregates
 *
 * Version references:
 * - publishedVersionId: Currently published version visible to users
 * - draftVersionId: Work-in-progress version for editing
 *
 * Note: Can't add FK to skillVersions.id due to circular reference.
 * Relationship constraints handled in application layer.
 */
export const skills = pgTable(
  "skills",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description").notNull(),
    category: text("category").notNull(), // productivity, wiring, doc-production, data-viz, code
    tags: text("tags").array().default([]),
    status: text("status").notNull().default("published"),
    statusMessage: text("status_message"),
    visibility: text("visibility").notNull().default("tenant"), // "global_approved" | "tenant" | "personal" | "private"
    loomUrl: text("loom_url"), // Optional Loom video demo URL

    // Company approval tracking
    companyApproved: boolean("company_approved").notNull().default(false),
    approvedAt: timestamp("approved_at"),
    approvedBy: text("approved_by").references(() => users.id),

    // Version references (no FK due to circular dependency with skillVersions)
    publishedVersionId: text("published_version_id"), // Currently published version
    draftVersionId: text("draft_version_id"), // Work-in-progress version

    // Denormalized aggregates for performance
    totalUses: integer("total_uses").notNull().default(0), // Sum from usageEvents
    averageRating: integer("average_rating"), // Rating * 100 for precision (e.g., 425 = 4.25 stars)
    totalFeedback: integer("total_feedback").notNull().default(0),
    positiveFeedbackPct: integer("positive_feedback_pct"), // 0-100 percentage
    avgTokenCostMicrocents: integer("avg_token_cost_microcents"),

    // Full-text search vector (automatically generated)
    searchVector: tsvector("search_vector").generatedAlwaysAs(
      (): SQL =>
        sql`setweight(to_tsvector('english', ${skills.name}), 'A') || setweight(to_tsvector('english', ${skills.description}), 'B')`
    ),

    // DEPRECATED: Will be removed after migration to R2 storage
    // MCP tools currently use this field - migrate in a later plan
    content: text("content").notNull(), // The actual skill content (markdown)
    hoursSaved: integer("hours_saved").default(1), // Estimated hours saved per use

    // Fork tracking (self-referential, nullable)
    forkedFromId: text("forked_from_id"),
    forkedAtContentHash: text("forked_at_content_hash"),

    // AI-generated skill summary fields
    inputs: text("inputs").array().default([]),
    outputs: text("outputs").array().default([]),
    activitiesSaved: text("activities_saved").array().default([]),

    authorId: text("author_id").references(() => users.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("skills_search_idx").using("gin", table.searchVector),
    uniqueIndex("skills_tenant_slug_unique").on(table.tenantId, table.slug),
    index("skills_tenant_id_idx").on(table.tenantId),
    pgPolicy("tenant_isolation", {
      as: "restrictive",
      for: "all",
      using: sql`tenant_id = current_setting('app.current_tenant_id', true) OR visibility = 'global_approved'`,
      withCheck: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
    }),
  ]
);

export type Skill = typeof skills.$inferSelect;
export type NewSkill = typeof skills.$inferInsert;

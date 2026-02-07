import { pgTable, text, boolean, integer, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { tenants } from "./tenants";

/**
 * Tenant settings — one row per tenant (id = "default" per tenant).
 * Stores configuration for optional features like semantic similarity.
 */
export const siteSettings = pgTable(
  "site_settings",
  {
    id: text("id").primaryKey().default("default"),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    semanticSimilarityEnabled: boolean("semantic_similarity_enabled").notNull().default(false),
    ollamaUrl: text("ollama_url").notNull().default("http://localhost:11434"),
    ollamaModel: text("ollama_model").notNull().default("nomic-embed-text"),
    embeddingDimensions: integer("embedding_dimensions").notNull().default(768),
    lastSuccessfulConnection: timestamp("last_successful_connection"),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("site_settings_tenant_id_unique").on(table.tenantId),
    index("site_settings_tenant_id_idx").on(table.tenantId),
  ]
);

export type SiteSettings = typeof siteSettings.$inferSelect;
export type NewSiteSettings = typeof siteSettings.$inferInsert;

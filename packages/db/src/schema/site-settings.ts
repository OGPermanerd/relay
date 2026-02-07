import { pgTable, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";

/**
 * Site-wide settings — singleton row (id = "default").
 * Stores configuration for optional features like semantic similarity.
 */
export const siteSettings = pgTable("site_settings", {
  id: text("id").primaryKey().default("default"),
  semanticSimilarityEnabled: boolean("semantic_similarity_enabled").notNull().default(false),
  ollamaUrl: text("ollama_url").notNull().default("http://localhost:11434"),
  ollamaModel: text("ollama_model").notNull().default("nomic-embed-text"),
  embeddingDimensions: integer("embedding_dimensions").notNull().default(768),
  lastSuccessfulConnection: timestamp("last_successful_connection"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type SiteSettings = typeof siteSettings.$inferSelect;
export type NewSiteSettings = typeof siteSettings.$inferInsert;

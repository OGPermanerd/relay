import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";
import { vector } from "drizzle-orm/pg-core";
import { skills } from "./skills";

/**
 * Skill embeddings table - vector representations for semantic similarity search
 *
 * Each skill has one embedding generated from its content.
 * Embeddings are created using Voyage AI's voyage-code-3 model (1024 dimensions).
 *
 * Model versioning fields (modelName, modelVersion, inputHash) support:
 * - Re-embedding when model changes
 * - Detecting content changes via hash comparison
 * - Future migration to different embedding providers
 */
export const skillEmbeddings = pgTable(
  "skill_embeddings",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    skillId: text("skill_id")
      .notNull()
      .unique()
      .references(() => skills.id, { onDelete: "cascade" }),
    embedding: vector("embedding", { dimensions: 1024 }).notNull(),
    modelName: text("model_name").notNull(), // e.g., "voyage-code-3"
    modelVersion: text("model_version").notNull(), // e.g., "1.0"
    inputHash: text("input_hash").notNull(), // SHA-256 hash of embedded content
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (table) => [
    // HNSW index for efficient approximate nearest neighbor search
    // Uses cosine similarity (vector_cosine_ops) for normalized embeddings
    index("skill_embeddings_embedding_idx").using("hnsw", table.embedding.op("vector_cosine_ops")),
  ]
);

export type SkillEmbedding = typeof skillEmbeddings.$inferSelect;
export type NewSkillEmbedding = typeof skillEmbeddings.$inferInsert;

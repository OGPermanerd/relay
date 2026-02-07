import { pgTable, text, integer, timestamp, index, uniqueIndex, customType } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { skills } from "./skills";
import { tenants } from "./tenants";

// Custom vector column type for pgvector
const vector = (name: string, dimensions: number) =>
  customType<{ data: number[]; driverParam: string }>({
    dataType() {
      return `vector(${dimensions})`;
    },
    toDriver(value: number[]): string {
      return `[${value.join(",")}]`;
    },
    fromDriver(value: unknown): number[] {
      // pgvector returns "[1,2,3]" format
      const str = String(value);
      return str.slice(1, -1).split(",").map(Number);
    },
  })(name);

/**
 * Skill embeddings table — stores vector embeddings for semantic similarity.
 * One embedding per skill, cascade-deleted when the skill is removed.
 */
export const skillEmbeddings = pgTable(
  "skill_embeddings",
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
    embedding: vector("embedding", 768).notNull(),
    modelName: text("model_name").notNull(),
    dimensions: integer("dimensions").notNull(),
    inputHash: text("input_hash").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("skill_embeddings_tenant_skill_unique").on(table.tenantId, table.skillId),
    index("skill_embeddings_tenant_id_idx").on(table.tenantId),
    index("skill_embeddings_skill_id_idx").on(table.skillId),
    // HNSW index for fast cosine similarity search
    index("skill_embeddings_hnsw_idx").using("hnsw", sql`${table.embedding} vector_cosine_ops`),
  ]
);

export type SkillEmbedding = typeof skillEmbeddings.$inferSelect;
export type NewSkillEmbedding = typeof skillEmbeddings.$inferInsert;

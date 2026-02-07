import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";
import { tenants } from "./tenants";

/**
 * User table schema
 * Uses text id and Auth.js required fields for DrizzleAdapter compatibility
 */
export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  email: text("email").notNull().unique(),
  name: text("name"),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("users_tenant_id_idx").on(table.tenantId),
]);

/**
 * Type inference helpers
 */
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

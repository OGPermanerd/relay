import { pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core";

/**
 * Tenants table - multi-tenancy foundation
 * Each tenant represents an organization with isolated data
 */
export const tenants = pgTable("tenants", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  domain: text("domain"), // e.g., "company.com" for email-based matching
  logo: text("logo"), // URL to tenant logo
  isActive: boolean("is_active").notNull().default(true),
  plan: text("plan").notNull().default("freemium"), // "freemium" | "paid"
  vanityDomain: text("vanity_domain").unique(), // e.g., "acme.skills.io" for paid tenants
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/**
 * Type inference helpers
 */
export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;

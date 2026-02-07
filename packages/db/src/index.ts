/**
 * @relay/db - Database schema and Drizzle client
 */

// Re-export client
export { db, isDatabaseConfigured, DEFAULT_TENANT_ID } from "./client";

// Re-export all schema tables and types
export * from "./schema";

// Re-export relations
export * from "./relations";

// Re-export validation utilities
export * from "./validation";

// Re-export services
export * from "./services";

// Re-export tenant context utilities
export { withTenant } from "./tenant-context";

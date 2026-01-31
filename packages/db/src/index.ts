/**
 * @relay/db - Database schema and Drizzle client
 */

// Re-export client
export { db, isDatabaseConfigured } from "./client";

// Re-export all schema tables and types
export * from "./schema";

// Re-export relations
export * from "./relations";

// Re-export validation utilities
export * from "./validation";

// Re-export services
export * from "./services";

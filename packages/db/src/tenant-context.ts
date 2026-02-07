import { sql } from "drizzle-orm";
import { db } from "./client";

/**
 * Execute a callback within a tenant-scoped transaction.
 * Uses set_config() with is_local=true so RLS policies can read the
 * tenant ID via current_setting(). The is_local=true flag means the
 * variable is automatically cleared when the transaction ends --
 * safe for connection pooling.
 */
export async function withTenant<T>(
  tenantId: string,
  callback: (tx: typeof db) => Promise<T>
): Promise<T> {
  if (!tenantId) {
    throw new Error("withTenant requires a non-empty tenantId");
  }
  if (!db) {
    throw new Error("Database not configured");
  }

  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`);
    return callback(tx as unknown as typeof db);
  });
}

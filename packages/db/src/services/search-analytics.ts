import { db } from "../client";
import { searchQueries } from "../schema/search-queries";
import { sql, eq, and, gte, desc } from "drizzle-orm";

export interface SearchQueryEntry {
  tenantId: string;
  userId: string | null;
  query: string;
  normalizedQuery: string;
  resultCount: number;
  searchType: string;
}

/**
 * Log a search query. Fire-and-forget safe.
 * Uses direct INSERT (not transaction-scoped) because search_queries
 * is append-only analytics data.
 */
export async function logSearchQuery(entry: SearchQueryEntry): Promise<void> {
  if (!db) return;
  try {
    await db.insert(searchQueries).values(entry);
  } catch (error) {
    console.error("Failed to log search query:", error);
  }
}

/**
 * Get summary statistics for search queries within a time range.
 */
export async function getSearchSummaryStats(tenantId: string, since: Date) {
  if (!db) return null;

  const rows = await db
    .select({
      totalSearches: sql<number>`count(*)::int`,
      uniqueQueries: sql<number>`count(DISTINCT ${searchQueries.normalizedQuery})::int`,
      zeroResultSearches: sql<number>`count(*) FILTER (WHERE ${searchQueries.resultCount} = 0)::int`,
      uniqueSearchers: sql<number>`count(DISTINCT ${searchQueries.userId})::int`,
    })
    .from(searchQueries)
    .where(and(eq(searchQueries.tenantId, tenantId), gte(searchQueries.createdAt, since)));

  return rows[0] ?? null;
}

/**
 * Get top queries by frequency within a time range.
 */
export async function getTopQueries(tenantId: string, since: Date, limit = 50) {
  if (!db) return [];

  return db
    .select({
      query: searchQueries.normalizedQuery,
      searchCount: sql<number>`count(*)::int`,
      avgResults: sql<number>`round(avg(${searchQueries.resultCount}))::int`,
      zeroResultCount: sql<number>`count(*) FILTER (WHERE ${searchQueries.resultCount} = 0)::int`,
      lastSearched: sql<Date>`max(${searchQueries.createdAt})`,
    })
    .from(searchQueries)
    .where(and(eq(searchQueries.tenantId, tenantId), gte(searchQueries.createdAt, since)))
    .groupBy(searchQueries.normalizedQuery)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);
}

/**
 * Get queries that returned zero results, grouped and sorted by frequency.
 */
export async function getZeroResultQueries(tenantId: string, since: Date, limit = 30) {
  if (!db) return [];

  return db
    .select({
      query: searchQueries.normalizedQuery,
      searchCount: sql<number>`count(*)::int`,
      lastSearched: sql<Date>`max(${searchQueries.createdAt})`,
    })
    .from(searchQueries)
    .where(
      and(
        eq(searchQueries.tenantId, tenantId),
        gte(searchQueries.createdAt, since),
        eq(searchQueries.resultCount, 0)
      )
    )
    .groupBy(searchQueries.normalizedQuery)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);
}

/**
 * Get trending queries from the last 7 days, sorted by frequency.
 */
export async function getTrendingQueries(tenantId: string, since: Date, limit = 20) {
  if (!db) return [];

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Use the more recent of `since` and 7 days ago
  const effectiveSince = since > sevenDaysAgo ? since : sevenDaysAgo;

  return db
    .select({
      query: searchQueries.normalizedQuery,
      searchCount: sql<number>`count(*)::int`,
      uniqueUsers: sql<number>`count(DISTINCT ${searchQueries.userId})::int`,
    })
    .from(searchQueries)
    .where(and(eq(searchQueries.tenantId, tenantId), gte(searchQueries.createdAt, effectiveSince)))
    .groupBy(searchQueries.normalizedQuery)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);
}

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import {
  getSearchSummaryStats,
  getTopQueries,
  getZeroResultQueries,
  getTrendingQueries,
} from "@everyskill/db";
import { AdminSearchTable } from "@/components/admin-search-table";

const DEFAULT_TENANT_ID = "default-tenant-000-0000-000000000000";

export default async function AdminSearchPage() {
  const session = await auth();
  if (!session?.user?.id || !isAdmin(session)) {
    redirect("/");
  }

  const tenantId = session.user.tenantId || DEFAULT_TENANT_ID;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [stats, topQueries, zeroResultQueries, trendingQueries] = await Promise.all([
    getSearchSummaryStats(tenantId, thirtyDaysAgo),
    getTopQueries(tenantId, thirtyDaysAgo, 50),
    getZeroResultQueries(tenantId, thirtyDaysAgo, 30),
    getTrendingQueries(tenantId, sevenDaysAgo, 20),
  ]);

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900">Search Analytics</h2>
      <p className="mt-1 text-sm text-gray-600">
        Understand what users are searching for and identify skill gaps.
      </p>

      {/* Summary cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Total Searches</p>
          <p className="mt-1 text-3xl font-semibold text-gray-900">{stats?.totalSearches ?? 0}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Unique Queries</p>
          <p className="mt-1 text-3xl font-semibold text-gray-900">{stats?.uniqueQueries ?? 0}</p>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 shadow-sm">
          <p className="text-sm font-medium text-red-700">Zero Results</p>
          <p className="mt-1 text-3xl font-semibold text-red-900">
            {stats?.zeroResultSearches ?? 0}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Unique Searchers</p>
          <p className="mt-1 text-3xl font-semibold text-gray-900">{stats?.uniqueSearchers ?? 0}</p>
        </div>
      </div>
      <p className="mt-2 text-xs text-gray-400">Last 30 days</p>

      {/* Tabbed table */}
      <div className="mt-8">
        <AdminSearchTable
          topQueries={topQueries.map((q) => ({
            query: q.query,
            searchCount: q.searchCount,
            avgResults: q.avgResults,
            zeroResultCount: q.zeroResultCount,
            lastSearched: q.lastSearched ? new Date(q.lastSearched).toISOString() : null,
          }))}
          zeroResultQueries={zeroResultQueries.map((q) => ({
            query: q.query,
            searchCount: q.searchCount,
            lastSearched: q.lastSearched ? new Date(q.lastSearched).toISOString() : null,
          }))}
          trendingQueries={trendingQueries.map((q) => ({
            query: q.query,
            searchCount: q.searchCount,
            uniqueUsers: q.uniqueUsers,
          }))}
        />
      </div>
    </div>
  );
}

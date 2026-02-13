"use client";

import { useState } from "react";
import { RelativeTime } from "@/components/relative-time";

interface TopQueryRow {
  query: string;
  searchCount: number;
  avgResults: number;
  zeroResultCount: number;
  lastSearched: string | null;
}

interface ZeroResultRow {
  query: string;
  searchCount: number;
  lastSearched: string | null;
}

interface TrendingRow {
  query: string;
  searchCount: number;
  uniqueUsers: number;
}

interface AdminSearchTableProps {
  topQueries: TopQueryRow[];
  zeroResultQueries: ZeroResultRow[];
  trendingQueries: TrendingRow[];
}

type TabKey = "top" | "zero" | "trending";

const tabs: { key: TabKey; label: string }[] = [
  { key: "top", label: "Top Queries" },
  { key: "zero", label: "Zero Results" },
  { key: "trending", label: "Trending" },
];

export function AdminSearchTable({
  topQueries,
  zeroResultQueries,
  trendingQueries,
}: AdminSearchTableProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("top");

  const isEmpty =
    topQueries.length === 0 && zeroResultQueries.length === 0 && trendingQueries.length === 0;

  if (isEmpty) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
        <p className="text-sm text-gray-500">No search data yet.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Tab buttons */}
      <div className="flex gap-6 border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`pb-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="mt-4 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        {activeTab === "top" && <TopQueriesTable data={topQueries} />}
        {activeTab === "zero" && <ZeroResultTable data={zeroResultQueries} />}
        {activeTab === "trending" && <TrendingTable data={trendingQueries} />}
      </div>
    </div>
  );
}

function TopQueriesTable({ data }: { data: TopQueryRow[] }) {
  if (data.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-gray-500">No search data yet.</p>
      </div>
    );
  }

  return (
    <table className="min-w-full divide-y divide-gray-200">
      <thead className="bg-gray-50">
        <tr>
          <th
            scope="col"
            className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
          >
            Query
          </th>
          <th
            scope="col"
            className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
          >
            Searches
          </th>
          <th
            scope="col"
            className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
          >
            Avg Results
          </th>
          <th
            scope="col"
            className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
          >
            Zero-Result Count
          </th>
          <th
            scope="col"
            className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
          >
            Last Searched
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-200">
        {data.map((row) => (
          <tr key={row.query} className="hover:bg-gray-50">
            <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
              {row.query}
            </td>
            <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">{row.searchCount}</td>
            <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">{row.avgResults}</td>
            <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
              {row.zeroResultCount > 0 ? (
                <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                  {row.zeroResultCount}
                </span>
              ) : (
                row.zeroResultCount
              )}
            </td>
            <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
              {row.lastSearched ? (
                <RelativeTime date={row.lastSearched} />
              ) : (
                <span className="text-gray-400">Never</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ZeroResultTable({ data }: { data: ZeroResultRow[] }) {
  if (data.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-gray-500">No zero-result queries found.</p>
      </div>
    );
  }

  return (
    <table className="min-w-full divide-y divide-gray-200">
      <thead className="bg-gray-50">
        <tr>
          <th
            scope="col"
            className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
          >
            Query
          </th>
          <th
            scope="col"
            className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
          >
            Times Searched
          </th>
          <th
            scope="col"
            className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
          >
            Last Searched
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-200">
        {data.map((row) => (
          <tr key={row.query} className="hover:bg-gray-50">
            <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
              <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                {row.query}
              </span>
            </td>
            <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">{row.searchCount}</td>
            <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
              {row.lastSearched ? (
                <RelativeTime date={row.lastSearched} />
              ) : (
                <span className="text-gray-400">Never</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TrendingTable({ data }: { data: TrendingRow[] }) {
  if (data.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-gray-500">No trending queries in the last 7 days.</p>
      </div>
    );
  }

  return (
    <table className="min-w-full divide-y divide-gray-200">
      <thead className="bg-gray-50">
        <tr>
          <th
            scope="col"
            className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
          >
            Query (7-day)
          </th>
          <th
            scope="col"
            className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
          >
            Searches
          </th>
          <th
            scope="col"
            className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
          >
            Unique Users
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-200">
        {data.map((row) => (
          <tr key={row.query} className="hover:bg-gray-50">
            <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
              {row.query}
            </td>
            <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">{row.searchCount}</td>
            <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">{row.uniqueUsers}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

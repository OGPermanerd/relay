"use client";

import { RelativeTime } from "@/components/relative-time";

interface ComplianceRow {
  userId: string;
  userName: string | null;
  userEmail: string;
  isCompliant: boolean;
  lastHookEvent?: string;
  hookEventCount: number;
}

interface AdminComplianceTableProps {
  data: ComplianceRow[];
}

export function AdminComplianceTable({ data }: AdminComplianceTableProps) {
  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
        <p className="text-sm text-gray-500">No users found in this tenant.</p>
      </div>
    );
  }

  // Sort: non-compliant first, then by email
  const sorted = [...data].sort((a, b) => {
    if (a.isCompliant !== b.isCompliant) {
      return a.isCompliant ? 1 : -1;
    }
    return a.userEmail.localeCompare(b.userEmail);
  });

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
            >
              User
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
            >
              Email
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
            >
              Status
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
            >
              Last Activity
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
            >
              Event Count
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {sorted.map((row) => (
            <tr key={row.userId} className="hover:bg-gray-50">
              <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                {row.userName || "Unknown"}
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">{row.userEmail}</td>
              <td className="whitespace-nowrap px-6 py-4">
                {row.isCompliant ? (
                  <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                    Compliant
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                    Non-compliant
                  </span>
                )}
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                {row.lastHookEvent ? (
                  <RelativeTime date={row.lastHookEvent} />
                ) : (
                  <span className="text-gray-400">Never</span>
                )}
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                {row.hookEventCount}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

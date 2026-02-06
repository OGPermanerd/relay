"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTimeRange } from "./time-range-selector";
import { fetchEmployeeActivity, type ActivityEvent } from "@/app/actions/get-employee-activity";

interface EmployeeRow {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  skillsUsed: number;
  usageFrequency: number;
  hoursSaved: number;
  lastActive: string;
  topSkill: string | null;
}

interface EmployeeDetailModalProps {
  employee: EmployeeRow;
  onClose: () => void;
}

/**
 * Employee detail modal with stats and activity list
 *
 * Shows aggregate stats at top and scrollable list of recent
 * usage events for drill-down into individual activity.
 */
export function EmployeeDetailModal({ employee, onClose }: EmployeeDetailModalProps) {
  const range = useTimeRange();
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    fetchEmployeeActivity(employee.id, range)
      .then(setActivity)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [employee.id, range]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-lg bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-gray-200 p-6">
          <div className="flex items-center gap-4">
            {employee.image ? (
              <Image src={employee.image} alt="" width={48} height={48} className="rounded-full" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-200 text-lg font-medium text-gray-600">
                {employee.name?.charAt(0) || employee.email.charAt(0)}
              </div>
            )}
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{employee.name || "Unknown"}</h2>
              <p className="text-sm text-gray-500">{employee.email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 bg-gray-50 p-6">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-2xl font-bold text-gray-900">{employee.skillsUsed}</p>
            <p className="text-sm text-gray-500">Skills Used</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-2xl font-bold text-gray-900">{employee.usageFrequency}</p>
            <p className="text-sm text-gray-500">Total Uses</p>
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <p className="text-2xl font-bold text-blue-600">{employee.hoursSaved.toFixed(1)}</p>
            <p className="text-sm text-gray-500">Hours Saved</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-2xl font-bold text-gray-900">
              {new Date(employee.lastActive).toLocaleDateString()}
            </p>
            <p className="text-sm text-gray-500">Last Active</p>
          </div>
        </div>

        {/* Activity List - DRILL DOWN to individual activity detail */}
        <div className="flex-1 overflow-y-auto p-6">
          <h3 className="mb-3 text-sm font-medium text-gray-500">Recent Activity</h3>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <svg className="h-6 w-6 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            </div>
          ) : activity.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-400">No activity in this period</p>
          ) : (
            <div className="space-y-2">
              {activity.map((event, index) => (
                <div
                  key={`${event.skillId}-${event.date}-${index}`}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {event.skillId ? (
                        <Link
                          href={`/skills/${event.skillId}`}
                          className="truncate text-sm font-medium text-gray-900 hover:text-blue-600"
                        >
                          {event.skillName}
                        </Link>
                      ) : (
                        <span className="truncate text-sm font-medium text-gray-900">
                          {event.skillName}
                        </span>
                      )}
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                        {event.action}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {new Date(event.date).toLocaleDateString()} at{" "}
                      {new Date(event.date).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <div className="ml-4 text-right">
                    <span className="text-sm font-medium text-blue-600">
                      {event.hoursSaved.toFixed(1)}h
                    </span>
                    <p className="text-xs text-gray-400">saved</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-gray-200 p-6">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Close
          </button>
          <Link
            href={`/users/${employee.id}`}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            View Profile
          </Link>
        </div>
      </div>
    </div>
  );
}

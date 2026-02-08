"use client";

import { useActionState } from "react";
import {
  saveMyPreferences,
  type SavePreferencesResult,
} from "@/app/actions/notification-preferences";

interface NotificationPreferencesFormProps {
  initialPreferences: {
    groupingProposalEmail: boolean;
    groupingProposalInApp: boolean;
    trendingDigest: "none" | "daily" | "weekly";
    platformUpdatesEmail: boolean;
    platformUpdatesInApp: boolean;
    reviewNotificationsEmail: boolean;
    reviewNotificationsInApp: boolean;
  };
}

export function NotificationPreferencesForm({
  initialPreferences,
}: NotificationPreferencesFormProps) {
  const [state, formAction, isPending] = useActionState(
    async (_prev: SavePreferencesResult, formData: FormData) => {
      return saveMyPreferences(formData);
    },
    {} as SavePreferencesResult
  );

  return (
    <form action={formAction}>
      <div className="rounded-lg bg-white shadow-sm">
        {/* Section 1: Skill Grouping Requests */}
        <div className="border-b border-gray-200 p-6">
          <h2 className="text-base font-medium text-gray-900">Skill Grouping Requests</h2>
          <p className="mt-1 text-sm text-gray-500">
            When someone proposes grouping a skill under yours
          </p>
          <div className="mt-4 space-y-3">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                name="groupingProposalEmail"
                defaultChecked={initialPreferences.groupingProposalEmail}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Email notifications</span>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                name="groupingProposalInApp"
                defaultChecked={initialPreferences.groupingProposalInApp}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">In-app notifications</span>
            </label>
          </div>
        </div>

        {/* Section 2: Trending Skills Digest */}
        <div className="border-b border-gray-200 p-6">
          <h2 className="text-base font-medium text-gray-900">Trending Skills Digest</h2>
          <p className="mt-1 text-sm text-gray-500">
            Regular digest of trending skills in your organization
          </p>
          <div className="mt-4">
            <label className="block text-sm text-gray-700">
              Frequency
              <select
                name="trendingDigest"
                defaultValue={initialPreferences.trendingDigest}
                className="ml-3 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                <option value="none">None</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </label>
          </div>
        </div>

        {/* Section 3: Platform Updates */}
        <div className="border-b border-gray-200 p-6">
          <h2 className="text-base font-medium text-gray-900">Platform Updates</h2>
          <p className="mt-1 text-sm text-gray-500">Feature releases and platform improvements</p>
          <div className="mt-4 space-y-3">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                name="platformUpdatesEmail"
                defaultChecked={initialPreferences.platformUpdatesEmail}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Email notifications</span>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                name="platformUpdatesInApp"
                defaultChecked={initialPreferences.platformUpdatesInApp}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">In-app notifications</span>
            </label>
          </div>
        </div>

        {/* Section 4: Review Notifications */}
        <div className="p-6">
          <h2 className="text-base font-medium text-gray-900">Review Notifications</h2>
          <p className="mt-1 text-sm text-gray-500">
            When your skills are reviewed or when skills need your review
          </p>
          <div className="mt-4 space-y-3">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                name="reviewNotificationsEmail"
                defaultChecked={initialPreferences.reviewNotificationsEmail}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Email notifications</span>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                name="reviewNotificationsInApp"
                defaultChecked={initialPreferences.reviewNotificationsInApp}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">In-app notifications</span>
            </label>
          </div>
        </div>
      </div>

      {/* Feedback messages */}
      {state?.success && (
        <div className="mt-4 rounded-md bg-green-50 p-3">
          <p className="text-sm text-green-700">Preferences saved successfully.</p>
        </div>
      )}
      {state?.error && (
        <div className="mt-4 rounded-md bg-red-50 p-3">
          <p className="text-sm text-red-700">{state.error}</p>
        </div>
      )}

      {/* Save button */}
      <div className="mt-6">
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          {isPending ? "Saving..." : "Save Preferences"}
        </button>
      </div>
    </form>
  );
}

"use client";

import type React from "react";
import Link from "next/link";
import { RelativeTime } from "@/components/relative-time";

function getNotificationIcon(type: string): { icon: React.ReactNode; color: string } {
  switch (type) {
    case "review_submitted":
      return {
        color: "text-blue-500",
        icon: (
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15a2.25 2.25 0 0 1 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z"
            />
          </svg>
        ),
      };
    case "review_approved":
      return {
        color: "text-green-500",
        icon: (
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
            />
          </svg>
        ),
      };
    case "review_rejected":
      return {
        color: "text-red-500",
        icon: (
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
            />
          </svg>
        ),
      };
    case "review_changes_requested":
      return {
        color: "text-amber-500",
        icon: (
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
            />
          </svg>
        ),
      };
    case "review_published":
      return {
        color: "text-green-600",
        icon: (
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418"
            />
          </svg>
        ),
      };
    case "grouping_proposal":
      return {
        color: "text-indigo-500",
        icon: (
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m9.07-9.07 1.757-1.757a4.5 4.5 0 0 1 6.364 6.364l-4.5 4.5a4.5 4.5 0 0 1-7.244-1.242"
            />
          </svg>
        ),
      };
    default:
      return {
        color: "text-gray-400",
        icon: (
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
            />
          </svg>
        ),
      };
  }
}

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  actionUrl: string | null;
  isRead: boolean;
  createdAt: string;
}

interface NotificationListProps {
  notifications: NotificationItem[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
}

export function NotificationList({
  notifications,
  onMarkRead,
  onMarkAllRead,
}: NotificationListProps) {
  const hasUnread = notifications.some((n) => !n.isRead);

  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center">
        <div className="px-4 py-8 text-center text-sm text-gray-500">No notifications yet</div>
        <div className="border-t border-gray-100 px-4 py-2 text-center">
          <Link
            href="/settings/notifications"
            className="text-xs text-gray-400 transition hover:text-gray-600"
          >
            Notification Settings
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2">
        <span className="text-sm font-semibold text-gray-900">Notifications</span>
        {hasUnread && (
          <button
            onClick={onMarkAllRead}
            className="text-xs text-blue-600 transition hover:text-blue-800"
          >
            Mark all as read
          </button>
        )}
      </div>

      {/* Scrollable list */}
      <div className="max-h-96 overflow-y-auto">
        {notifications.map((notification) => {
          const content = (
            <div
              className={`flex gap-3 px-4 py-3 transition ${
                notification.isRead ? "bg-gray-50" : "bg-white hover:bg-gray-50"
              }`}
            >
              {/* Type icon + unread indicator */}
              <div className="flex flex-shrink-0 flex-col items-center gap-1 pt-0.5">
                <span className={getNotificationIcon(notification.type).color}>
                  {getNotificationIcon(notification.type).icon}
                </span>
                {!notification.isRead && <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />}
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">{notification.title}</p>
                <p className="mt-0.5 line-clamp-2 text-sm text-gray-600">{notification.message}</p>
                <RelativeTime
                  date={notification.createdAt}
                  className="mt-1 text-xs text-gray-400"
                />
              </div>
            </div>
          );

          if (notification.actionUrl) {
            return (
              <a
                key={notification.id}
                href={notification.actionUrl}
                onClick={() => {
                  if (!notification.isRead) onMarkRead(notification.id);
                }}
                className="block border-b border-gray-50 last:border-b-0"
              >
                {content}
              </a>
            );
          }

          return (
            <div
              key={notification.id}
              onClick={() => {
                if (!notification.isRead) onMarkRead(notification.id);
              }}
              className="cursor-pointer border-b border-gray-50 last:border-b-0"
            >
              {content}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-100 px-4 py-2 text-center">
        <Link
          href="/settings/notifications"
          className="text-xs text-gray-400 transition hover:text-gray-600"
        >
          Notification Settings
        </Link>
      </div>
    </div>
  );
}

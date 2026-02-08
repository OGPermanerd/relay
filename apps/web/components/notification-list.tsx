"use client";

import Link from "next/link";
import { RelativeTime } from "@/components/relative-time";

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
              {/* Unread indicator */}
              <div className="flex flex-shrink-0 pt-1.5">
                {!notification.isRead ? (
                  <div className="h-2 w-2 rounded-full bg-blue-500" />
                ) : (
                  <div className="h-2 w-2" />
                )}
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

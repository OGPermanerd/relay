"use client";

import { useState, useEffect, useRef, useTransition, useCallback } from "react";
import { NotificationList } from "@/components/notification-list";
import { getMyNotifications, markRead, markAllRead } from "@/app/actions/notifications";

interface NotificationData {
  id: string;
  type: string;
  title: string;
  message: string;
  actionUrl: string | null;
  isRead: boolean;
  createdAt: string;
}

interface NotificationBellProps {
  initialCount: number;
  initialNotifications: NotificationData[];
}

export function NotificationBell({ initialCount, initialNotifications }: NotificationBellProps) {
  const [count, setCount] = useState(initialCount);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [isOpen, setIsOpen] = useState(false);
  const [_isPending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // Refresh notifications when dropdown opens
  useEffect(() => {
    if (isOpen) {
      startTransition(async () => {
        const fresh = await getMyNotifications();
        setNotifications(fresh);
        const unreadCount = fresh.filter((n) => !n.isRead).length;
        setCount(unreadCount);
      });
    }
  }, [isOpen]);

  const handleMarkRead = useCallback((notificationId: string) => {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n))
    );
    setCount((prev) => Math.max(0, prev - 1));

    startTransition(async () => {
      const newCount = await markRead(notificationId);
      setCount(newCount);
    });
  }, []);

  const handleMarkAllRead = useCallback(() => {
    // Optimistic update
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setCount(0);

    startTransition(async () => {
      await markAllRead();
      setCount(0);
    });
  }, []);

  const displayCount = count > 99 ? "99+" : count;

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative rounded-full p-1 text-gray-500 transition hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        aria-label={`Notifications${count > 0 ? ` (${count} unread)` : ""}`}
      >
        {/* Bell icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="h-6 w-6"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
          />
        </svg>

        {/* Unread badge */}
        {count > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {displayCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg sm:w-96">
          <NotificationList
            notifications={notifications}
            onMarkRead={handleMarkRead}
            onMarkAllRead={handleMarkAllRead}
          />
        </div>
      )}
    </div>
  );
}

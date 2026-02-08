"use client";

import { RelativeTime } from "./relative-time";
import { markAsRead } from "@/app/actions/skill-messages";

interface MessageItem {
  id: string;
  fromUserId: string;
  subjectSkillId: string;
  proposedParentSkillId: string | null;
  message: string;
  status: string;
  createdAt: Date;
  readAt: Date | null;
}

interface MessagesListProps {
  messages: MessageItem[];
}

function statusBadge(status: string) {
  switch (status) {
    case "accepted":
      return (
        <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
          Accepted
        </span>
      );
    case "declined":
      return (
        <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
          Declined
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
          Pending
        </span>
      );
  }
}

export function MessagesList({ messages }: MessagesListProps) {
  if (messages.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
        <p className="text-gray-500">
          No messages yet. When someone proposes grouping a skill under yours, it will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {messages.map((msg) => {
        const isUnread = msg.readAt === null;

        return (
          <div
            key={msg.id}
            className={`rounded-lg border bg-white p-4 ${
              isUnread
                ? "border-l-4 border-l-blue-500 border-t-gray-200 border-r-gray-200 border-b-gray-200"
                : "border-gray-200"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                {/* Message text */}
                <p className="text-sm text-gray-900 whitespace-pre-wrap">{msg.message}</p>

                {/* Metadata row */}
                <div className="mt-2 flex items-center gap-3 flex-wrap">
                  {statusBadge(msg.status)}
                  <span className="text-xs text-gray-400">
                    Skill: {msg.subjectSkillId.slice(0, 8)}...
                  </span>
                  <span className="text-xs text-gray-400">
                    From: {msg.fromUserId.slice(0, 8)}...
                  </span>
                  <RelativeTime
                    date={msg.createdAt.toISOString()}
                    className="text-xs text-gray-400"
                  />
                </div>
              </div>

              {/* Mark as read button */}
              {isUnread && (
                <form action={markAsRead}>
                  <input type="hidden" name="messageId" value={msg.id} />
                  <button
                    type="submit"
                    className="rounded border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 whitespace-nowrap"
                  >
                    Mark as read
                  </button>
                </form>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

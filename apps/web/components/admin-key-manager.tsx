"use client";

import { useState, useCallback } from "react";
import { generateApiKey, revokeApiKeyAction, listAllApiKeysAction } from "@/app/actions/api-keys";

interface AdminKeyData {
  id: string;
  userId: string;
  keyPrefix: string;
  name: string;
  lastUsedAt: string | Date | null;
  createdAt: string | Date;
  revokedAt: string | Date | null;
  expiresAt: string | Date | null;
  userName: string | null;
  userEmail: string | null;
}

interface AdminKeyManagerProps {
  initialKeys: AdminKeyData[];
  users: { id: string; name: string | null; email: string }[];
}

function getKeyStatus(key: AdminKeyData): "active" | "revoked" | "expiring" {
  if (key.revokedAt) return "revoked";
  if (key.expiresAt && new Date(key.expiresAt) > new Date()) return "expiring";
  return "active";
}

function StatusBadge({ status }: { status: "active" | "revoked" | "expiring" }) {
  const styles = {
    active: "bg-green-100 text-green-700",
    revoked: "bg-red-100 text-red-700",
    expiring: "bg-yellow-100 text-yellow-700",
  };

  const labels = {
    active: "Active",
    revoked: "Revoked",
    expiring: "Expiring",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

function formatRelativeDate(date: Date | string): string {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}

function ShowOnceKeyDisplay({ rawKey, onDone }: { rawKey: string; onDone: () => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(rawKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = rawKey;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [rawKey]);

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
      <div className="mb-2 flex items-center gap-2">
        <svg
          className="h-5 w-5 text-amber-600"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
          />
        </svg>
        <p className="text-sm font-semibold text-amber-800">
          Copy this key now. You will not be able to see it again.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <code className="flex-1 break-all rounded bg-white px-3 py-2 font-mono text-sm text-gray-900">
          {rawKey}
        </code>
        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 rounded-md bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <button
        type="button"
        onClick={onDone}
        className="mt-3 rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
      >
        Done
      </button>
    </div>
  );
}

export function AdminKeyManager({ initialKeys, users }: AdminKeyManagerProps) {
  const [keys, setKeys] = useState<AdminKeyData[]>(initialKeys);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const refreshKeys = useCallback(async () => {
    const result = await listAllApiKeysAction();
    if (result.keys) {
      setKeys(result.keys);
    }
  }, []);

  const handleGenerate = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsGenerating(true);

    const form = e.currentTarget;
    const formData = new FormData(form);

    const result = await generateApiKey(formData);

    if (result.error) {
      setError(result.error);
      setIsGenerating(false);
      return;
    }

    if (result.key) {
      setNewKey(result.key);
      form.reset();
    }

    setIsGenerating(false);
  }, []);

  const handleDone = useCallback(async () => {
    setNewKey(null);
    await refreshKeys();
  }, [refreshKeys]);

  const handleRevoke = useCallback(
    async (keyId: string) => {
      setError(null);
      setRevokingId(keyId);

      const result = await revokeApiKeyAction(keyId);

      if (result.error) {
        setError(result.error);
        setRevokingId(null);
        return;
      }

      await refreshKeys();
      setRevokingId(null);
    },
    [refreshKeys]
  );

  const filteredKeys = keys.filter((key) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (
      (key.userName && key.userName.toLowerCase().includes(q)) ||
      (key.userEmail && key.userEmail.toLowerCase().includes(q)) ||
      key.keyPrefix.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Error display */}
      {error && <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      {/* Show-once raw key display */}
      {newKey && <ShowOnceKeyDisplay rawKey={newKey} onDone={handleDone} />}

      {/* Generate key for user form */}
      {!newKey && (
        <div className="rounded-lg bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">Generate Key for User</h2>
          <form onSubmit={handleGenerate} className="flex items-end gap-3">
            <div className="w-64">
              <label
                htmlFor="admin-user-select"
                className="block text-sm font-medium text-gray-700"
              >
                User
              </label>
              <select
                id="admin-user-select"
                name="forUserId"
                required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Select a user...</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name || user.email} ({user.email})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label htmlFor="admin-key-name" className="block text-sm font-medium text-gray-700">
                Key Name
              </label>
              <input
                type="text"
                id="admin-key-name"
                name="name"
                required
                maxLength={100}
                placeholder="e.g., Production MCP"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={isGenerating}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-300"
            >
              {isGenerating ? "Generating..." : "Generate"}
            </button>
          </form>
        </div>
      )}

      {/* Filter input */}
      <div>
        <input
          type="text"
          placeholder="Filter by user name, email, or key prefix..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Key list table */}
      {filteredKeys.length === 0 ? (
        <div className="rounded-lg bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-gray-600">
            {keys.length === 0
              ? "No API keys found. Generate one above."
              : "No keys match your filter."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  User
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Key Prefix
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Last Used
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Created
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredKeys.map((key) => {
                const status = getKeyStatus(key);
                const isRevoking = revokingId === key.id;

                return (
                  <tr key={key.id}>
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">
                        {key.userName || "Unknown"}
                      </div>
                      <div className="text-xs text-gray-500">{key.userEmail || ""}</div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <code className="font-mono text-sm text-gray-500">{key.keyPrefix}...</code>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                      {key.name}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <StatusBadge status={status} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                      {key.lastUsedAt ? formatRelativeDate(key.lastUsedAt) : "Never"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                      {new Date(key.createdAt).toLocaleDateString()}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      {(status === "active" || status === "expiring") && (
                        <button
                          type="button"
                          onClick={() => handleRevoke(key.id)}
                          disabled={isRevoking}
                          className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          {isRevoking ? "Revoking..." : "Revoke"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useCallback } from "react";
import {
  generateApiKey,
  revokeApiKeyAction,
  rotateApiKey,
  listApiKeysAction,
} from "@/app/actions/api-keys";

interface ApiKeyData {
  id: string;
  keyPrefix: string;
  name: string;
  lastUsedAt: string | Date | null;
  createdAt: string | Date;
  revokedAt: string | Date | null;
  expiresAt: string | Date | null;
}

interface ApiKeyManagerProps {
  initialKeys: ApiKeyData[];
}

function getKeyStatus(key: ApiKeyData): "active" | "revoked" | "expiring" {
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
      // Fallback: select text for manual copy
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

export function ApiKeyManager({ initialKeys }: ApiKeyManagerProps) {
  const [keys, setKeys] = useState<ApiKeyData[]>(initialKeys);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [showGenerateForm, setShowGenerateForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const refreshKeys = useCallback(async () => {
    const result = await listApiKeysAction();
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
      setShowGenerateForm(false);
      form.reset();
    }

    setIsGenerating(false);
  }, []);

  const handleDone = useCallback(async () => {
    setNewKey(null);
    await refreshKeys();
  }, [refreshKeys]);

  const handleRotate = useCallback(async () => {
    setError(null);
    setIsRotating(true);

    const formData = new FormData();
    formData.set("name", "Rotated Key");

    const result = await rotateApiKey(formData);

    if (result.error) {
      setError(result.error);
      setIsRotating(false);
      return;
    }

    if (result.key) {
      setNewKey(result.key);
      await refreshKeys();
    }

    setIsRotating(false);
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

  const activeKeys = keys.filter((k) => !k.revokedAt);

  return (
    <div className="space-y-6">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">API Keys</h2>
        <div className="flex gap-2">
          {activeKeys.length > 0 && (
            <button
              type="button"
              onClick={handleRotate}
              disabled={isRotating}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {isRotating ? "Rotating..." : "Rotate Keys"}
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowGenerateForm(!showGenerateForm)}
            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Generate Key
          </button>
        </div>
      </div>

      {/* Error display */}
      {error && <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      {/* Show-once raw key display */}
      {newKey && <ShowOnceKeyDisplay rawKey={newKey} onDone={handleDone} />}

      {/* Generate form */}
      {showGenerateForm && !newKey && (
        <div className="rounded-lg bg-white p-4 shadow-sm">
          <form onSubmit={handleGenerate} className="flex items-end gap-3">
            <div className="flex-1">
              <label htmlFor="key-name" className="block text-sm font-medium text-gray-700">
                Key Name
              </label>
              <input
                type="text"
                id="key-name"
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
            <button
              type="button"
              onClick={() => setShowGenerateForm(false)}
              className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
            >
              Cancel
            </button>
          </form>
        </div>
      )}

      {/* Key list */}
      {keys.length === 0 ? (
        <div className="rounded-lg bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
            <svg
              className="h-6 w-6 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z"
              />
            </svg>
          </div>
          <p className="text-sm text-gray-600">
            No API keys yet. Generate one to authenticate your MCP sessions.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {keys.map((key) => {
            const status = getKeyStatus(key);
            const isRevoking = revokingId === key.id;

            return (
              <div
                key={key.id}
                className="flex items-center justify-between rounded-lg bg-white p-4 shadow-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <code className="font-mono text-sm text-gray-500">{key.keyPrefix}...</code>
                    <span className="truncate text-sm font-medium text-gray-900">{key.name}</span>
                    <StatusBadge status={status} />
                  </div>
                  <div className="mt-1 flex items-center gap-4 text-xs text-gray-500">
                    <span>Created {new Date(key.createdAt).toLocaleDateString()}</span>
                    <span>
                      Last used: {key.lastUsedAt ? formatRelativeDate(key.lastUsedAt) : "Never"}
                    </span>
                    {status === "expiring" && key.expiresAt && (
                      <span className="text-yellow-600">
                        Expires {new Date(key.expiresAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                {(status === "active" || status === "expiring") && (
                  <button
                    type="button"
                    onClick={() => handleRevoke(key.id)}
                    disabled={isRevoking}
                    className="ml-4 shrink-0 rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    {isRevoking ? "Revoking..." : "Revoke"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

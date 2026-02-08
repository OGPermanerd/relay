const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 100;

const store = new Map<string, number[]>();

export function checkRateLimit(keyId: string): boolean {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;

  const timestamps = store.get(keyId);
  if (timestamps) {
    // Filter to current window
    const recent = timestamps.filter((t) => t > cutoff);

    if (recent.length >= MAX_REQUESTS) {
      // Update store with filtered array (discard expired)
      store.set(keyId, recent);
      return false;
    }

    recent.push(now);
    store.set(keyId, recent);
    return true;
  }

  // First request for this key
  store.set(keyId, [now]);
  return true;
}

// Cleanup stale entries every 5 minutes
setInterval(
  () => {
    const cutoff = Date.now() - WINDOW_MS * 2;
    for (const [keyId, timestamps] of store) {
      const remaining = timestamps.filter((t) => t > cutoff);
      if (remaining.length === 0) {
        store.delete(keyId);
      } else {
        store.set(keyId, remaining);
      }
    }
  },
  5 * 60 * 1000,
).unref();

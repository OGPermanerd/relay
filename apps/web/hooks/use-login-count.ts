"use client";

import { useState, useEffect } from "react";

const LOGIN_COUNT_KEY = "relay-login-count";
const SESSION_COUNTED_KEY = "relay-session-counted";
const ONBOARDING_THRESHOLD = 5;

interface UseLoginCountReturn {
  count: number;
  isOnboarding: boolean;
}

/**
 * Track user login count for progressive feature disclosure.
 *
 * - Increments once per session (not per page load)
 * - Persists count in localStorage across sessions
 * - `isOnboarding` is true for first 5 sessions
 *
 * @returns { count, isOnboarding }
 */
export function useLoginCount(): UseLoginCountReturn {
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    // SSR guard
    if (typeof window === "undefined") return;

    // Read current count
    let currentCount = 0;
    try {
      const stored = localStorage.getItem(LOGIN_COUNT_KEY);
      currentCount = stored ? parseInt(stored, 10) : 0;
    } catch {
      // localStorage not available
      currentCount = 0;
    }

    // Check if already counted this session
    let alreadyCounted = false;
    try {
      alreadyCounted = sessionStorage.getItem(SESSION_COUNTED_KEY) === "true";
    } catch {
      // sessionStorage not available
      alreadyCounted = false;
    }

    if (!alreadyCounted) {
      // Increment count
      currentCount += 1;
      try {
        localStorage.setItem(LOGIN_COUNT_KEY, String(currentCount));
        sessionStorage.setItem(SESSION_COUNTED_KEY, "true");
      } catch {
        // Storage not available, continue with memory state
      }
    }

    setCount(currentCount);
  }, []);

  const isOnboarding = count <= ONBOARDING_THRESHOLD;

  return { count, isOnboarding };
}

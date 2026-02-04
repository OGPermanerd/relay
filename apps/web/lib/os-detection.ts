/**
 * OS detection utility for platform-specific install instructions.
 *
 * IMPORTANT: detectOS() reads navigator.userAgent which is only available
 * in the browser. Call this function only inside useEffect to avoid SSR
 * hydration mismatches.
 */

export type DetectedOS = "macos" | "windows" | "linux";

/**
 * Detect the user's operating system from the browser environment.
 *
 * Checks navigator.userAgentData.platform first (Chromium browsers),
 * then falls back to navigator.userAgent string parsing.
 *
 * Returns "macos" as default when navigator is undefined (SSR) or
 * when the OS cannot be determined.
 *
 * @important Only call inside useEffect to avoid SSR hydration mismatches.
 */
export function detectOS(): DetectedOS {
  if (typeof navigator === "undefined") return "macos";

  // Check userAgentData first (Chromium only, but more reliable when available)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const uaData = (navigator as any).userAgentData as { platform?: string } | undefined;
  if (uaData?.platform) {
    const platform = uaData.platform.toLowerCase();
    if (platform === "macos") return "macos";
    if (platform === "windows") return "windows";
    if (platform === "linux") return "linux";
  }

  // Fallback to user agent string
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("mac")) return "macos";
  if (ua.includes("win")) return "windows";
  if (ua.includes("linux")) return "linux";

  return "macos";
}

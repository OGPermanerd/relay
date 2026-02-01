/**
 * Accessibility utilities for screen reader support
 */

const ANNOUNCER_ID = "relay-sr-announcer";

/**
 * Get or create a visually-hidden live region for screen reader announcements.
 * Uses aria-live="polite" so announcements don't interrupt current speech.
 */
function getAnnouncer(): HTMLElement {
  let announcer = document.getElementById(ANNOUNCER_ID);

  if (!announcer) {
    announcer = document.createElement("div");
    announcer.id = ANNOUNCER_ID;
    announcer.setAttribute("aria-live", "polite");
    announcer.setAttribute("aria-atomic", "true");
    // Tailwind sr-only equivalent styles
    announcer.style.cssText = `
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    `;
    document.body.appendChild(announcer);
  }

  return announcer;
}

/**
 * Announce a message to screen readers via ARIA live region.
 *
 * @param message - The message to announce
 * @param clearDelay - Time in ms before clearing the region (default: 1000)
 *
 * @example
 * announceToScreenReader("Table sorted by Days Saved, descending");
 */
export function announceToScreenReader(message: string, clearDelay: number = 1000): void {
  // Skip if running on server (SSR)
  if (typeof window === "undefined") return;

  const announcer = getAnnouncer();
  announcer.textContent = message;

  // Clear after delay to allow re-announcement of same message
  setTimeout(() => {
    announcer.textContent = "";
  }, clearDelay);
}

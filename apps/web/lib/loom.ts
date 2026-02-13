/**
 * Loom URL validation, video ID extraction, and oEmbed fetcher.
 *
 * Supports Loom share, embed, and direct (/i/) URL formats.
 * oEmbed endpoint: https://www.loom.com/v1/oembed
 */

/** Matches https://(www.)loom.com/(share|embed|i)/<32-hex-char-id> with optional query params */
export const LOOM_URL_REGEX =
  /^https?:\/\/(www\.)?loom\.com\/(share|embed|i)\/[a-f0-9]{32}(\?.*)?$/;

/** Returns true if the URL is a valid Loom video URL. */
export function isValidLoomUrl(url: string): boolean {
  return LOOM_URL_REGEX.test(url);
}

/** Extracts the 32-character hex video ID from a Loom URL, or null if invalid. */
export function extractLoomVideoId(url: string): string | null {
  const match = url.match(/loom\.com\/(share|embed|i)\/([a-f0-9]{32})/);
  return match ? match[2] : null;
}

export interface LoomOEmbedResponse {
  type: "video";
  html: string;
  title: string;
  height: number | null;
  width: number | null;
  provider_name: "Loom";
  provider_url: string;
  thumbnail_url: string;
  thumbnail_height: number;
  thumbnail_width: number;
  duration: number;
}

/**
 * Fetches oEmbed metadata for a Loom video URL.
 * Returns null on error, non-ok response, or invalid URL.
 * Uses Next.js fetch caching (revalidate every hour).
 */
export async function fetchLoomOEmbed(loomUrl: string): Promise<LoomOEmbedResponse | null> {
  try {
    const endpoint = `https://www.loom.com/v1/oembed?url=${encodeURIComponent(loomUrl)}`;
    const res = await fetch(endpoint, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    return (await res.json()) as LoomOEmbedResponse;
  } catch {
    return null;
  }
}

import { randomBytes, createHash } from "crypto";

export const KEY_PREFIX = "rlk_";
const KEY_BYTE_LENGTH = 32;

export function generateRawApiKey(): string {
  return `${KEY_PREFIX}${randomBytes(KEY_BYTE_LENGTH).toString("hex")}`;
}

export function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

export function extractPrefix(rawKey: string): string {
  return rawKey.substring(0, 12);
}

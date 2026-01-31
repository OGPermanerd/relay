import { S3Client } from "@aws-sdk/client-s3";

// Lazy-initialized client
let client: S3Client | null = null;

/**
 * Get an S3Client configured for Cloudflare R2
 * Returns null when R2 credentials are not configured
 */
export function getR2Client(): S3Client | null {
  if (client) return client;

  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    return null;
  }

  client = new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });

  return client;
}

/**
 * Check if R2 storage is fully configured
 * All four environment variables must be set
 */
export function isStorageConfigured(): boolean {
  return !!(
    process.env.R2_ENDPOINT &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME
  );
}

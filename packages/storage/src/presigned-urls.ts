import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getR2Client } from "./r2-client";

const BUCKET = () => process.env.R2_BUCKET_NAME!;
const DEFAULT_EXPIRY = 3600; // 1 hour

export interface UploadUrlResult {
  uploadUrl: string;
  objectKey: string;
}

/**
 * Generate presigned URL for uploading skill content
 * Key pattern: skills/{skillId}/v{version}/content
 * Returns null when R2 is not configured
 */
export async function generateUploadUrl(
  skillId: string,
  version: number,
  contentType: string
): Promise<UploadUrlResult | null> {
  const client = getR2Client();
  if (!client) return null;

  const objectKey = `skills/${skillId}/v${version}/content`;

  const command = new PutObjectCommand({
    Bucket: BUCKET(),
    Key: objectKey,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(client, command, {
    expiresIn: DEFAULT_EXPIRY,
  });

  return { uploadUrl, objectKey };
}

/**
 * Generate presigned URL for downloading skill content
 * Returns null when R2 is not configured
 */
export async function generateDownloadUrl(objectKey: string): Promise<string | null> {
  const client = getR2Client();
  if (!client) return null;

  const command = new GetObjectCommand({
    Bucket: BUCKET(),
    Key: objectKey,
  });

  return getSignedUrl(client, command, { expiresIn: DEFAULT_EXPIRY });
}

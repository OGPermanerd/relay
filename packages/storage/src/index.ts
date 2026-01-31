// @relay/storage - R2 object storage integration
export { getR2Client, isStorageConfigured } from "./r2-client";
export { generateUploadUrl, generateDownloadUrl } from "./presigned-urls";
export type { UploadUrlResult } from "./presigned-urls";

/**
 * Client-side text extraction from uploaded work artifact files.
 * Supports .txt, .md, .json, .eml — all read as plain text.
 * Other file types return metadata-only (text: null).
 */

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_TEXT_LENGTH = 100_000;

export interface ParsedArtifact {
  text: string | null;
  fileType: string;
}

/**
 * Extract text content from a File object.
 * Returns null text if file exceeds 5MB or is an unsupported type.
 * Truncates extracted text to 100,000 characters.
 */
export async function parseArtifactFile(file: File): Promise<ParsedArtifact> {
  const dotIdx = file.name.lastIndexOf(".");
  const fileType = dotIdx >= 0 ? file.name.slice(dotIdx).toLowerCase() : "";

  if (file.size > MAX_FILE_SIZE) {
    return { text: null, fileType };
  }

  const textExtensions = [".txt", ".md", ".json", ".eml"];

  if (textExtensions.includes(fileType)) {
    const raw = await file.text();
    const text = raw.length > MAX_TEXT_LENGTH ? raw.slice(0, MAX_TEXT_LENGTH) : raw;
    return { text, fileType };
  }

  // Unsupported extension — metadata-only
  return { text: null, fileType };
}

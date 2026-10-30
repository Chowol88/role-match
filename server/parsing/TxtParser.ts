// server/parsing/TxtParser.ts
//
// Plain-text (.txt) parsing. The uploaded file is held as an in-memory buffer
// (multer memoryStorage) and is decoded as UTF-8. A file that decodes to only
// whitespace (or nothing) is treated as unreadable and rejected with the typed
// FILE_UNREADABLE error so the UI can ask the user to try another file.
//
// Design reference: "File Parsing" -> ".txt — read the in-memory buffer as
// UTF-8. Reject if it decodes to only whitespace (empty)."
// _Requirements: 4.4, 4.8_

import type { AppError } from "../../shared/types";

/**
 * Build the typed FILE_UNREADABLE error shape. Shared by all parsers so the
 * error-mapping middleware and UI see a consistent message + resolution.
 */
export function fileUnreadableError(): AppError {
  return {
    code: "FILE_UNREADABLE",
    message: "The file could not be read as text.",
    resolution:
      "The file may be empty, corrupted, or not a supported document. Please try another file.",
  };
}

/**
 * Decode an in-memory buffer as UTF-8 plain text.
 *
 * @param buffer the uploaded file bytes (memory only, never written to disk)
 * @returns the decoded text
 * @throws {AppError} with code FILE_UNREADABLE when the content is empty or
 *   contains only whitespace
 */
export function parseTxt(buffer: Buffer): string {
  const text = buffer.toString("utf-8");
  if (text.trim().length === 0) {
    throw fileUnreadableError();
  }
  return text;
}

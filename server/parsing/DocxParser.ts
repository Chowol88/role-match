// server/parsing/DocxParser.ts
//
// Word (.docx) text extraction for ANALYSIS. We use mammoth.extractRawText to
// pull the plain text out of the document. Parsing is defensive (R15.6): a
// malformed or malicious file must be rejected with a clear error rather than
// causing unsafe behaviour, so every mammoth call is wrapped in try/catch and
// any thrown error — or an empty/whitespace-only result — maps to the typed
// FILE_UNREADABLE error.
//
// NB: for the generated OUTPUT document a later task uses the structured `docx`
// model so headings/paragraphs/runs are preserved; that is out of scope here.
//
// Design reference: "File Parsing" and R15.6 (defensive parsing).
// _Requirements: 4.4, 4.8, 15.6_

import mammoth from "mammoth";
import { fileUnreadableError } from "./TxtParser";

/**
 * Extract raw analysis text from a .docx buffer.
 *
 * @param buffer the uploaded .docx bytes (memory only)
 * @returns the extracted plain text
 * @throws {AppError} FILE_UNREADABLE when extraction throws or yields no usable
 *   (non-whitespace) text
 */
export async function parseDocxText(buffer: Buffer): Promise<string> {
  let text: string;
  try {
    const result = await mammoth.extractRawText({ buffer });
    text = result.value ?? "";
  } catch {
    // Defensive: a malformed/malicious .docx must not crash the server.
    throw fileUnreadableError();
  }

  if (text.trim().length === 0) {
    throw fileUnreadableError();
  }
  return text;
}

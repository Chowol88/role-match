// server/parsing/index.ts
// Format-dispatching entry point for file parsing (.docx / .txt only).
import { parseTxt } from "./TxtParser";
import { parseDocxText } from "./DocxParser";

export const MAX_TEXT_CHARS = 200_000;

export async function parseDocument(
  buffer: Buffer,
  format: "docx" | "txt"
): Promise<string> {
  let text: string;
  switch (format) {
    case "txt":
      text = parseTxt(buffer);
      break;
    case "docx":
      text = await parseDocxText(buffer);
      break;
  }
  return text.length > MAX_TEXT_CHARS ? text.slice(0, MAX_TEXT_CHARS) : text;
}

export { parseTxt } from "./TxtParser";
export { parseDocxText } from "./DocxParser";
export { fileUnreadableError } from "./TxtParser";

// server/parsing/parsers.test.ts
//
// Unit tests for the format parsers (task 3.2). Covers:
//  - .txt UTF-8 happy path + empty/whitespace -> FILE_UNREADABLE
//  - .docx via mammoth (real in-memory .docx built with the `docx` library)
//    + empty document / mocked-empty -> FILE_UNREADABLE
//    happy-path assertion, plus a STRICT error-path assertion
//  - parseDocument dispatch per format + 200000-char truncation
//  - corrupt/non-text buffers for docx/pdf -> FILE_UNREADABLE
//
// _Requirements: 4.4, 4.5, 4.8, 15.6_

import { describe, it, expect, vi } from "vitest";
import { Document, Packer, Paragraph, TextRun } from "docx";

import { parseTxt } from "./TxtParser";
import { parseDocxText } from "./DocxParser";
import { parseDocument, MAX_TEXT_CHARS } from "./index";
import type { AppError } from "../../shared/types";

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

/** Assert that a thrown value is the FILE_UNREADABLE AppError shape. */
function expectFileUnreadable(err: unknown): void {
  const e = err as AppError;
  expect(e).toBeTruthy();
  expect(e.code).toBe("FILE_UNREADABLE");
  expect(typeof e.message).toBe("string");
  expect(e.message.length).toBeGreaterThan(0);
  expect(typeof e.resolution).toBe("string");
  expect(e.resolution.length).toBeGreaterThan(0);
}

/** Build a tiny valid .docx buffer containing a single paragraph of text. */
async function buildDocx(text: string): Promise<Buffer> {
  const doc = new Document({
    sections: [
      {
        children: [new Paragraph({ children: [new TextRun(text)] })],
      },
    ],
  });
  return Packer.toBuffer(doc);
}

/** Build an empty .docx buffer (no paragraphs with text). */
async function buildEmptyDocx(): Promise<Buffer> {
  const doc = new Document({ sections: [{ children: [] }] });
  return Packer.toBuffer(doc);
}

// --------------------------------------------------------------------------
// .txt
// --------------------------------------------------------------------------

describe("parseTxt", () => {
  it("decodes a UTF-8 buffer to its text (happy path)", () => {
    const content = "Hello world — café résumé 日本語";
    expect(parseTxt(Buffer.from(content, "utf-8"))).toBe(content);
  });

  it("throws FILE_UNREADABLE for an empty buffer", () => {
    try {
      parseTxt(Buffer.from("", "utf-8"));
      expect.unreachable("should have thrown");
    } catch (err) {
      expectFileUnreadable(err);
    }
  });

  it("throws FILE_UNREADABLE for a whitespace-only buffer", () => {
    try {
      parseTxt(Buffer.from("   \n\t  \r\n ", "utf-8"));
      expect.unreachable("should have thrown");
    } catch (err) {
      expectFileUnreadable(err);
    }
  });
});

// --------------------------------------------------------------------------
// .docx
// --------------------------------------------------------------------------

describe("parseDocxText", () => {
  it("extracts text from a valid in-memory .docx (happy path)", async () => {
    const known = "Senior Platform Engineer with Kubernetes experience";
    const buffer = await buildDocx(known);
    const text = await parseDocxText(buffer);
    expect(text).toContain(known);
  });

  it("throws FILE_UNREADABLE for a .docx with no text", async () => {
    const buffer = await buildEmptyDocx();
    await expect(parseDocxText(buffer)).rejects.toMatchObject({
      code: "FILE_UNREADABLE",
    });
  });

  it("throws FILE_UNREADABLE when mammoth returns empty (mocked)", async () => {
    const mammoth = (await import("mammoth")).default;
    const spy = vi
      .spyOn(mammoth, "extractRawText")
      .mockResolvedValueOnce({ value: "", messages: [] } as never);
    try {
      await expect(
        parseDocxText(Buffer.from("anything"))
      ).rejects.toMatchObject({ code: "FILE_UNREADABLE" });
    } finally {
      spy.mockRestore();
    }
  });

  it("throws FILE_UNREADABLE for a corrupt/non-docx buffer (defensive)", async () => {
    const corrupt = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe, 0x50, 0x4b]);
    await expect(parseDocxText(corrupt)).rejects.toMatchObject({
      code: "FILE_UNREADABLE",
    });
  });
});

// --------------------------------------------------------------------------
// parseDocument dispatch + truncation
// --------------------------------------------------------------------------

describe("parseDocument", () => {
  it("dispatches .txt to the txt parser", async () => {
    const content = "Plain text CV content for dispatch";
    const text = await parseDocument(Buffer.from(content, "utf-8"), "txt");
    expect(text).toBe(content);
  });

  it("dispatches .docx to the docx parser", async () => {
    const known = "Dispatch to mammoth docx parser";
    const buffer = await buildDocx(known);
    const text = await parseDocument(buffer, "docx");
    expect(text).toContain(known);
  });


  it("truncates extracted text to MAX_TEXT_CHARS", async () => {
    const huge = "a".repeat(MAX_TEXT_CHARS + 5000);
    const text = await parseDocument(Buffer.from(huge, "utf-8"), "txt");
    expect(text.length).toBe(MAX_TEXT_CHARS);
  });

  it("does not truncate text at or below the cap", async () => {
    const exact = "b".repeat(MAX_TEXT_CHARS);
    const text = await parseDocument(Buffer.from(exact, "utf-8"), "txt");
    expect(text.length).toBe(MAX_TEXT_CHARS);
  });

  it("propagates FILE_UNREADABLE from the underlying parser", async () => {
    await expect(
      parseDocument(Buffer.from("   ", "utf-8"), "txt")
    ).rejects.toMatchObject({ code: "FILE_UNREADABLE" });
  });
});

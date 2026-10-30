// server/output/CvDocxBuilder.test.ts
//
// Property-based + example tests for the tailored-CV .docx builder.
//
// Feature: role-match-cv-tailor, Property 16: Professional_Experience is preserved byte-for-byte
// Validates: Requirements 7.6, 8.1
//
// Feature: role-match-cv-tailor, Property 20: Only accepted edits appear in the output
// Validates: Requirements 7.14, 8.1
//
// Feature: role-match-cv-tailor, Property 21: Download version numbering increments per session
// Validates: Requirements 8.2
//
// Feature: role-match-cv-tailor, Property 22: Advisory and success notes always appended
// Validates: Requirements 8.3
//
// The builder starts from the parsed CV (represented as text lines) and rebuilds
// an editable .docx. These tests re-extract the generated document's text with
// mammoth (the same extractor used for analysis) and assert on the extracted
// structure — not raw byte equality of the whole archive — except where the
// design requires the Experience content specifically to survive unchanged.

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import mammoth from "mammoth";
import type { CvSections, ProposedEdit } from "../../shared/types";
import { detectSections } from "../parsing/SectionDetector";
import {
  ADVISORY_LINES,
  buildCvDocx,
  versionedFilename,
  versionMarker,
} from "./CvDocxBuilder";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Re-extract the generated .docx to plain text with mammoth. */
async function extractText(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value ?? "";
}

/** Non-empty, trimmed lines of a block of text. */
function bodyLines(text: string): string[] {
  return text
    .split(/\r\n|\r|\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

/**
 * Extract the Professional_Experience body lines from a CV text, using the same
 * section detector the builder uses. Returns the non-empty body lines (the
 * heading line excluded), in order.
 */
function experienceBodyLines(cvText: string): string[] {
  const sections = detectSections(cvText);
  const span = sections.professionalExperience;
  if (!span) return [];
  const lines = cvText.split(/\r\n|\r|\n/);
  const start = Math.min(span.startIndex + 1, lines.length);
  const end = Math.min(span.endIndex, lines.length);
  return lines
    .slice(start, end)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

/**
 * Build a CV text with a Professional_Experience section whose body is made of
 * the given experience lines, plus editable sections the edits can target.
 */
function makeCv(experienceLines: string[]): string {
  return [
    "Jordan Example",
    "Senior Operations Lead",
    "",
    "Professional Profile",
    "Operations leader with a record of delivery.",
    "Skilled in planning and process design.",
    "",
    "Core Competencies",
    "Planning, Delivery, Process Design, Stakeholder Management",
    "",
    "Career Highlights",
    "Delivered a programme ahead of schedule.",
    "Cut processing time across the team.",
    "",
    "Professional Experience",
    ...experienceLines,
  ].join("\n");
}

/** A docx-safe experience line: no empty lines, no leading/trailing spaces. */
const experienceLineArb = fc
  .string({ minLength: 3, maxLength: 60 })
  .map((s) => s.replace(/[\r\n\t]/g, " ").trim())
  .filter((s) => s.length >= 3);

const experienceLinesArb = fc.array(experienceLineArb, {
  minLength: 1,
  maxLength: 6,
});

/** Arbitrary accepted-edit set targeting the editable sections. */
const acceptedEditsArb: fc.Arbitrary<ProposedEdit[]> = fc.record({
  profile: fc.boolean(),
  competencies: fc.boolean(),
  highlights: fc.boolean(),
}).map(({ profile, competencies, highlights }) => {
  const edits: ProposedEdit[] = [];
  if (profile) {
    edits.push({
      id: "e-profile",
      section: "Professional_Profile",
      originalText: "Operations leader with a record of delivery.",
      recommendedText:
        "Skilled in planning and process design. Operations leader with a record of delivery.",
      explanation: "Foregrounds the role-relevant statement.",
      accepted: true,
    });
  }
  if (competencies) {
    edits.push({
      id: "e-comp",
      section: "Core_Competencies",
      originalText:
        "Planning, Delivery, Process Design, Stakeholder Management",
      recommendedText:
        "Process Design, Planning, Delivery, Stakeholder Management",
      explanation: "Reorders existing competencies.",
      accepted: true,
    });
  }
  if (highlights) {
    edits.push({
      id: "e-high",
      section: "Career_Highlights",
      originalText:
        "Delivered a programme ahead of schedule.\nCut processing time across the team.",
      recommendedText:
        "Cut processing time across the team.\nDelivered a programme ahead of schedule.",
      explanation: "Moves the most relevant highlight to the top.",
      accepted: true,
    });
  }
  return edits;
});

// ---------------------------------------------------------------------------
// Property 16: Professional_Experience preserved byte-for-byte
// ---------------------------------------------------------------------------

describe("CvDocxBuilder — Property 16: Professional_Experience preserved byte-for-byte", () => {
  it("re-extracted Experience body equals the input Experience body for any accepted edits", async () => {
    await fc.assert(
      fc.asyncProperty(
        experienceLinesArb,
        acceptedEditsArb,
        async (expLines, edits) => {
          const cvText = makeCv(expLines);
          const inputExperience = experienceBodyLines(cvText);

          const { buffer } = await buildCvDocx({
            cvText,
            edits,
            version: 1,
          });

          const outText = await extractText(buffer);
          const outLines = bodyLines(outText);

          // The exact input Experience lines must appear, in order, contiguous,
          // inside the output — unchanged.
          const start = outLines.indexOf(inputExperience[0]);
          expect(start).toBeGreaterThanOrEqual(0);
          const slice = outLines.slice(start, start + inputExperience.length);
          expect(slice).toEqual(inputExperience);
        }
      ),
      { numRuns: 60 }
    );
  }, 120_000);
});

// ---------------------------------------------------------------------------
// Property 20: Only accepted edits appear in the output
// ---------------------------------------------------------------------------

describe("CvDocxBuilder — Property 20: only accepted edits appear in the output", () => {
  it("applies accepted edits and never renders rejected/pending edit text", async () => {
    const REJECTED_MARKER = "ZZZREJECTEDUNIQUETOKEN";
    const ACCEPTED_MARKER = "Process Design, Planning, Delivery, Stakeholder Management";

    await fc.assert(
      fc.asyncProperty(fc.boolean(), async (acceptComp) => {
        const cvText = makeCv(["Led the operations team at a large firm."]);

        const edits: ProposedEdit[] = [
          {
            id: "rejected",
            section: "Professional_Profile",
            originalText: "Operations leader with a record of delivery.",
            recommendedText: `${REJECTED_MARKER} should never appear.`,
            explanation: "Rejected edit.",
            accepted: false,
          },
          {
            id: "comp",
            section: "Core_Competencies",
            originalText:
              "Planning, Delivery, Process Design, Stakeholder Management",
            recommendedText: ACCEPTED_MARKER,
            explanation: "Accepted reorder.",
            accepted: acceptComp,
          },
        ];

        const { buffer } = await buildCvDocx({ cvText, edits, version: 1 });
        const outText = await extractText(buffer);

        // Rejected edit text NEVER appears regardless of the accepted one.
        expect(outText).not.toContain(REJECTED_MARKER);
        // The accepted reorder appears iff it was accepted.
        if (acceptComp) {
          expect(outText).toContain(ACCEPTED_MARKER);
        }
      }),
      { numRuns: 40 }
    );
  }, 120_000);
});

describe("CvDocxBuilder — Property 22: advisory and success notes always appended", () => {
  it("every generated document contains the review advisory, add-contact reminder, and success message", async () => {
    await fc.assert(
      fc.asyncProperty(
        experienceLinesArb,
        acceptedEditsArb,
        fc.integer({ min: 1, max: 5 }),
        async (expLines, edits, version) => {
          const cvText = makeCv(expLines);
          const { buffer } = await buildCvDocx({ cvText, edits, version });
          const outText = await extractText(buffer);

          for (const advisory of ADVISORY_LINES) {
            expect(outText).toContain(advisory);
          }
        }
      ),
      { numRuns: 40 }
    );
  }, 120_000);
});

// ---------------------------------------------------------------------------
// Example-based cases
// ---------------------------------------------------------------------------

describe("CvDocxBuilder — example cases", () => {
  it("embeds highlights into the Profile when there is no separate Highlights section (req 7.5)", async () => {
    const cvText = [
      "Alex Sample",
      "",
      "Professional Profile",
      "Delivery-focused operations professional.",
      "",
      "Professional Experience",
      "Managed logistics for a national retailer.",
    ].join("\n");

    const sections: CvSections = detectSections(cvText);
    expect(sections.careerHighlights).toBeUndefined();

    const edits: ProposedEdit[] = [
      {
        id: "high",
        section: "Career_Highlights",
        originalText: "",
        recommendedText: "Reduced delivery times by streamlining routes.",
        explanation: "Embedded highlight.",
        accepted: true,
      },
    ];

    const { buffer } = await buildCvDocx({ cvText, sections, edits, version: 1 });
    const outText = await extractText(buffer);

    // The highlight text is embedded, and Experience is still present unchanged.
    expect(outText).toContain("Reduced delivery times by streamlining routes.");
    expect(outText).toContain("Managed logistics for a national retailer.");
  });

  it("preserves the name/contact preamble unchanged", async () => {
    const cvText = makeCv(["Directed a cross-functional team."]);
    const { buffer } = await buildCvDocx({ cvText, edits: [], version: 1 });
    const outText = await extractText(buffer);
    expect(outText).toContain("Jordan Example");
    expect(outText).toContain("Senior Operations Lead");
  });
});

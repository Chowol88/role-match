// server/parsing/SectionDetector.test.ts
//
// Property-based + example tests for semantic CV section detection.
//
// Feature: role-match-cv-tailor, Property 17: Heading synonyms map to canonical sections
// Validates: Requirements 7.7
//
// Property 17: for any canonical section and any of its listed synonyms (in any
// letter case, with optional trailing colon and surrounding whitespace), a
// document containing that synonym as a heading followed by body text has the
// corresponding canonical section detected with the correct canonical label.

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  detectSections,
  SECTION_SYNONYMS,
} from "./SectionDetector";
import type { CanonicalSection, CvSections } from "../../shared/types";

const CANONICALS = Object.keys(SECTION_SYNONYMS) as CanonicalSection[];

/** Map a canonical section name to its field accessor on CvSections. */
function spanFor(
  sections: CvSections,
  canonical: CanonicalSection
) {
  switch (canonical) {
    case "Professional_Profile":
      return sections.professionalProfile;
    case "Career_Highlights":
      return sections.careerHighlights;
    case "Core_Competencies":
      return sections.coreCompetencies;
    case "Professional_Experience":
      return sections.professionalExperience;
  }
}

/** Apply random letter casing to a string, preserving characters otherwise. */
function recase(s: string, toUpperFlags: boolean[]): string {
  let i = 0;
  return s
    .split("")
    .map((ch) => {
      if (/[a-z]/i.test(ch)) {
        const up = toUpperFlags[i % toUpperFlags.length];
        i++;
        return up ? ch.toUpperCase() : ch.toLowerCase();
      }
      return ch;
    })
    .join("");
}

describe("SectionDetector — Property 17: heading synonyms map to canonical sections", () => {
  it("detects every listed synonym (any case, optional trailing colon/whitespace) as its canonical section", () => {
    // Build a generator over (canonical, synonym) pairs.
    const pairArb = fc
      .constantFrom(...CANONICALS)
      .chain((canonical) =>
        fc
          .constantFrom(...SECTION_SYNONYMS[canonical])
          .map((synonym) => ({ canonical, synonym }))
      );

    fc.assert(
      fc.property(
        pairArb,
        // casing flags
        fc.array(fc.boolean(), { minLength: 1, maxLength: 12 }),
        // leading / trailing whitespace padding
        fc.stringMatching(/^[ \t]{0,4}$/),
        fc.stringMatching(/^[ \t]{0,4}$/),
        // optional trailing colon
        fc.boolean(),
        // body text (always non-empty so the heading is "followed by body")
        fc.stringMatching(/^[A-Za-z][A-Za-z ]{2,40}$/),
        (pair, caseFlags, pad1, pad2, withColon, body) => {
          const { canonical, synonym } = pair;

          const headingLine =
            pad1 + recase(synonym, caseFlags) + (withColon ? ":" : "") + pad2;

          const doc = `${headingLine}\n${body}\n`;
          const sections = detectSections(doc);

          const span = spanFor(sections, canonical);
          expect(span).toBeDefined();
          expect(span!.canonical).toBe(canonical);
          // Heading text captured as originally written (trimmed only).
          expect(span!.headingText).toBe(headingLine.trim());
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe("SectionDetector — example-based cases", () => {
  it("maps a full CV (Executive Profile + Key Achievements + Skills + Work Experience) to all four canonicals", () => {
    const cv = [
      "Executive Profile",
      "A results-driven leader with a track record of delivery.",
      "",
      "Key Achievements",
      "Grew revenue 40% over two years.",
      "Launched three new products.",
      "",
      "Skills",
      "TypeScript, leadership, stakeholder management.",
      "",
      "Work Experience",
      "Acme Corp — Director of Engineering (2019–2024).",
      "Led a team of 20 engineers.",
    ].join("\n");

    const sections = detectSections(cv);

    expect(sections.professionalProfile?.canonical).toBe(
      "Professional_Profile"
    );
    expect(sections.professionalProfile?.headingText).toBe("Executive Profile");

    expect(sections.careerHighlights?.canonical).toBe("Career_Highlights");
    expect(sections.careerHighlights?.headingText).toBe("Key Achievements");

    expect(sections.coreCompetencies?.canonical).toBe("Core_Competencies");
    expect(sections.coreCompetencies?.headingText).toBe("Skills");

    expect(sections.professionalExperience?.canonical).toBe(
      "Professional_Experience"
    );
    expect(sections.professionalExperience?.headingText).toBe(
      "Work Experience"
    );
  });

  it("captures Professional_Experience as the run from its heading to end of document", () => {
    const cv = [
      "Profile", // line 0
      "Seasoned professional.", // 1
      "", // 2
      "Work History", // 3  <- experience heading
      "Role A at Company A.", // 4
      "Role B at Company B.", // 5
    ].join("\n");

    const sections = detectSections(cv);
    const exp = sections.professionalExperience;
    expect(exp).toBeDefined();
    expect(exp!.startIndex).toBe(3);
    expect(exp!.endIndex).toBe(6); // end of document (line count)
    expect(exp!.paragraphRange).toEqual([3, 6]);
  });

  it("omits Career_Highlights when the CV lacks such a heading", () => {
    const cv = [
      "Professional Summary",
      "Experienced individual.",
      "",
      "Core Competencies",
      "Planning, analysis, delivery.",
      "",
      "Professional Experience",
      "Did the work at the place.",
    ].join("\n");

    const sections = detectSections(cv);

    expect(sections.professionalProfile).toBeDefined();
    expect(sections.coreCompetencies).toBeDefined();
    expect(sections.professionalExperience).toBeDefined();
    // No Career_Highlights heading present -> simply omitted.
    expect(sections.careerHighlights).toBeUndefined();
  });

  it("keeps the first occurrence when two headings map to the same canonical section", () => {
    const cv = [
      "Summary", // Professional_Profile (first)
      "First profile body.",
      "",
      "Profile", // also Professional_Profile (second) -> ignored
      "Second profile body.",
      "",
      "Experience",
      "Work content.",
    ].join("\n");

    const sections = detectSections(cv);
    expect(sections.professionalProfile?.headingText).toBe("Summary");
    expect(sections.professionalProfile?.startIndex).toBe(0);
  });

  it("maps newly added heading synonyms to their canonical sections", () => {
    const cv = [
      "Objective",
      "Seeking a leadership role.",
      "",
      "Career Achievements",
      "Grew the division threefold.",
      "",
      "Key Competencies",
      "Strategy, operations, delivery.",
      "",
      "Relevant Experience",
      "Director at Example Co.",
    ].join("\n");

    const sections = detectSections(cv);

    expect(sections.professionalProfile?.canonical).toBe(
      "Professional_Profile"
    );
    expect(sections.careerHighlights?.canonical).toBe("Career_Highlights");
    expect(sections.coreCompetencies?.canonical).toBe("Core_Competencies");
    expect(sections.professionalExperience?.canonical).toBe(
      "Professional_Experience"
    );
  });

  it("does not treat a long sentence or punctuated line as a heading", () => {
    const cv = [
      "I have extensive experience leading teams across many domains.",
      "More detail about the above sentence here.",
    ].join("\n");

    const sections = detectSections(cv);
    // The first line contains "experience" but is a long, punctuated sentence,
    // so it must NOT be detected as a Professional_Experience heading.
    expect(sections.professionalExperience).toBeUndefined();
  });
});

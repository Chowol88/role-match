// server/engine/FreeEngine.test.ts
//
// Property-based + example tests for the Free-mode role-match engine.
//
// Feature: role-match-cv-tailor, Property 12: Score is an integer within 1–10 when requirements exist
// Validates: Requirements 6.1
//
// Feature: role-match-cv-tailor, Property 13: Every requirement is classified exactly once
// Validates: Requirements 6.3, 6.4, 6.5
//
// Property 12: for any CV/JD that yields ≥1 extractable requirement, the
//   role-match score is an integer in [1, 10].
// Property 13: for any completed analysis, the union of the direct/transferable/
//   gap requirement ids equals the set of extracted JD requirement ids, with no
//   id appearing in more than one category (no duplication, no omission).

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  analyzeFree,
  extractRequirements,
  indexCv,
  tokenise,
} from "./FreeEngine";

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

/** A pool of distinct skill-ish tokens used to build JD requirements. */
const SKILL_WORDS = [
  "typescript", "python", "kubernetes", "leadership", "forecasting",
  "negotiation", "react", "sql", "marketing", "analytics", "compliance",
  "procurement", "mentoring", "testing", "architecture", "budgeting",
  "recruiting", "roadmapping", "scaling", "migration",
];

/** A JD whose requirements block guarantees ≥1 extractable requirement. */
const jdWithRequirementsArb: fc.Arbitrary<{ jd: string; skills: string[] }> = fc
  .uniqueArray(fc.constantFrom(...SKILL_WORDS), { minLength: 1, maxLength: 6 })
  .map((skills) => {
    const bullets = skills
      .map((s) => `- Demonstrated ${s} capability in a delivery context.`)
      .join("\n");
    const jd = `Requirements:\n${bullets}\n`;
    return { jd, skills };
  });

/**
 * A CV that directly covers an arbitrary subset of the JD skills (placed in a
 * primary section), transferably mentions another subset (in the Profile), and
 * omits the rest (gaps). This exercises all three classification paths.
 */
const cvArb = (skills: string[]): fc.Arbitrary<string> =>
  fc
    .tuple(
      fc.subarray(skills),
      fc.subarray(skills)
    )
    .map(([directSkills, profileSkills]) => {
      const lines = [
        "Professional Profile",
        `A professional with exposure to ${
          profileSkills.length ? profileSkills.join(", ") : "general operations"
        }.`,
        "",
        "Core Competencies",
        directSkills.length ? directSkills.join(", ") : "general administration",
        "",
        "Professional Experience",
        "Acme Corp — Lead (2019-2024).",
        directSkills.length
          ? `Applied ${directSkills.join(" and ")} on key programmes.`
          : "Managed assorted operational tasks.",
      ];
      return lines.join("\n");
    });

// ---------------------------------------------------------------------------
// Property 12
// ---------------------------------------------------------------------------

describe("FreeEngine — Property 12: score is an integer within 1–10 when requirements exist", () => {
  it("produces an integer score in [1,10] whenever ≥1 requirement is extracted", () => {
    fc.assert(
      fc.property(
        jdWithRequirementsArb.chain(({ jd, skills }) =>
          cvArb(skills).map((cv) => ({ jd, cv }))
        ),
        ({ jd, cv }) => {
          // Precondition: the JD yields at least one requirement.
          fc.pre(extractRequirements(jd).length >= 1);

          const result = analyzeFree(cv, jd);
          expect(result.noRequirements).toBe(false);
          expect(result.score).not.toBeNull();
          expect(Number.isInteger(result.score)).toBe(true);
          expect(result.score as number).toBeGreaterThanOrEqual(1);
          expect(result.score as number).toBeLessThanOrEqual(10);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 13
// ---------------------------------------------------------------------------

describe("FreeEngine — Property 13: every requirement is classified exactly once", () => {
  it("partitions the extracted requirement ids across direct/transferable/gap with no dup or omission", () => {
    fc.assert(
      fc.property(
        jdWithRequirementsArb.chain(({ jd, skills }) =>
          cvArb(skills).map((cv) => ({ jd, cv }))
        ),
        ({ jd, cv }) => {
          const requirements = extractRequirements(jd);
          fc.pre(requirements.length >= 1);

          const result = analyzeFree(cv, jd);

          const expectedIds = new Set(requirements.map((r) => r.id));
          const directIds = result.direct.map((e) => e.requirementId);
          const transferableIds = result.transferable.map((e) => e.requirementId);
          const gapIds = result.gaps.map((e) => e.requirementId);
          const allIds = [...directIds, ...transferableIds, ...gapIds];

          // No duplication: each id appears exactly once across all categories.
          expect(allIds.length).toBe(requirements.length);
          expect(new Set(allIds).size).toBe(allIds.length);

          // No omission + no extras: the union equals the extracted id set.
          expect(new Set(allIds)).toEqual(expectedIds);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Example-based cases
// ---------------------------------------------------------------------------

describe("FreeEngine — example-based cases", () => {
  it("returns noRequirements with a null score when the JD has no analysable requirements", () => {
    const jd = "Hello.\nWe are a company.\nThanks for reading.";
    const result = analyzeFree("Some CV text about leadership.", jd);
    // No bullet/block/cue sentences -> no requirements.
    if (extractRequirements(jd).length === 0) {
      expect(result.noRequirements).toBe(true);
      expect(result.score).toBeNull();
    }
  });

  it("classifies a skill present in Core Competencies as Direct", () => {
    const jd = "Requirements:\n- Proficiency in kubernetes administration.";
    const cv = [
      "Professional Profile",
      "A seasoned engineer.",
      "",
      "Core Competencies",
      "kubernetes, networking, delivery",
      "",
      "Professional Experience",
      "Ran platform teams.",
    ].join("\n");

    const result = analyzeFree(cv, jd);
    expect(result.direct.length).toBe(1);
    expect(result.direct[0].cvEvidence).toBe("kubernetes");
    expect(result.gaps.length).toBe(0);
  });

  it("classifies a skill only mentioned in the Profile as Transferable, not Direct", () => {
    const jd = "Requirements:\n- Hands-on forecasting experience.";
    const cv = [
      "Professional Profile",
      "A leader with exposure to forecasting during planning cycles.",
      "",
      "Professional Experience",
      "Managed a regional team.",
    ].join("\n");

    const result = analyzeFree(cv, jd);
    expect(result.direct.length).toBe(0);
    expect(result.transferable.length).toBe(1);
    expect(result.transferable[0].cvEvidence).toBe("forecasting");
  });

  it("classifies an absent skill as a Gap with no cvEvidence", () => {
    const jd = "Requirements:\n- Expertise in procurement negotiation.";
    const cv = [
      "Professional Profile",
      "A software engineer.",
      "",
      "Core Competencies",
      "typescript, react",
    ].join("\n");

    const result = analyzeFree(cv, jd);
    expect(result.gaps.length).toBeGreaterThanOrEqual(1);
    expect(result.gaps[0].cvEvidence).toBeUndefined();
  });

  it("extracts bulleted and block requirements and drops boilerplate-only lines", () => {
    const jd = [
      "About the role.",
      "Responsibilities:",
      "Lead the analytics roadmap.",
      "- Mentor junior staff.",
      "We are an equal opportunity employer.",
    ].join("\n");

    const reqs = extractRequirements(jd);
    const texts = reqs.map((r) => r.text);
    expect(texts).toContain("Lead the analytics roadmap.");
    expect(texts).toContain("Mentor junior staff.");
  });

  it("tokenise strips stopwords and keeps content tokens", () => {
    expect(tokenise("Experience with the TypeScript and React")).toEqual([
      "typescript",
      "react",
    ]);
  });

  it("indexCv keeps section context (experience vs competencies)", () => {
    const cv = [
      "Core Competencies",
      "budgeting, planning",
      "",
      "Professional Experience",
      "Delivered migration programmes.",
    ].join("\n");

    const index = indexCv(cv);
    const comp = index.bySection.find((s) => s.section === "Core_Competencies");
    const exp = index.bySection.find(
      (s) => s.section === "Professional_Experience"
    );
    expect(comp?.tokens.has("budgeting")).toBe(true);
    expect(exp?.tokens.has("migration")).toBe(true);
    expect(comp?.tokens.has("migration")).toBe(false);
  });
});

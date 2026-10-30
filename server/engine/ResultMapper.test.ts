// server/engine/ResultMapper.test.ts
//
// Property-based + example tests for the shared ResultMapper.
//
// Feature: role-match-cv-tailor, Property 2: Output mode label matches producing engine
// Validates: Requirements 2.11, 6.8, 9.2
//
// Property 2: for any raw engine output mapped via toMatchResult with a given
// engine mode, the resulting MatchResult.mode equals that mode. A result mapped
// by the Free engine is never labelled "ai" and vice versa. The mapper also
// guarantees the three evidence arrays are always present and the
// score/noRequirements pair stays consistent (null score iff no requirements,
// otherwise an integer clamped to 1–10).

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  MAX_SCORE,
  MIN_SCORE,
  toMatchResult,
  toProposedEdits,
  type RawResult,
} from "./ResultMapper";
import type {
  AnalysisMode,
  CanonicalSection,
  EvidenceItem,
  EvidenceType,
} from "../../shared/types";

const MODES: AnalysisMode[] = ["free", "ai"];

/** Arbitrary EvidenceItem of a given evidence type. */
const evidenceArb = (type: EvidenceType): fc.Arbitrary<EvidenceItem> =>
  fc.record({
    type: fc.constant(type),
    requirementId: fc.string({ minLength: 1, maxLength: 8 }),
    requirementText: fc.string({ maxLength: 40 }),
  });

/** Arbitrary raw engine result (score path or noRequirements path). */
const rawResultArb: fc.Arbitrary<RawResult> = fc.oneof(
  // Scored path: arbitrary real score (incl. out-of-range and non-integer).
  fc.record({
    direct: fc.array(evidenceArb("direct"), { maxLength: 5 }),
    transferable: fc.array(evidenceArb("transferable"), { maxLength: 5 }),
    gaps: fc.array(evidenceArb("gap"), { maxLength: 5 }),
    score: fc.double({ min: -50, max: 50, noNaN: true }),
    noRequirements: fc.constant(false),
  }),
  // No-requirements path.
  fc.record({
    direct: fc.constant([] as EvidenceItem[]),
    transferable: fc.constant([] as EvidenceItem[]),
    gaps: fc.constant([] as EvidenceItem[]),
    noRequirements: fc.constant(true),
  })
);

describe("ResultMapper — Property 2: output mode label matches producing engine", () => {
  it("stamps the producing engine's mode onto every mapped result", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...MODES),
        rawResultArb,
        (mode, raw) => {
          const result = toMatchResult(mode, raw);
          // The output mode ALWAYS equals the producing engine's mode.
          expect(result.mode).toBe(mode);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("never mislabels a Free result as AI, nor an AI result as Free", () => {
    fc.assert(
      fc.property(fc.constantFrom(...MODES), rawResultArb, (mode, raw) => {
        const result = toMatchResult(mode, raw);
        const other: AnalysisMode = mode === "free" ? "ai" : "free";
        expect(result.mode).not.toBe(other);
      }),
      { numRuns: 100 }
    );
  });

  it("always emits the three evidence arrays and a consistent score/noRequirements pair", () => {
    fc.assert(
      fc.property(fc.constantFrom(...MODES), rawResultArb, (mode, raw) => {
        const result = toMatchResult(mode, raw);

        expect(Array.isArray(result.direct)).toBe(true);
        expect(Array.isArray(result.transferable)).toBe(true);
        expect(Array.isArray(result.gaps)).toBe(true);

        if (result.noRequirements) {
          expect(result.score).toBeNull();
        } else {
          expect(result.score).not.toBeNull();
          expect(Number.isInteger(result.score)).toBe(true);
          expect(result.score as number).toBeGreaterThanOrEqual(MIN_SCORE);
          expect(result.score as number).toBeLessThanOrEqual(MAX_SCORE);
        }
      }),
      { numRuns: 100 }
    );
  });
});

describe("ResultMapper — example-based cases", () => {
  it("defaults missing evidence arrays to empty and clamps a high score to 10", () => {
    const result = toMatchResult("free", { score: 42, noRequirements: false });
    expect(result.direct).toEqual([]);
    expect(result.transferable).toEqual([]);
    expect(result.gaps).toEqual([]);
    expect(result.score).toBe(MAX_SCORE);
  });

  it("forces a null score when noRequirements is true even if a score is supplied", () => {
    const result = toMatchResult("ai", { score: 7, noRequirements: true });
    expect(result.noRequirements).toBe(true);
    expect(result.score).toBeNull();
  });

  it("rounds a fractional score to the nearest integer", () => {
    expect(toMatchResult("free", { score: 6.4 }).score).toBe(6);
    expect(toMatchResult("free", { score: 6.6 }).score).toBe(7);
  });

  it("normalises proposed edits to the canonical shape with accepted=false by default", () => {
    const section: CanonicalSection = "Professional_Profile";
    const edits = toProposedEdits([
      { id: "e1", section },
      {
        id: "e2",
        section,
        originalText: "a",
        recommendedText: "b",
        explanation: "why",
        accepted: true,
      },
    ]);
    expect(edits[0]).toEqual({
      id: "e1",
      section,
      originalText: "",
      recommendedText: "",
      explanation: "",
      accepted: false,
    });
    expect(edits[1].accepted).toBe(true);
  });
});

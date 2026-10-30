/**
 * Property-based tests for the in-memory SessionStore.
 *
 * Feature: role-match-cv-tailor, Property 1: Reset clears all session state
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { SessionStore } from "./SessionStore";
import type {
  AnalysisMode,
  MatchResult,
  ParsedDocument,
  ProposedEdit,
  Provider,
} from "../../shared/types";

// Arbitraries that populate a session with plausible, non-empty content.

const modeArb: fc.Arbitrary<AnalysisMode> = fc.constantFrom("free", "ai");
const providerArb: fc.Arbitrary<Provider> = fc.constantFrom("openai", "claude");

const cvDocArb: fc.Arbitrary<ParsedDocument> = fc.record({
  kind: fc.constant<"cv">("cv"),
  format: fc.constantFrom<ParsedDocument["format"]>("docx", "txt", "pdf"),
  text: fc.string({ minLength: 1 }),
});

const jdDocArb: fc.Arbitrary<ParsedDocument> = fc.record({
  kind: fc.constant<"jd">("jd"),
  format: fc.constantFrom<ParsedDocument["format"]>("docx", "txt", "pdf"),
  text: fc.string({ minLength: 1 }),
});

const resultArb: fc.Arbitrary<MatchResult> = fc.record({
  mode: modeArb,
  score: fc.integer({ min: 1, max: 10 }),
  noRequirements: fc.constant(false),
  direct: fc.constant([]),
  transferable: fc.constant([]),
  gaps: fc.constant([]),
});

const editArb: fc.Arbitrary<ProposedEdit> = fc.record({
  id: fc.uuid(),
  section: fc.constantFrom(
    "Professional_Profile",
    "Career_Highlights",
    "Core_Competencies"
  ),
  originalText: fc.string({ minLength: 1 }),
  recommendedText: fc.string({ minLength: 1 }),
  explanation: fc.string(),
  accepted: fc.boolean(),
});

describe("SessionStore — Property 1: Reset clears all session state", () => {
  it("wipes CV/JD/mode/key/results/edits and resets flags on reset", () => {
    // Validates: Requirements 1.3, 1.6, 3.5
    fc.assert(
      fc.property(
        modeArb,
        providerArb,
        fc.string({ minLength: 1 }),
        cvDocArb,
        jdDocArb,
        resultArb,
        fc.array(editArb, { minLength: 1, maxLength: 5 }),
        fc.integer({ min: 1, max: 20 }),
        (mode, provider, rawKey, cv, jd, result, edits, downloadVersion) => {
          const store = new SessionStore();
          const { sessionId } = store.create();

          // Populate the session fully.
          store.setApiKey(sessionId, provider, rawKey);
          store.update(sessionId, {
            mode,
            cv,
            jd,
            result,
            edits,
            agreementConfirmed: true,
            downloadVersion,
          });

          // Sanity: the session really is populated before reset.
          const populated = store.get(sessionId);
          expect(populated.cv).toBeDefined();
          expect(store.getRawApiKey(sessionId)).toBe(rawKey);

          // Reset keeps the same id but clears everything.
          const fresh = store.reset(sessionId);

          expect(fresh.sessionId).toBe(sessionId);
          expect(fresh.mode).toBeNull();
          expect(fresh.cv).toBeUndefined();
          expect(fresh.jd).toBeUndefined();
          expect(fresh.apiKey).toBeUndefined();
          expect(fresh.result).toBeUndefined();
          expect(fresh.edits).toBeUndefined();
          expect(fresh.agreementConfirmed).toBe(false);
          expect(fresh.downloadVersion).toBe(0);
          expect(store.getRawApiKey(sessionId)).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });
});

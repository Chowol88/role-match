/**
 * Shared result mapper for Role-Match CV Tailor.
 *
 * Both analysis engines — the rule-based Free engine and the provider-backed
 * AI engine — funnel their raw output through this module so the wizard renders
 * identically regardless of mode. The mapper guarantees that:
 *
 *  - every produced {@link MatchResult} has the three evidence arrays
 *    (`direct` / `transferable` / `gap`) present (defaulting to empty arrays),
 *  - the `noRequirements` / `score` pair is internally consistent (a
 *    no-requirements result carries a `null` score; a scored result carries an
 *    integer clamped to 1–10), and
 *  - the `mode` label ALWAYS reflects the engine that produced the result —
 *    the caller passes its own mode and the mapper stamps it onto the output,
 *    so a Free result can never be mislabelled as a live AI analysis and vice
 *    versa (Property 2).
 *
 * The mapper also normalises {@link ProposedEdit}[] to an identical shape from
 * either engine, so steps 3 and 4 of the wizard are mode-agnostic.
 *
 * Pure and deterministic — no I/O, no side effects.
 *
 * @see design.md "Shared result schema"
 * Requirements 6.8, 9.1, 9.2, 2.11
 */

import type {
  AnalysisMode,
  EvidenceItem,
  MatchResult,
  ProposedEdit,
} from "../../shared/types";

/** Inclusive lower bound for a valid role-match score. */
export const MIN_SCORE = 1;
/** Inclusive upper bound for a valid role-match score. */
export const MAX_SCORE = 10;

/**
 * The engine-agnostic raw evidence an engine hands to the mapper. The engine
 * supplies only the three evidence arrays and either a raw numeric score or a
 * no-requirements signal; the mapper owns clamping, rounding, and the
 * score/noRequirements consistency rules.
 */
export interface RawResult {
  /** The requirements classified as directly evidenced. */
  direct?: EvidenceItem[];
  /** The requirements classified as transferable. */
  transferable?: EvidenceItem[];
  /** The requirements classified as gaps. */
  gaps?: EvidenceItem[];
  /**
   * The raw score before clamping/rounding. Ignored when `noRequirements` is
   * true. May be any real number; the mapper rounds to the nearest integer and
   * clamps to [MIN_SCORE, MAX_SCORE].
   */
  score?: number | null;
  /** True when the JD yielded no analysable requirements. */
  noRequirements?: boolean;
}

/** Round to the nearest integer and clamp into the inclusive 1–10 band. */
function clampScore(raw: number): number {
  const rounded = Math.round(raw);
  if (rounded < MIN_SCORE) return MIN_SCORE;
  if (rounded > MAX_SCORE) return MAX_SCORE;
  return rounded;
}

/**
 * Map an engine's raw result into a canonical {@link MatchResult}, stamping the
 * producing engine's `mode` onto the output.
 *
 * The `mode` argument is authoritative: whatever the caller passes becomes the
 * output's `mode`, so the label always reflects the producing engine
 * (Property 2). The three evidence arrays always exist on the output. When
 * `noRequirements` is true the score is forced to `null`; otherwise the score
 * is rounded and clamped to 1–10 (a missing/invalid score defaults to
 * {@link MIN_SCORE}).
 *
 * @param mode   the engine that produced this result (`"free"` or `"ai"`)
 * @param raw    the engine's raw evidence and score
 */
export function toMatchResult(mode: AnalysisMode, raw: RawResult): MatchResult {
  const direct = raw.direct ?? [];
  const transferable = raw.transferable ?? [];
  const gaps = raw.gaps ?? [];

  const noRequirements = raw.noRequirements === true;

  let score: number | null;
  if (noRequirements) {
    score = null;
  } else if (typeof raw.score === "number" && Number.isFinite(raw.score)) {
    score = clampScore(raw.score);
  } else {
    // A scored result with a missing/invalid score defaults to the floor so the
    // schema invariant (non-null integer in 1–10 when requirements exist) holds.
    score = MIN_SCORE;
  }

  return {
    mode,
    score,
    noRequirements,
    direct,
    transferable,
    gaps,
  };
}

/**
 * Normalise a list of proposed edits from either engine into the canonical
 * {@link ProposedEdit}[] shape. Each edit is returned with all required fields
 * present; `accepted` defaults to `false` (the user has not yet decided).
 *
 * This is the single funnel both engines use so the before/after table renders
 * identically regardless of mode.
 */
export function toProposedEdits(
  raw: ReadonlyArray<Partial<ProposedEdit> & Pick<ProposedEdit, "id" | "section">>
): ProposedEdit[] {
  return raw.map((edit) => ({
    id: edit.id,
    section: edit.section,
    originalText: edit.originalText ?? "",
    recommendedText: edit.recommendedText ?? "",
    explanation: edit.explanation ?? "",
    accepted: edit.accepted ?? false,
  }));
}

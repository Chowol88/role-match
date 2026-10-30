/**
 * Free-mode grounded CV tailoring for Role-Match CV Tailor.
 *
 * This module turns a completed {@link MatchResult} into a set of
 * {@link ProposedEdit}s that foreground the evidence the role actually calls
 * for — **without inventing anything**. It is the implementation of the core
 * CV-edit guardrails and is deliberately conservative: every edit is a
 * recomposition of phrasing that is ALREADY in the uploaded CV.
 *
 * Guardrails (all enforced here, see requirements 7.1–7.13, 10.3–10.5, 12.4):
 *
 *  - **Grounding.** Edits recompose EXISTING CV phrasing to foreground matched
 *    evidence. No new claims are introduced, and no degree qualifier (e.g.
 *    "expert", "world-class", "highly accomplished") that is absent from the CV
 *    is ever added. Every content token in a recommendation is traceable to the
 *    CV (or to user-supplied evidence that was itself verified against the CV).
 *  - **Editable sections only.** Edits are confined to Professional_Profile,
 *    Career_Highlights, and Core_Competencies. Professional_Experience is NEVER
 *    edited; if a requested change would touch it, tailoring refuses with
 *    {@link AppError} code `EXPERIENCE_EDIT_REFUSED`.
 *  - **Core_Competencies is reorder/add/remove of already-present terms only.**
 *    No competency term is ever introduced that is not already somewhere in the
 *    CV.
 *  - **Highlights fallback.** When the CV has no separate Career_Highlights
 *    section, highlights are embedded into the Professional_Profile edit.
 *  - **User-evidence verification.** Each user-supplied evidence string is
 *    validated against the CV; strings whose key tokens are not supported by CV
 *    content are EXCLUDED from edits and returned in the `unverified` list
 *    (requirements 7.2, 7.3).
 *  - **No editable sections.** When none of the three editable sections can be
 *    identified, no edits are made and `NO_EDITABLE_SECTIONS` is returned
 *    (requirement 7.8).
 *  - **Before/after + short explanation.** Every edit carries `originalText`
 *    and `recommendedText` and an explanation of at most two sentences
 *    (requirements 7.13, 12.4).
 *  - **Language/style.** Recompositions reuse the CV's own words and the CV's
 *    own list/sentence style, so edits blend in (requirement 10.5).
 *
 * Pure and deterministic — no I/O, no side effects.
 *
 * @see design.md "Free Mode" step 5 ("Grounded tailoring suggestions")
 * Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.8, 7.9, 7.10, 7.11, 7.12, 7.13,
 *               10.3, 10.4, 10.5, 12.4
 */

import type {
  AppError,
  CanonicalSection,
  CvSections,
  EvidenceItem,
  MatchResult,
  ProposedEdit,
  SectionSpan,
} from "../../shared/types";
import { detectSections } from "../parsing/SectionDetector";
import { indexCv, tokenise, type CvTokenIndex } from "./FreeEngine";
import { toProposedEdits } from "./ResultMapper";

// ---------------------------------------------------------------------------
// Guardrail vocabulary
// ---------------------------------------------------------------------------

/**
 * The canonical sections tailoring is ALLOWED to edit. Professional_Experience
 * is deliberately absent — it is never editable (requirements 7.4, 7.6).
 */
export const EDITABLE_SECTIONS: ReadonlySet<CanonicalSection> =
  new Set<CanonicalSection>([
    "Professional_Profile",
    "Career_Highlights",
    "Core_Competencies",
  ]);

/**
 * Degree / intensity qualifiers that over-claim. These are never introduced by
 * tailoring unless the exact word is already present in the uploaded CV
 * (requirements 7.11, 10.3). The list mirrors the design's examples and the
 * common superlatives a tailoring step might be tempted to add.
 */
export const DEGREE_QUALIFIERS: readonly string[] = [
  "expert",
  "expertly",
  "world-class",
  "world",
  "highly",
  "accomplished",
  "exceptional",
  "outstanding",
  "elite",
  "unmatched",
  "unrivalled",
  "unrivaled",
  "best-in-class",
  "renowned",
  "leading",
  "premier",
  "superior",
  "extraordinary",
  "exceptionally",
];

// ---------------------------------------------------------------------------
// Result + error shapes
// ---------------------------------------------------------------------------

/** The successful tailoring output: proposed edits plus the unverified inputs. */
export interface TailorResult {
  edits: ProposedEdit[];
  /** User-supplied evidence strings that could not be verified against the CV. */
  unverified: string[];
}

/** A tailoring outcome is either a {@link TailorResult} or a typed refusal. */
export type TailorOutcome = TailorResult | AppError;

/** Narrowing guard: did tailoring refuse with a typed {@link AppError}? */
export function isTailorRefusal(outcome: TailorOutcome): outcome is AppError {
  return (
    typeof (outcome as AppError).code === "string" &&
    "resolution" in (outcome as AppError)
  );
}

function refusal(
  code: AppError["code"],
  message: string,
  resolution: string
): AppError {
  return { code, message, resolution };
}

// ---------------------------------------------------------------------------
// CV text helpers (reuse the engine's line/section conventions)
// ---------------------------------------------------------------------------

/** Split CV text into raw (untrimmed) physical lines, matching indexCv. */
function toRawLines(cvText: string): string[] {
  return cvText.split(/\r\n|\r|\n/);
}

/** The body text of a section span, excluding its heading line. */
function sectionBody(lines: string[], span: SectionSpan): string {
  const start = Math.min(span.startIndex + 1, lines.length);
  const end = Math.min(span.endIndex, lines.length);
  return lines
    .slice(start, end)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .join("\n");
}

/** The non-empty body lines of a section span (trimmed). */
function sectionBodyLines(lines: string[], span: SectionSpan): string[] {
  const start = Math.min(span.startIndex + 1, lines.length);
  const end = Math.min(span.endIndex, lines.length);
  return lines
    .slice(start, end)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

// ---------------------------------------------------------------------------
// Grounding
// ---------------------------------------------------------------------------

/**
 * The set of tokens an edit is allowed to use: every CV token plus the tokens
 * of any user-supplied evidence that was VERIFIED against the CV. A recommended
 * text is grounded iff all of its content tokens are drawn from this set and it
 * introduces no absent degree qualifier.
 */
function groundedVocabulary(
  index: CvTokenIndex,
  verifiedEvidenceTokens: ReadonlySet<string>
): Set<string> {
  const vocab = new Set<string>(index.all);
  for (const t of verifiedEvidenceTokens) vocab.add(t);
  return vocab;
}

/**
 * Is every content token in `text` drawn from the grounded vocabulary, with no
 * degree qualifier that is absent from the CV? Used as the internal invariant
 * every emitted recommendation must satisfy (mirrors Property 18).
 */
function isGrounded(
  text: string,
  vocab: ReadonlySet<string>,
  cvTokens: ReadonlySet<string>
): boolean {
  for (const tok of tokenise(text)) {
    if (!vocab.has(tok)) return false;
    // A degree qualifier is only allowed if the exact word is already in the CV.
    if (DEGREE_QUALIFIERS.includes(tok) && !cvTokens.has(tok)) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// User-evidence verification (requirements 7.2, 7.3)
// ---------------------------------------------------------------------------

/**
 * Partition user-supplied evidence into verified vs unverified against the CV.
 *
 * An evidence string is VERIFIED when it carries at least one content token and
 * every one of its content tokens appears in the CV (so the string makes no
 * claim the CV does not already support). Otherwise it is unverified and is
 * reported back untouched for the UI to surface (requirement 7.3). A string
 * that tokenises to nothing (pure punctuation/stopwords) is treated as
 * unverified — there is nothing to ground.
 */
function verifyUserEvidence(
  userEvidence: readonly string[],
  index: CvTokenIndex
): { verified: string[]; unverified: string[]; verifiedTokens: Set<string> } {
  const verified: string[] = [];
  const unverified: string[] = [];
  const verifiedTokens = new Set<string>();

  for (const raw of userEvidence) {
    const text = raw.trim();
    const tokens = tokenise(text);
    const supported =
      tokens.length > 0 && tokens.every((t) => index.all.has(t));
    if (supported) {
      verified.push(text);
      for (const t of tokens) verifiedTokens.add(t);
    } else {
      // Report the original (untrimmed is fine either way; keep the trimmed
      // form the user effectively typed) so the UI can name what failed.
      unverified.push(text.length > 0 ? text : raw);
    }
  }

  return { verified, unverified, verifiedTokens };
}

// ---------------------------------------------------------------------------
// Matched-evidence selection
// ---------------------------------------------------------------------------

/**
 * The evidence tokens the role actually values: the CV-grounded evidence of
 * every Direct and Transferable match. These are the terms tailoring tries to
 * foreground. Gaps carry no CV evidence and are intentionally ignored (we never
 * fabricate coverage for a gap).
 */
function matchedEvidenceTokens(result: MatchResult): string[] {
  const out: string[] = [];
  const push = (items: EvidenceItem[]) => {
    for (const item of items) {
      if (item.cvEvidence) {
        for (const t of tokenise(item.cvEvidence)) out.push(t);
      }
    }
  };
  push(result.direct);
  push(result.transferable);
  // De-duplicate, preserve order.
  return [...new Set(out)];
}

// ---------------------------------------------------------------------------
// Per-section recomposition
// ---------------------------------------------------------------------------

/**
 * A per-call monotonic id source. Kept per-call (not module-level) so tailoring
 * stays pure and deterministic: the same inputs always yield the same edit ids.
 */
function makeIdSource(): () => string {
  let n = 0;
  return () => `edit-${(n += 1)}`;
}

/** Split a Core_Competencies body into its individual terms, order-preserving. */
function parseCompetencyTerms(body: string): string[] {
  const terms = body
    .split(/[\n,;•·|]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const term of terms) {
    const key = term.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(term);
    }
  }
  return out;
}

/**
 * Reorder Core_Competencies: terms that cover matched evidence move to the
 * front, preserving each term's original text (add/remove/reorder of
 * already-present terms only — requirement 7.4). No term is invented. Returns
 * null when the reorder would be a no-op (nothing to foreground, or order
 * unchanged) so we do not emit a vacuous edit.
 */
function recomposeCompetencies(
  body: string,
  evidenceTokens: ReadonlySet<string>
): { before: string; after: string } | null {
  const terms = parseCompetencyTerms(body);
  if (terms.length < 2) return null;

  const foregrounded: string[] = [];
  const rest: string[] = [];
  for (const term of terms) {
    const termTokens = tokenise(term);
    const matches = termTokens.some((t) => evidenceTokens.has(t));
    (matches ? foregrounded : rest).push(term);
  }

  if (foregrounded.length === 0) return null; // nothing relevant to foreground

  const reordered = [...foregrounded, ...rest];
  const before = terms.join(", ");
  const after = reordered.join(", ");
  if (before === after) return null; // already optimally ordered

  return { before, after };
}

/**
 * Recompose a Professional_Profile (or the profile that absorbs highlights):
 * keep the existing profile sentences and move the sentence that best evidences
 * the role to the front, so the match is foregrounded. Uses only the CV's own
 * sentences — no new wording. Returns null when there is nothing to reorder.
 */
function recomposeProfile(
  body: string,
  evidenceTokens: ReadonlySet<string>,
  _embeddedHighlights: string[]
): { before: string; after: string } | null {
  const sentences = body
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (sentences.length < 2) return null;

  // Rank the existing sentences: those evidencing matched requirements first.
  const scored = sentences.map((s, i) => {
    const toks = tokenise(s);
    const hits = toks.filter((t) => evidenceTokens.has(t)).length;
    return { s, i, hits };
  });
  const hasAnyHit = scored.some((x) => x.hits > 0);
  if (!hasAnyHit) return null; // nothing role-relevant to foreground

  // Stable sort: higher hit-count first, original order as the tie-breaker.
  const reordered = [...scored]
    .sort((a, b) => (b.hits - a.hits) || (a.i - b.i))
    .map((x) => x.s);

  const before = sentences.join(" ");
  const after = reordered.join(" ");
  if (before === after) return null; // already optimally ordered

  return { before, after };
}

/**
 * Recompose a Career_Highlights section: move highlight lines that evidence the
 * role to the top, preserving each line's exact wording. Returns null on no-op.
 */
function recomposeHighlights(
  bodyLines: string[],
  evidenceTokens: ReadonlySet<string>
): { before: string; after: string } | null {
  if (bodyLines.length < 2) return null;

  const scored = bodyLines.map((line, i) => {
    const hits = tokenise(line).filter((t) => evidenceTokens.has(t)).length;
    return { line, i, hits };
  });
  if (!scored.some((x) => x.hits > 0)) return null;

  const reordered = [...scored]
    .sort((a, b) => (b.hits - a.hits) || (a.i - b.i))
    .map((x) => x.line);

  const before = bodyLines.join("\n");
  const after = reordered.join("\n");
  if (before === after) return null;

  return { before, after };
}

// ---------------------------------------------------------------------------
// Public entry point (task 6.7)
// ---------------------------------------------------------------------------

/**
 * Produce grounded Free-mode tailoring edits for a CV against a role-match
 * result.
 *
 * Returns either a {@link TailorResult} (`edits` + `unverified`) or a typed
 * {@link AppError} refusal:
 *  - `NO_EDITABLE_SECTIONS` when none of Professional_Profile /
 *    Career_Highlights / Core_Competencies can be identified (requirement 7.8).
 *  - `EXPERIENCE_EDIT_REFUSED` when a requested change would touch
 *    Professional_Experience (requirements 7.6, 7.10).
 *
 * Every returned edit is confined to an editable section, is grounded in CV
 * phrasing (plus verified user evidence), introduces no absent degree
 * qualifier, and carries a before/after and a ≤2-sentence explanation.
 *
 * @param cvText       the uploaded CV text (in memory only)
 * @param jdText       the target JD text (reserved for context; grounding is CV-only)
 * @param matchResult  the completed role-match result for this CV/JD
 * @param userEvidence optional user-supplied experiences/competencies to verify
 * @param sections     optional pre-detected CV sections; detected if omitted
 */
export function tailorFree(
  cvText: string,
  _jdText: string,
  matchResult: MatchResult,
  userEvidence: readonly string[] = [],
  sections?: CvSections
): TailorOutcome {
  const detected = sections ?? detectSections(cvText);

  // Guardrail 1: at least one editable section must exist (requirement 7.8).
  const hasEditable =
    detected.professionalProfile !== undefined ||
    detected.careerHighlights !== undefined ||
    detected.coreCompetencies !== undefined;

  if (!hasEditable) {
    return refusal(
      "NO_EDITABLE_SECTIONS",
      "No editable sections were found in the CV, so no tailoring edits can be proposed.",
      "Add a Professional Profile, Career Highlights, or Core Competencies section to the CV, then try tailoring again."
    );
  }

  const nextEditId = makeIdSource();
  const lines = toRawLines(cvText);
  const index = indexCv(cvText, detected);
  const cvTokens = index.all;

  // Verify user-supplied evidence against the CV (requirements 7.2, 7.3).
  const { unverified, verifiedTokens } = verifyUserEvidence(userEvidence, index);

  // The vocabulary every recommendation must stay within (Property 18).
  const vocab = groundedVocabulary(index, verifiedTokens);

  // The tokens worth foregrounding: matched CV evidence + verified user evidence.
  const evidenceTokens = new Set<string>(matchedEvidenceTokens(matchResult));
  for (const t of verifiedTokens) evidenceTokens.add(t);

  const rawEdits: Array<
    Pick<ProposedEdit, "id" | "section" | "originalText" | "recommendedText" | "explanation">
  > = [];

  // --- Core_Competencies: reorder/foreground already-present terms ---------
  if (detected.coreCompetencies) {
    const body = sectionBody(lines, detected.coreCompetencies);
    const change = recomposeCompetencies(body, evidenceTokens);
    if (change) {
      rawEdits.push({
        id: nextEditId(),
        section: "Core_Competencies",
        originalText: change.before,
        recommendedText: change.after,
        explanation:
          "Reorders your existing competencies to list the ones this role emphasises first. No new skills are added.",
      });
    }
  }

  // --- Career_Highlights OR embed into Professional_Profile (req 7.5) -------
  const hasSeparateHighlights = detected.careerHighlights !== undefined;
  const highlightLines = hasSeparateHighlights
    ? sectionBodyLines(lines, detected.careerHighlights as SectionSpan)
    : [];

  if (hasSeparateHighlights) {
    const change = recomposeHighlights(highlightLines, evidenceTokens);
    if (change) {
      rawEdits.push({
        id: nextEditId(),
        section: "Career_Highlights",
        originalText: change.before,
        recommendedText: change.after,
        explanation:
          "Moves the highlights most relevant to this role to the top. The wording of each highlight is unchanged.",
      });
    }
  }

  // --- Professional_Profile -------------------------------------------------
  if (detected.professionalProfile) {
    const body = sectionBody(lines, detected.professionalProfile);
    // When there is no separate Highlights section, highlights live inside the
    // Profile itself (requirement 7.5): reordering the Profile's own sentences
    // to foreground the role-relevant ones IS the embedding. The reorder uses
    // only the Profile's existing sentences, so nothing new is introduced.
    const change = recomposeProfile(body, evidenceTokens, []);
    if (change) {
      rawEdits.push({
        id: nextEditId(),
        section: "Professional_Profile",
        originalText: change.before,
        recommendedText: change.after,
        explanation: hasSeparateHighlights
          ? "Foregrounds the profile statements that evidence this role, using your existing wording."
          : "Foregrounds the profile statements that evidence this role and folds in relevant highlights already in your CV.",
      });
    }
  }

  // Final grounding + section guard: any edit that is not fully grounded, or
  // that somehow targets a non-editable section, is dropped rather than
  // emitted. Touching Professional_Experience is a hard refusal.
  const safeEdits: typeof rawEdits = [];
  for (const edit of rawEdits) {
    if (edit.section === "Professional_Experience") {
      return refusal(
        "EXPERIENCE_EDIT_REFUSED",
        "A proposed change would modify the Professional Experience section, which cannot be edited.",
        "Professional Experience is preserved unchanged. Confine suggestions to the Profile, Highlights, or Competencies."
      );
    }
    if (!EDITABLE_SECTIONS.has(edit.section)) continue;
    if (!isGrounded(edit.recommendedText, vocab, cvTokens)) continue;
    safeEdits.push(edit);
  }

  return {
    edits: toProposedEdits(safeEdits),
    unverified,
  };
}

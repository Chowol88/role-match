/**
 * Free-mode (rule-based, non-AI) role-match engine for Role-Match CV Tailor.
 *
 * This engine performs a structured, deterministic mapping between a job
 * description and a CV with no external calls. It is always labelled a
 * "structured (non-AI) analysis". The algorithm (see design.md "Free Mode"):
 *
 *   1. Extract JD requirement candidates — bulleted lines, "must have" /
 *      "required" / "responsibilities" blocks, and sentences carrying
 *      skill/qualification cues — into {@link JdRequirement}s with key tokens.
 *   2. Tokenise CV content per detected section, keeping section context so a
 *      token found in Professional_Experience is distinguishable from one in
 *      Core_Competencies.
 *   3. Classify each requirement as Direct / Transferable / Gap via token +
 *      synonym matching with section context.
 *   4. Compute a weighted coverage score, mapped to an integer 1–10 (clamped)
 *      when ≥1 requirement exists; otherwise return `noRequirements`.
 *
 * The three evidence arrays and the score are returned THROUGH the shared
 * {@link toMatchResult} mapper, so the output always carries `mode: "free"` and
 * the three arrays, identical in shape to the AI engine's output.
 *
 * Section synonym matching reuses {@link SECTION_SYNONYMS} so Free-mode matching
 * and section detection stay consistent.
 *
 * Pure and deterministic — no I/O, no side effects.
 *
 * @see design.md "Dual-Mode Analysis Engine" / "Free Mode"
 * Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.7, 10.1
 */

import type {
  CvSections,
  EvidenceItem,
  JdRequirement,
  MatchResult,
  SectionSpan,
  CanonicalSection,
} from "../../shared/types";
import { detectSections, SECTION_SYNONYMS } from "../parsing/SectionDetector";
import { toMatchResult } from "./ResultMapper";

// ---------------------------------------------------------------------------
// Tokenisation
// ---------------------------------------------------------------------------

/**
 * Common English stopwords plus JD-boilerplate words that carry no matching
 * signal. Kept deliberately small and focused on words that would otherwise
 * create spurious matches between every requirement and every CV.
 */
const STOPWORDS: ReadonlySet<string> = new Set([
  "a", "an", "and", "the", "or", "of", "to", "in", "on", "at", "for", "with",
  "by", "as", "is", "are", "be", "been", "being", "was", "were", "will",
  "would", "should", "can", "could", "may", "might", "must", "have", "has",
  "had", "do", "does", "did", "this", "that", "these", "those", "it", "its",
  "we", "you", "your", "our", "their", "they", "he", "she", "his", "her",
  "from", "into", "about", "over", "under", "per", "via", "such", "etc",
  "including", "include", "includes", "ability", "able", "work", "working",
  "role", "job", "position", "candidate", "applicant", "year", "years",
  "experience", "experienced", "strong", "good", "excellent", "proven",
  "demonstrated", "required", "require", "requires", "requirement",
  "requirements", "responsibility", "responsibilities", "must", "plus",
  "preferred", "desirable", "essential", "skill", "skills", "knowledge",
  "understanding", "across", "within", "using", "use", "well", "both",
  // Generic competency/heading words that carry no distinguishing match signal.
  // Excluding them prevents a requirement like "Expertise in X" from matching a
  // CV merely because both mention generic words such as "expertise".
  "expertise", "competencies", "competency", "competence", "proficiency",
  "proficient", "capability", "capabilities", "hands", "track", "record",
]);

/**
 * Split arbitrary text into normalised content tokens: lowercase alphanumeric
 * runs, with stopwords and single characters removed. Deterministic.
 */
export function tokenise(text: string): string[] {
  const raw = text
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/i)
    .map((t) => t.replace(/^[.]+|[.]+$/g, "")) // trim stray dots, keep c#/c++/.net cores
    .filter((t) => t.length > 1);
  return raw.filter((t) => !STOPWORDS.has(t));
}

/** A de-duplicated, order-preserving token list. */
function uniqueTokens(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tok of tokenise(text)) {
    if (!seen.has(tok)) {
      seen.add(tok);
      out.push(tok);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// JD requirement extraction (task 6.3)
// ---------------------------------------------------------------------------

/** A bullet marker at the start of a line (-, *, •, ·, or "N." / "N)"). */
const BULLET_RE = /^\s*(?:[-*•·‣◦]|\d+[.)])\s+/;

/** Cue phrases that mark a block of requirements/responsibilities. */
const BLOCK_CUE_RE =
  /\b(?:must[-\s]?have|must have|required|requirements|responsibilities|qualifications|what you(?:'| wi)ll do|key skills|who you are|about you)\b/i;

/** Cue words that make a free-standing sentence a requirement candidate. */
const SENTENCE_CUE_RE =
  /\b(?:experience|proficien\w*|skilled|knowledge|degree|certifi\w*|familiar\w*|expertise|proficiency|background|ability to|responsible for|demonstrated)\b/i;

/** Split text into trimmed, non-empty physical lines. */
function toLines(text: string): string[] {
  return text
    .split(/\r\n|\r|\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

/** Split a line into candidate sentences on terminal punctuation. */
function toSentences(line: string): string[] {
  return line
    .split(/(?<=[.!?;])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Extract requirement candidates from a job description into
 * {@link JdRequirement}s, each with a stable id and its key tokens.
 *
 * A line becomes a candidate when it is a bullet, or it sits under a block cue
 * heading ("must have", "responsibilities", …), or it is a sentence carrying a
 * skill/qualification cue. Candidates that tokenise to nothing (pure
 * boilerplate) are discarded so they do not create empty, unclassifiable
 * requirements. Duplicate requirement phrases (case-insensitive) are collapsed.
 */
export function extractRequirements(jdText: string): JdRequirement[] {
  const lines = toLines(jdText);
  const phrases: string[] = [];
  let inBlock = false;

  for (const line of lines) {
    const isBullet = BULLET_RE.test(line);
    const stripped = line.replace(BULLET_RE, "").trim();

    // A short cue-only heading (e.g. "Requirements:") opens a block but is not
    // itself a requirement.
    const isBlockHeading =
      BLOCK_CUE_RE.test(line) && stripped.replace(/[:\s]+$/, "").split(/\s+/).length <= 5;

    if (isBlockHeading && !isBullet) {
      inBlock = true;
      continue;
    }

    if (isBullet) {
      if (stripped.length > 0) phrases.push(stripped);
      continue;
    }

    if (inBlock) {
      // Lines within a requirements block are each candidates.
      if (stripped.length > 0) phrases.push(stripped);
      continue;
    }

    // Outside a block: only sentences carrying a skill/qualification cue.
    for (const sentence of toSentences(stripped)) {
      if (SENTENCE_CUE_RE.test(sentence) || BLOCK_CUE_RE.test(sentence)) {
        phrases.push(sentence);
      }
    }
  }

  const requirements: JdRequirement[] = [];
  const seen = new Set<string>();
  for (const phrase of phrases) {
    const tokens = uniqueTokens(phrase);
    if (tokens.length === 0) continue; // boilerplate-only, no matching signal
    const key = phrase.toLowerCase().replace(/\s+/g, " ").trim();
    if (seen.has(key)) continue;
    seen.add(key);
    requirements.push({
      id: `req-${requirements.length + 1}`,
      text: phrase,
      tokens,
    });
  }

  return requirements;
}

// ---------------------------------------------------------------------------
// CV tokenisation with section context (task 6.3)
// ---------------------------------------------------------------------------

/** A set of CV tokens tagged with the canonical section they were found in. */
export interface SectionTokens {
  section: CanonicalSection;
  tokens: Set<string>;
}

/** CV content tokenised per detected section, plus a whole-document token set. */
export interface CvTokenIndex {
  /** Tokens grouped by the section they appear in. */
  bySection: SectionTokens[];
  /** Every CV token regardless of section (union of all sections + preamble). */
  all: Set<string>;
}

/** Extract the text of one section span from the CV's physical lines. */
function sectionText(lines: string[], span: SectionSpan): string {
  // Span boundaries are line indices; skip the heading line itself.
  const start = Math.min(span.startIndex + 1, lines.length);
  const end = Math.min(span.endIndex, lines.length);
  return lines.slice(start, end).join("\n");
}

/**
 * Tokenise the CV, keeping section context. Each detected canonical section
 * contributes a {@link SectionTokens} entry; the union of all CV tokens (incl.
 * any text outside recognised sections) is also returned for whole-document
 * matching. Sections are detected via the shared {@link detectSections}.
 */
export function indexCv(cvText: string, sections?: CvSections): CvTokenIndex {
  const detected = sections ?? detectSections(cvText);
  // detectSections splits on the same newline set; keep raw (untrimmed) lines so
  // the span indices line up exactly.
  const lines = cvText.split(/\r\n|\r|\n/);

  const bySection: SectionTokens[] = [];
  const all = new Set<string>(tokenise(cvText));

  const spans: Array<SectionSpan | undefined> = [
    detected.professionalProfile,
    detected.careerHighlights,
    detected.coreCompetencies,
    detected.professionalExperience,
  ];

  for (const span of spans) {
    if (!span) continue;
    const tokens = new Set(tokenise(sectionText(lines, span)));
    bySection.push({ section: span.canonical, tokens });
  }

  return { bySection, all };
}

// ---------------------------------------------------------------------------
// Synonym expansion (reuses SECTION_SYNONYMS for consistency)
// ---------------------------------------------------------------------------

/**
 * Build a token-level synonym map from {@link SECTION_SYNONYMS}: every content
 * token appearing in a canonical section's synonym phrases is linked to the
 * other tokens in that same group. Reusing the section synonym library keeps
 * Free-mode matching and section detection aligned (as required by the task).
 */
const TOKEN_SYNONYMS: ReadonlyMap<string, ReadonlySet<string>> = (() => {
  const groups: string[][] = Object.values(SECTION_SYNONYMS).map((phrases) => {
    const toks = new Set<string>();
    for (const phrase of phrases) {
      for (const tok of tokenise(phrase)) toks.add(tok);
    }
    return [...toks];
  });

  const map = new Map<string, Set<string>>();
  for (const group of groups) {
    for (const tok of group) {
      const bucket = map.get(tok) ?? new Set<string>();
      for (const other of group) if (other !== tok) bucket.add(other);
      map.set(tok, bucket);
    }
  }
  return map;
})();

/** Does any CV token equal `token` or one of its known synonyms? */
function matchesWithSynonyms(token: string, cvTokens: Set<string>): boolean {
  if (cvTokens.has(token)) return true;
  const syns = TOKEN_SYNONYMS.get(token);
  if (!syns) return false;
  for (const syn of syns) if (cvTokens.has(syn)) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Classification + scoring (task 6.4)
// ---------------------------------------------------------------------------

/**
 * Sections treated as "primary" evidence context: a direct token match here
 * demonstrates the requirement explicitly. A match found only in another
 * section (or via a synonym) is treated as transferable.
 */
const PRIMARY_SECTIONS: ReadonlySet<CanonicalSection> = new Set<CanonicalSection>([
  "Professional_Experience",
  "Core_Competencies",
]);

/** The classification of a single requirement plus its supporting evidence. */
interface Classification {
  type: "direct" | "transferable" | "gap";
  item: EvidenceItem;
}

/**
 * Classify one requirement against the CV token index.
 *  - Direct       — a key token (exact, no synonym) appears in a PRIMARY
 *                   section (Experience / Core Competencies).
 *  - Transferable — a key token appears somewhere else in the CV, OR a synonym
 *                   of a key token appears anywhere — a genuine adjacent
 *                   capability but not the explicit requirement.
 *  - Gap          — neither direct nor transferable.
 */
function classify(req: JdRequirement, index: CvTokenIndex): Classification {
  const primaryTokens = new Set<string>();
  for (const st of index.bySection) {
    if (PRIMARY_SECTIONS.has(st.section)) {
      for (const t of st.tokens) primaryTokens.add(t);
    }
  }

  // Direct: an exact key token present in a primary section.
  const directTok = req.tokens.find((t) => primaryTokens.has(t));
  if (directTok) {
    // Record which section the match came from for grounding.
    const section = index.bySection.find(
      (st) => PRIMARY_SECTIONS.has(st.section) && st.tokens.has(directTok)
    )?.section;
    return {
      type: "direct",
      item: {
        type: "direct",
        requirementId: req.id,
        requirementText: req.text,
        cvEvidence: directTok,
        section,
      },
    };
  }

  // Transferable: exact token elsewhere in the CV, or a synonym match anywhere.
  const exactElsewhere = req.tokens.find((t) => index.all.has(t));
  const synonymMatch = req.tokens.find((t) => matchesWithSynonyms(t, index.all));
  const transferableTok = exactElsewhere ?? synonymMatch;
  if (transferableTok) {
    const section = index.bySection.find((st) =>
      st.tokens.has(transferableTok)
    )?.section;
    return {
      type: "transferable",
      item: {
        type: "transferable",
        requirementId: req.id,
        requirementText: req.text,
        cvEvidence: transferableTok,
        section,
      },
    };
  }

  // Gap: no supporting evidence (no cvEvidence for gaps).
  return {
    type: "gap",
    item: {
      type: "gap",
      requirementId: req.id,
      requirementText: req.text,
    },
  };
}

/**
 * Weighted coverage mapped to an integer 1–10. Direct matches count fully,
 * transferable at half weight. When at least one requirement exists the score
 * is clamped to the inclusive 1–10 band (even zero coverage scores a floor of 1
 * so a scored result is never below the band). The final clamp/round is also
 * enforced by the ResultMapper; computing an integer here keeps the engine's
 * own contract explicit.
 */
function computeScore(directCount: number, transferableCount: number, total: number): number {
  if (total <= 0) return 1;
  const coverage = (directCount + 0.5 * transferableCount) / total; // 0..1
  // Map 0..1 coverage onto 1..10.
  return Math.min(10, Math.max(1, Math.round(coverage * 9 + 1)));
}

// ---------------------------------------------------------------------------
// Public entry point (tasks 6.3 + 6.4)
// ---------------------------------------------------------------------------

/**
 * Run the Free-mode role-match analysis for a CV/JD pair.
 *
 * Extracts JD requirements, tokenises the CV by section, classifies every
 * requirement into Direct / Transferable / Gap, and computes the 1–10 score.
 * The result is produced THROUGH the shared {@link toMatchResult} mapper, so it
 * always carries `mode: "free"` and the three evidence arrays. When the JD
 * yields no analysable requirements the result is `noRequirements` with a null
 * score.
 *
 * @param cvText   the extracted CV text (in memory only)
 * @param jdText   the extracted JD text (in memory only)
 * @param sections optional pre-detected CV sections; detected if omitted
 */
export function analyzeFree(
  cvText: string,
  jdText: string,
  sections?: CvSections
): MatchResult {
  const requirements = extractRequirements(jdText);

  if (requirements.length === 0) {
    return toMatchResult("free", { noRequirements: true });
  }

  const index = indexCv(cvText, sections);

  const direct: EvidenceItem[] = [];
  const transferable: EvidenceItem[] = [];
  const gaps: EvidenceItem[] = [];

  for (const req of requirements) {
    const { type, item } = classify(req, index);
    if (type === "direct") direct.push(item);
    else if (type === "transferable") transferable.push(item);
    else gaps.push(item);
  }

  const score = computeScore(direct.length, transferable.length, requirements.length);

  return toMatchResult("free", {
    score,
    noRequirements: false,
    direct,
    transferable,
    gaps,
  });
}

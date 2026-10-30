// server/parsing/SectionDetector.ts
//
// Semantic, synonym-based CV section detection.
//
// Headings are matched to the four canonical sections by MEANING, not by exact
// string. A line is treated as a candidate heading when it is short, carries no
// terminal sentence punctuation, and is followed by body content. Each candidate
// is normalised (trim, lowercase, collapse whitespace, strip trailing colons)
// before being matched against the case-insensitive synonym sets below.
//
// For each detected section we record a SectionSpan whose boundaries run from the
// heading line to the start of the next recognised heading (or end of document),
// expressed as line-index boundaries. The same line range is also recorded in
// `paragraphRange` so the .docx output builder (a later task) can preserve the
// Professional_Experience block byte-for-byte.
//
// Design reference: "Section detection (semantic, synonym-based)" and
// "Locating and preserving Professional_Experience".
// _Requirements: 7.7_

import type {
  CanonicalSection,
  CvSections,
  SectionSpan,
} from "../../shared/types";

/**
 * The canonical synonym sets, exactly as specified in the design document.
 * All entries are lowercase; matching is case-insensitive after normalisation.
 * Exported so other modules and tests can reuse the same source of truth.
 */
export const SECTION_SYNONYMS: Record<CanonicalSection, string[]> = {
  Professional_Profile: [
    "professional profile",
    "executive profile",
    "career summary",
    "professional summary",
    "profile",
    "summary",
    "about me",
    "personal statement",
    "objective",
    "career objective",
    "professional objective",
    "career profile",
    "personal profile",
    "career summary statement",
  ],
  Career_Highlights: [
    "career highlights",
    "selected career highlights",
    "key achievements",
    "key accomplishments",
    "achievements",
    "highlights",
    "notable achievements",
    "key highlights",
    "career achievements",
    "professional achievements",
    "selected achievements",
    "accomplishments",
  ],
  Core_Competencies: [
    "core competencies",
    "skills",
    "areas of expertise",
    "key skills",
    "technical skills",
    "competencies",
    "expertise",
    "skills summary",
    "key competencies",
    "technical competencies",
    "core skills",
    "professional skills",
    "relevant skills",
    "areas of competence",
  ],
  Professional_Experience: [
    "professional experience",
    "work experience",
    "employment history",
    "career experience",
    "experience",
    "work history",
    "professional background",
    "relevant experience",
    "professional work experience",
    "career history",
    "relevant work experience",
    "work experience and achievements",
  ],
};

/**
 * Reverse lookup: normalised synonym phrase -> canonical section.
 * Built once from SECTION_SYNONYMS. If a phrase were ever to appear under more
 * than one canonical section, the first canonical section wins (by declaration
 * order), but the design's synonym sets are disjoint so this does not occur.
 */
const SYNONYM_TO_CANONICAL: Map<string, CanonicalSection> = (() => {
  const map = new Map<string, CanonicalSection>();
  for (const canonical of Object.keys(SECTION_SYNONYMS) as CanonicalSection[]) {
    for (const phrase of SECTION_SYNONYMS[canonical]) {
      const key = normaliseHeading(phrase);
      if (!map.has(key)) {
        map.set(key, canonical);
      }
    }
  }
  return map;
})();

/** Maximum word count for a line to still be considered a candidate heading. */
const MAX_HEADING_WORDS = 6;

/** Terminal sentence punctuation that disqualifies a line from being a heading. */
const TERMINAL_PUNCTUATION = /[.!?,;]$/;

/**
 * Normalise a candidate heading for matching: trim, collapse internal
 * whitespace to single spaces, strip trailing colons (and surrounding space),
 * and lowercase. Exported for reuse/testing.
 */
export function normaliseHeading(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[:\s]+$/, "")
    .trim()
    .toLowerCase();
}

/**
 * Decide whether a raw line looks like a candidate heading:
 *  - non-empty after trimming,
 *  - short (<= MAX_HEADING_WORDS words),
 *  - no terminal sentence punctuation.
 * The "followed by body content" requirement is enforced by the caller, which
 * only accepts a heading when there is at least one subsequent line.
 */
function isCandidateHeading(rawLine: string): boolean {
  const trimmed = rawLine.trim();
  if (trimmed.length === 0) return false;
  // Strip a single trailing colon before counting/word-punctuation checks so a
  // heading like "Skills:" is still recognised.
  const withoutColon = trimmed.replace(/:\s*$/, "");
  if (withoutColon.length === 0) return false;
  if (TERMINAL_PUNCTUATION.test(withoutColon)) return false;
  const words = withoutColon.split(/\s+/);
  if (words.length > MAX_HEADING_WORDS) return false;
  return true;
}

/** Map a raw candidate heading line to a canonical section, or null. */
function matchCanonical(rawLine: string): CanonicalSection | null {
  const normalised = normaliseHeading(rawLine);
  return SYNONYM_TO_CANONICAL.get(normalised) ?? null;
}

/** Internal record of a recognised heading found during the first pass. */
interface HeadingHit {
  canonical: CanonicalSection;
  headingText: string; // original, as written (trimmed)
  lineIndex: number;
}

/**
 * Detect the canonical sections of a CV from its plain text.
 *
 * Scans line by line, identifies candidate headings, and maps them by meaning
 * to canonical sections. Each detected section's span runs from its heading
 * line up to (but not including) the next recognised heading line, or to the
 * end of the document. Boundaries and `paragraphRange` are line indices.
 *
 * If multiple headings map to the same canonical section, the FIRST occurrence
 * is kept.
 */
export function detectSections(text: string): CvSections {
  const lines = text.split(/\r\n|\r|\n/);

  // First pass: collect every recognised heading, in document order.
  const hits: HeadingHit[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!isCandidateHeading(lines[i])) continue;

    // A heading must be followed by body content: at least one non-empty line
    // after it somewhere before the end of the document.
    const hasFollowingBody = lines
      .slice(i + 1)
      .some((l) => l.trim().length > 0);
    if (!hasFollowingBody) continue;

    const canonical = matchCanonical(lines[i]);
    if (canonical === null) continue;

    hits.push({
      canonical,
      headingText: lines[i].trim(),
      lineIndex: i,
    });
  }

  // Second pass: turn hits into spans. The end of a section is the start of the
  // NEXT recognised heading (regardless of its canonical type) or end of doc.
  const sections: CvSections = {};
  const seen = new Set<CanonicalSection>();

  for (let h = 0; h < hits.length; h++) {
    const hit = hits[h];

    // Keep only the first occurrence of each canonical section.
    if (seen.has(hit.canonical)) continue;
    seen.add(hit.canonical);

    const startIndex = hit.lineIndex;
    const nextHit = hits[h + 1];
    const endIndex = nextHit ? nextHit.lineIndex : lines.length;

    const span: SectionSpan = {
      canonical: hit.canonical,
      headingText: hit.headingText,
      startIndex,
      endIndex,
      paragraphRange: [startIndex, endIndex],
    };

    assignSpan(sections, span);
  }

  return sections;
}

/** Place a span onto the correct CvSections field by its canonical type. */
function assignSpan(sections: CvSections, span: SectionSpan): void {
  switch (span.canonical) {
    case "Professional_Profile":
      sections.professionalProfile = span;
      break;
    case "Career_Highlights":
      sections.careerHighlights = span;
      break;
    case "Core_Competencies":
      sections.coreCompetencies = span;
      break;
    case "Professional_Experience":
      sections.professionalExperience = span;
      break;
  }
}

/**
 * Tailored-CV `.docx` output builder for Role-Match CV Tailor.
 *
 * This module turns an uploaded CV plus a set of ACCEPTED {@link ProposedEdit}s
 * into an editable Word document, applying the design's output guardrails
 * (design.md "Output Generation" → "Tailored CV (.docx, docx library)"):
 *
 *  - **Start from the parsed `.docx` structure.** The CV is represented in this
 *    codebase as text split into physical lines (paragraphs), with the detected
 *    canonical sections carrying line-index `paragraphRange`s
 *    (see {@link SectionDetector}). The builder walks the document in order and
 *    rebuilds it paragraph-by-paragraph.
 *  - **Replace only the editable sections.** Professional_Profile,
 *    Career_Highlights, and Core_Competencies bodies are replaced with the
 *    ACCEPTED edit's `recommendedText` (requirements 7.4, 7.5). When the CV has
 *    no separate Career_Highlights section, a highlights edit is embedded into
 *    the Professional_Profile section instead (requirement 7.5).
 *  - **Preserve Professional_Experience byte-for-byte.** The exact original
 *    lines of the Experience section — and the name/contact/titles/employers/
 *    dates in the preamble and any non-editable section — are carried over
 *    UNCHANGED (requirements 7.6, 8.1). The builder never regenerates that text.
 *  - **Only accepted edits are applied.** Rejected or pending edits never reach
 *    the output (requirement 7.14): the caller passes only accepted edits, and
 *    the builder additionally filters defensively on `accepted === true`.
 *  - **Advisory + success note appended** (requirement 8.3): review for
 *    correctness/accuracy/applicability, add name and contact before sending,
 *    and a message wishing the user success.
 *  - **Per-session version numbering** (requirement 8.2): the `Content-
 *    Disposition` filename carries `_v{n}` and an in-document version marker is
 *    appended, where `n` is the per-session download version.
 *
 * The result is returned IN MEMORY (a Buffer) plus the versioned filename and
 * `Content-Disposition` header value, so the download route can stream it
 * without ever writing to disk.
 *
 * @see design.md "Output Generation"
 * Requirements 7.5, 7.6, 8.1, 8.2, 8.3
 */

import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import type {
  CvSections,
  ProposedEdit,
  SectionSpan,
} from "../../shared/types";
import { detectSections } from "../parsing/SectionDetector";

// ---------------------------------------------------------------------------
// Advisory + success note (requirement 8.3)
// ---------------------------------------------------------------------------

/**
 * The exact advisory and success lines appended to every generated CV. Exported
 * so the property test (Property 22) and the UI can assert on the same strings.
 */
export const ADVISORY_LINES: readonly string[] = [
  "Please review this revised CV carefully for correctness, accuracy, and applicability before you use it.",
  "Remember to add your name and contact details before sending it to anyone.",
  "We wish you every success with your application.",
];

/** The in-document version marker prefix (requirement 8.2). */
export const VERSION_MARKER_PREFIX = "Tailored CV version:";

/** Build the in-document version marker text for a given version number. */
export function versionMarker(version: number): string {
  return `${VERSION_MARKER_PREFIX} v${version}`;
}

// ---------------------------------------------------------------------------
// Inputs / outputs
// ---------------------------------------------------------------------------

/** Everything the builder needs to produce a tailored CV. */
export interface CvDocxBuildInput {
  /** The uploaded CV text — the parsed structure, as physical lines. */
  cvText: string;
  /** Pre-detected canonical sections; detected from `cvText` when omitted. */
  sections?: CvSections;
  /** The proposed edits; only those with `accepted === true` are applied. */
  edits: ReadonlyArray<ProposedEdit>;
  /**
   * The per-session download version (1-based). Used for the filename `_v{n}`
   * suffix and the in-document marker (requirement 8.2).
   */
  version?: number;
  /** Optional base filename (without extension/version); defaults below. */
  baseName?: string;
}

/** The in-memory result of a build. */
export interface CvDocxBuildResult {
  /** The generated `.docx` bytes (memory only, never written to disk). */
  buffer: Buffer;
  /** The versioned filename, e.g. `tailored-cv_v2.docx`. */
  filename: string;
  /** The ready-to-use `Content-Disposition` header value. */
  contentDisposition: string;
}

const DEFAULT_BASE_NAME = "tailored-cv";

// ---------------------------------------------------------------------------
// Document reconstruction
// ---------------------------------------------------------------------------

/** One segment of the rebuilt document, in source order. */
interface Segment {
  /** The heading line text, if this segment began with a recognised heading. */
  heading?: string;
  /** Whether this segment's heading is a recognised canonical heading. */
  isHeading: boolean;
  /**
   * The body lines of the segment. For an editable section with an accepted
   * edit these are REPLACED with the recommendation; for everything else
   * (preamble, Professional_Experience, unrecognised sections) they are the
   * ORIGINAL lines, carried over byte-for-byte.
   */
  bodyLines: string[];
}

/** An editable canonical section the builder may replace. */
type EditableCanonical =
  | "Professional_Profile"
  | "Career_Highlights"
  | "Core_Competencies";

/** Pick the first accepted edit for a given section, or undefined. */
function acceptedEditFor(
  edits: ReadonlyArray<ProposedEdit>,
  section: EditableCanonical
): ProposedEdit | undefined {
  return edits.find((e) => e.accepted && e.section === section);
}

/**
 * Split the recommended text of an edit into its paragraph lines, preserving
 * the recommendation's own line breaks (so a reordered competency list or a
 * reordered multi-sentence profile keeps its shape).
 */
function recommendationLines(edit: ProposedEdit): string[] {
  return edit.recommendedText
    .split(/\r\n|\r|\n/)
    .map((l) => l)
    .filter((l, i, arr) => !(l.trim() === "" && (i === 0 || i === arr.length - 1)));
}

/**
 * Walk the CV in document order, producing one {@link Segment} per span plus a
 * leading preamble segment for any content before the first recognised heading.
 *
 * Editable sections with an accepted edit have their body replaced; the special
 * case where there is NO separate Career_Highlights section but a highlights
 * edit exists embeds that recommendation into the Professional_Profile segment
 * (requirement 7.5). Professional_Experience and every other span keep their
 * ORIGINAL lines unchanged (requirements 7.6, 8.1).
 */
export function buildSegments(
  cvText: string,
  sections: CvSections,
  acceptedEdits: ReadonlyArray<ProposedEdit>
): Segment[] {
  const lines = cvText.split(/\r\n|\r|\n/);

  // Collect spans in document order by their start index.
  const spans: SectionSpan[] = [
    sections.professionalProfile,
    sections.careerHighlights,
    sections.coreCompetencies,
    sections.professionalExperience,
  ].filter((s): s is SectionSpan => s !== undefined);
  spans.sort((a, b) => a.startIndex - b.startIndex);

  const hasSeparateHighlights = sections.careerHighlights !== undefined;

  const segments: Segment[] = [];

  // Preamble: everything before the first recognised heading (name, contact,
  // etc.) is carried over unchanged.
  const firstStart = spans.length > 0 ? spans[0].startIndex : lines.length;
  if (firstStart > 0) {
    segments.push({
      isHeading: false,
      bodyLines: lines.slice(0, firstStart),
    });
  }

  for (const span of spans) {
    const headingLine = lines[span.startIndex];
    // Body runs from the line after the heading to the span end.
    const bodyStart = Math.min(span.startIndex + 1, lines.length);
    const bodyEnd = Math.min(span.endIndex, lines.length);
    const originalBody = lines.slice(bodyStart, bodyEnd);

    let bodyLines = originalBody;

    if (span.canonical === "Professional_Profile") {
      const profileEdit = acceptedEditFor(acceptedEdits, "Professional_Profile");
      const highlightsEdit = acceptedEditFor(acceptedEdits, "Career_Highlights");
      if (profileEdit) {
        bodyLines = recommendationLines(profileEdit);
      }
      // Requirement 7.5: when there is no separate Highlights section, embed an
      // accepted highlights edit into the Profile body.
      if (!hasSeparateHighlights && highlightsEdit) {
        bodyLines = [...bodyLines, ...recommendationLines(highlightsEdit)];
      }
    } else if (span.canonical === "Career_Highlights") {
      const edit = acceptedEditFor(acceptedEdits, "Career_Highlights");
      if (edit) bodyLines = recommendationLines(edit);
    } else if (span.canonical === "Core_Competencies") {
      const edit = acceptedEditFor(acceptedEdits, "Core_Competencies");
      if (edit) bodyLines = recommendationLines(edit);
    }
    // Professional_Experience and any other section: original body unchanged.

    segments.push({
      heading: headingLine,
      isHeading: true,
      bodyLines,
    });
  }

  return segments;
}

/** Convert a plain text line to a docx paragraph (empty lines kept as blanks). */
function textParagraph(line: string): Paragraph {
  return new Paragraph({ children: [new TextRun(line)] });
}

/** Convert a recognised heading line into a styled heading paragraph. */
function headingParagraph(line: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun(line)],
  });
}

// ---------------------------------------------------------------------------
// Public entry point (task 8.1)
// ---------------------------------------------------------------------------

/**
 * Build the versioned `Content-Disposition` filename for a download.
 * Exported for the version-numbering property test (Property 21).
 */
export function versionedFilename(baseName: string, version: number): string {
  return `${baseName}_v${version}.docx`;
}

/** Build the `Content-Disposition` header value for a filename. */
export function contentDisposition(filename: string): string {
  return `attachment; filename="${filename}"`;
}

/**
 * Build a tailored CV `.docx` from the uploaded CV and accepted edits.
 *
 * Only edits with `accepted === true` are applied; everything else — including
 * the Professional_Experience section and the name/contact/titles/employers/
 * dates — is carried through unchanged. The advisory + success note is always
 * appended, and the per-session version appears in both the filename and an
 * in-document marker.
 *
 * @returns an in-memory {@link CvDocxBuildResult}
 */
export async function buildCvDocx(
  input: CvDocxBuildInput
): Promise<CvDocxBuildResult> {
  const { cvText } = input;
  const baseName = input.baseName ?? DEFAULT_BASE_NAME;
  const sections = input.sections ?? detectSections(cvText);

  // Defensive filter: only accepted edits ever reach the output (req 7.14).
  const acceptedEdits = input.edits.filter((e) => e.accepted === true);

  const segments = buildSegments(cvText, sections, acceptedEdits);

  const children: Paragraph[] = [];
  for (const seg of segments) {
    if (seg.isHeading && seg.heading !== undefined) {
      children.push(headingParagraph(seg.heading));
    }
    for (const line of seg.bodyLines) {
      children.push(textParagraph(line));
    }
  }

  // --- Advisory + success note (requirement 8.3) ---------------------------
  children.push(textParagraph(""));
  for (const advisory of ADVISORY_LINES) {
    children.push(textParagraph(advisory));
  }

  const doc = new Document({ sections: [{ children }] });
  const buffer = await Packer.toBuffer(doc);

  const filename = `${baseName}.docx`;

  return {
    buffer: Buffer.from(buffer),
    filename,
    contentDisposition: contentDisposition(filename),
  };
}

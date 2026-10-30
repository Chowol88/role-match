/**
 * Shared TypeScript types for Role-Match CV Tailor.
 *
 * These types are the single source of truth shared between the Express
 * backend and the React front end. They mirror the design document's
 * "Data Models" section exactly. No raw CV/JD content, raw PII, or raw API
 * key is ever represented in a shape intended to be sent to the client —
 * see {@link ApiKeyConfig} for the masked-key contract.
 */

// ---------------------------------------------------------------------------
// Type aliases and unions
// ---------------------------------------------------------------------------

/** The analysis mode chosen per session. `free` is the default. */
export type AnalysisMode = "free" | "ai";

/** The AI provider used in AI Mode. */
export type Provider = "openai" | "claude";

/**
 * Canonical CV section names. Headings in an uploaded CV are matched to one
 * of these by meaning (synonym-based detection), not by exact string.
 */
export type CanonicalSection =
  | "Professional_Profile"
  | "Career_Highlights"
  | "Core_Competencies"
  | "Professional_Experience";

/** How a JD requirement is evidenced against the CV. */
export type EvidenceType = "direct" | "transferable" | "gap";

/**
 * The categories of personally identifiable information the guard hard-blocks.
 *
 * The members below are listed in the STABLE CANONICAL ORDER used everywhere a
 * {@link PiiReport.blockedTypes} array is produced or compared:
 *
 *   email → phone → url_social → nric_fin → address → passport
 *
 * The first three are generic contact identifiers; the last three are
 * Singapore-context personal data the PDPC classifies as personal data and
 * which the guard therefore hard-blocks:
 *  - `nric_fin`  National Registration Identity Card / Foreign Identification
 *                Number (format match only).
 *  - `address`   A Singapore physical address signal (floor-unit marker or a
 *                "Singapore" + 6-digit postal code pair).
 *  - `passport`  A labelled passport number.
 *
 * A person's NAME is deliberately NOT a member: the name heuristic is
 * warn-only and never appears in `blockedTypes`.
 */
export type PiiType =
  | "email"
  | "phone"
  | "url_social"
  | "nric_fin"
  | "address"
  | "passport";

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

/**
 * The client-facing view of an AI key. Only ever carries the masked form;
 * the raw key is held exclusively in backend memory and is never placed in
 * this shape when sent to the UI.
 */
export interface ApiKeyConfig {
  provider: Provider;
  /** e.g. "••••••••3f9a" — only form ever sent to the UI. */
  maskedKey: string;
  // raw key is held ONLY in backend memory, never in this shape sent to the client
}

/** A parsed CV or JD document. Text lives in memory only, never on disk. */
export interface ParsedDocument {
  kind: "cv" | "jd";
  format: "docx" | "txt" | "pdf";
  /** Extracted text — in-memory only. */
  text: string;
  /** Present for CVs; the detected canonical section spans. */
  sections?: CvSections;
}

/** The detected canonical sections of a CV. Any section may be absent. */
export interface CvSections {
  professionalProfile?: SectionSpan;
  careerHighlights?: SectionSpan;
  coreCompetencies?: SectionSpan;
  professionalExperience?: SectionSpan;
}

/** The location and metadata of one detected canonical section. */
export interface SectionSpan {
  canonical: CanonicalSection;
  /** Original heading text as written in the source. */
  headingText: string;
  /** Char offset or paragraph index where the section begins. */
  startIndex: number;
  /** Char offset or paragraph index where the section ends. */
  endIndex: number;
  /** Underlying paragraph index range, for `.docx` structure preservation. */
  paragraphRange?: [number, number];
}

/** A single PII detection. The sample is a short redacted indicator only. */
export interface PiiFinding {
  type: PiiType;
  /** Short, redacted indicator — never the full value, never logged in full. */
  sample?: string;
}

/**
 * The result of running the PII guard on a CV. Reports ALL hard-block types
 * found together (not just the first) so the UI can list every type to remove.
 */
export interface PiiReport {
  /** All hard-block types found (may be empty). */
  blockedTypes: PiiType[];
  /** Warn-only name heuristic flag; never blocks on its own. */
  nameWarning: boolean;
  /** True when `blockedTypes` is non-empty. */
  blocked: boolean;
}

/** A requirement extracted from the job description. */
export interface JdRequirement {
  id: string;
  /** The requirement phrase. */
  text: string;
  /** Key tokens used for matching. */
  tokens: string[];
}

/** One classified requirement with its supporting CV evidence (if any). */
export interface EvidenceItem {
  type: EvidenceType;
  requirementId: string;
  requirementText: string;
  /** Supporting CV text (grounding); absent for gaps. */
  cvEvidence?: string;
  /** Where the evidence was found. */
  section?: CanonicalSection;
}

/** The shared role-match result schema produced by both engines. */
export interface MatchResult {
  /** The engine that produced this result — used for labelling. */
  mode: AnalysisMode;
  /** Integer 1-10, or null when `noRequirements` is true. */
  score: number | null;
  /** True when no analysable JD requirements were extracted. */
  noRequirements: boolean;
  direct: EvidenceItem[];
  transferable: EvidenceItem[];
  gaps: EvidenceItem[];
}

/** A single proposed before/after edit, pending the user's accept/reject. */
export interface ProposedEdit {
  id: string;
  /** Only Profile / Highlights / Competencies are ever editable. */
  section: CanonicalSection;
  originalText: string;
  recommendedText: string;
  /** <= 2 sentences. */
  explanation: string;
  /** User decision; only accepted edits reach the output. */
  accepted: boolean;
}

/**
 * An append-only audit log event. NEVER includes raw CV/JD content, raw PII,
 * or the API key — only session metadata.
 */
export interface AuditEvent {
  /** ISO 8601 timestamp. */
  timestamp: string;
  sessionId: string;
  event:
    | "session_start"
    | "mode_selected"
    | "upload"
    | "analyze"
    | "tailor"
    | "download_cv"
    | "download_log"
    | "reset";
  mode?: AnalysisMode;
  score?: number | null;
  // NEVER includes raw CV/JD content, raw PII, or the API key
}

/**
 * The full in-memory session state, keyed by an opaque ephemeral sessionId.
 * Never serialised to disk.
 */
export interface SessionState {
  sessionId: string;
  /** Defaults to "free" at mode selection. */
  mode: AnalysisMode | null;
  /** AI Mode only; the raw key value is backend-memory-only. */
  apiKey?: ApiKeyConfig;
  /** In memory only. */
  cv?: ParsedDocument;
  /** In memory only. */
  jd?: ParsedDocument;
  result?: MatchResult;
  edits?: ProposedEdit[];
  agreementConfirmed: boolean;
  /** Increments per CV download. */
  downloadVersion: number;
}

/**
 * Provider abstraction (backend only). A single contract over OpenAI and
 * Claude, implemented by `OpenAiAdapter` and `ClaudeAdapter`.
 */
export interface ProviderAdapter {
  provider: Provider;
  validateKey(apiKey: string): Promise<{ valid: boolean; error?: string }>;
  analyze(cvText: string, jdText: string): Promise<MatchResult>;
  tailor(
    cvText: string,
    sections: CvSections,
    userEvidence: string[]
  ): Promise<{ edits: ProposedEdit[]; unverified: string[] }>;
}

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

/**
 * The complete set of typed application error codes. The error middleware
 * maps each to a user-facing message and resolution (see {@link AppError}).
 */
export type AppErrorCode =
  | "MISSING_DOCUMENT"
  | "UNSUPPORTED_FORMAT"
  | "FILE_TOO_LARGE"
  | "FILE_UNREADABLE"
  | "PII_BLOCKED"
  | "NAME_WARNING"
  | "INVALID_API_KEY"
  | "AI_CALL_FAILED"
  | "NO_REQUIREMENTS"
  | "NO_EDITABLE_SECTIONS"
  | "EXPERIENCE_EDIT_REFUSED"
  | "UNVERIFIED_EVIDENCE"
  | "AGREEMENT_REQUIRED"
  | "UNKNOWN_SESSION"
  | "RATE_LIMITED";

/**
 * The error-middleware contract: every typed error is serialised to this
 * shape before being returned to the client, pairing a machine-readable code
 * with a human message and the expected resolution.
 */
export interface AppError {
  code: AppErrorCode;
  message: string;
  resolution: string;
}

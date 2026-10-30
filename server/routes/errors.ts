/**
 * Typed-error helpers shared by the REST routes and the error middleware.
 *
 * Every route surfaces failures as a plain {@link AppError} shape
 * (`{ code, message, resolution }`). The error middleware (see
 * {@link errorMiddleware} in `server/index.ts`) converts any thrown AppError —
 * or an {@link AiCallFailedError}, which already implements the AppError shape —
 * into that JSON response. This module owns:
 *
 *  - {@link isAppError}: a structural guard so the middleware can tell a typed
 *    AppError (including thrown ones carrying extra Error fields) from an
 *    unexpected throw.
 *  - {@link makeError}: construct an AppError with the canonical message +
 *    resolution for a code (callers may override either).
 *  - {@link ERROR_COPY}: the single source of truth mapping each
 *    {@link AppErrorCode} to its default user-facing message and resolution,
 *    matching the design's Error Handling table.
 *
 * @see design.md "Error Handling"
 * Requirements 11.4, 11.5
 */

import type { AppError, AppErrorCode } from "../../shared/types";

/** Default user-facing copy for every typed error code (design Error table). */
export const ERROR_COPY: Record<
  AppErrorCode,
  { message: string; resolution: string }
> = {
  MISSING_DOCUMENT: {
    message: "A required document is missing.",
    resolution: "Upload both a CV and a job description before analysing.",
  },
  UNSUPPORTED_FORMAT: {
    message: "That file format is not supported.",
    resolution: "Upload a .docx, .txt, or .pdf file.",
  },
  FILE_TOO_LARGE: {
    message: "That file is larger than the 10 MB maximum.",
    resolution: "Upload a file of 10 MB or less.",
  },
  FILE_UNREADABLE: {
    message: "The file could not be read as text.",
    resolution:
      "The file may be empty, corrupted, or not a supported document. Please try another file.",
  },
  PII_BLOCKED: {
    message: "The CV contains contact details that must be removed first.",
    resolution:
      "Remove the listed personal contact details from the CV and upload it again.",
  },
  NAME_WARNING: {
    message: "The CV appears to contain a personal name.",
    resolution:
      "Remove any personal names, then confirm you have done so to proceed.",
  },
  INVALID_API_KEY: {
    message: "The API key is empty or invalid.",
    resolution:
      "Enter a valid API key for the selected provider. The provider selection is kept.",
  },
  AI_CALL_FAILED: {
    message: "The AI analysis could not be completed.",
    resolution:
      "Retry the AI request, or switch to Free mode. Free results are never substituted for AI results.",
  },
  NO_REQUIREMENTS: {
    message: "The job description did not contain analysable requirements.",
    resolution:
      "No score was produced. Try a job description that lists responsibilities or requirements.",
  },
  NO_EDITABLE_SECTIONS: {
    message: "No editable sections were found in the CV.",
    resolution:
      "Add a Professional Profile, Career Highlights, or Core Competencies section, then try again.",
  },
  EXPERIENCE_EDIT_REFUSED: {
    message:
      "A proposed change would modify the Professional Experience section, which cannot be edited.",
    resolution:
      "Professional Experience is preserved unchanged. Confine suggestions to the Profile, Highlights, or Competencies.",
  },
  UNVERIFIED_EVIDENCE: {
    message: "Some supplied evidence could not be verified against the CV.",
    resolution:
      "Only evidence supported by the uploaded CV can be included in edits.",
  },
  AGREEMENT_REQUIRED: {
    message: "The user agreement must be confirmed first.",
    resolution:
      "Confirm the user-agreement acknowledgement to view results or download documents.",
  },
  UNKNOWN_SESSION: {
    message: "This session is no longer available.",
    resolution: "Start a new session from the start screen and try again.",
  },
  RATE_LIMITED: {
    message: "Too many requests were made in a short time.",
    resolution: "Please wait a moment and try again.",
  },
};

/**
 * Construct an {@link AppError} for a code, using the canonical copy unless an
 * explicit message/resolution override is supplied.
 */
export function makeError(
  code: AppErrorCode,
  overrides?: Partial<Pick<AppError, "message" | "resolution">>
): AppError {
  const copy = ERROR_COPY[code];
  return {
    code,
    message: overrides?.message ?? copy.message,
    resolution: overrides?.resolution ?? copy.resolution,
  };
}

/** The set of valid error codes, for the structural guard. */
const VALID_CODES = new Set<string>(Object.keys(ERROR_COPY));

/**
 * Structural guard: is `value` a typed {@link AppError}? Accepts both plain
 * AppError objects and thrown Error subclasses (e.g. {@link AiCallFailedError})
 * that implement the AppError shape, as long as the `code` is a known code and
 * `message`/`resolution` are strings.
 */
export function isAppError(value: unknown): value is AppError {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Partial<AppError>;
  return (
    typeof v.code === "string" &&
    VALID_CODES.has(v.code) &&
    typeof v.message === "string" &&
    typeof v.resolution === "string"
  );
}

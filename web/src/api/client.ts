/**
 * Typed fetch wrapper for the Role-Match CV Tailor REST API.
 *
 * - Sends the `x-session-id` header on every request.
 * - Decodes typed `AppError` on non-2xx responses.
 * - No raw API key is ever passed through here — only the sessionId and
 *   provider-keyed validation call where the raw key travels once (POST
 *   /api/validate-key) and is immediately replaced in UI state with the
 *   masked form returned by the server.
 *
 * Requirements: 1.1, 3.1, 3.2, 11.4
 */

import type {
  AppError,
  AnalysisMode,
  MatchResult,
  ProposedEdit,
  Provider,
} from '../../../shared/types';
import type { DocumentMeta } from '../session/SessionContext';

// ---------------------------------------------------------------------------
// Base URL configuration
// ---------------------------------------------------------------------------

/**
 * Base URL for API requests. In production this is empty (Vite proxies
 * /api/* to Express). In tests we configure this to 'http://localhost' so
 * that relative paths resolve correctly in the Node/jsdom environment.
 */
let _baseUrl = '';

export function setApiBaseUrl(url: string): void {
  _baseUrl = url;
}

export function getApiBaseUrl(): string {
  return _baseUrl;
}

function resolveUrl(path: string): string {
  return `${_baseUrl}${path}`;
}

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

export class ApiClientError extends Error {
  readonly code: AppError['code'];
  readonly resolution: string;

  constructor(err: AppError) {
    super(err.message);
    this.name = 'ApiClientError';
    this.code = err.code;
    this.resolution = err.resolution;
  }
}

// ---------------------------------------------------------------------------
// Internal fetch helper
// ---------------------------------------------------------------------------

async function apiFetch<T>(
  path: string,
  sessionId: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'x-session-id': sessionId,
    ...(options.headers as Record<string, string> | undefined),
  };

  const response = await fetch(resolveUrl(path), { ...options, headers });

  if (!response.ok) {
    // Try to decode the typed error body.
    let errorBody: AppError | undefined;
    try {
      errorBody = (await response.json()) as AppError;
    } catch {
      // Fallback when body is not parseable JSON.
    }
    if (
      errorBody &&
      typeof errorBody.code === 'string' &&
      typeof errorBody.message === 'string'
    ) {
      throw new ApiClientError(errorBody);
    }
    // Generic fallback when no typed error is present.
    throw new ApiClientError({
      code: 'UNKNOWN_SESSION',
      message: `HTTP ${response.status}: ${response.statusText}`,
      resolution: 'Please start a new session and try again.',
    });
  }

  return response.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

export interface ResetSessionResponse {
  sessionId: string;
  state: {
    sessionId: string;
    mode: AnalysisMode | null;
    agreementConfirmed: boolean;
    downloadVersion: number;
  };
}

/** Create or reset a session. Returns the new sessionId and empty state. */
export async function resetSession(
  existingSessionId?: string
): Promise<ResetSessionResponse> {
  const id = existingSessionId ?? 'init';
  const response = await fetch(resolveUrl('/api/session/reset'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-session-id': id,
    },
    body: JSON.stringify(existingSessionId ? { sessionId: existingSessionId } : {}),
  });

  if (!response.ok) {
    let errorBody: AppError | undefined;
    try {
      errorBody = (await response.json()) as AppError;
    } catch {
      // ignore
    }
    if (errorBody && typeof errorBody.code === 'string') {
      throw new ApiClientError(errorBody);
    }
    throw new ApiClientError({
      code: 'UNKNOWN_SESSION',
      message: `Failed to reset session (HTTP ${response.status})`,
      resolution: 'Reload the application and try again.',
    });
  }

  return response.json() as Promise<ResetSessionResponse>;
}

// ---------------------------------------------------------------------------
// Key validation
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Agreement
// ---------------------------------------------------------------------------

export interface SetAgreementResponse {
  agreementConfirmed: boolean;
}

/** Confirm the user agreement on the backend session. */
export async function setAgreement(
  sessionId: string
): Promise<SetAgreementResponse> {
  return apiFetch<SetAgreementResponse>('/api/session/agreement', sessionId, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirmed: true }),
  });
}

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------

export interface UploadResponse {
  ok: boolean;
  kind: 'cv' | 'jd';
  parsed?: {
    sectionsDetected: boolean;
  };
  /** Present only when the warn-and-confirm gate reports detected personal data. */
  piiFindings?: {
    blockedTypes: string[];
    nameWarning: boolean;
  };
}

/**
 * Upload a CV or JD file. For CV uploads, the server runs the PII guard.
 * Pass `confirmName=true` when the user has explicitly confirmed the
 * name-warning dialog.
 */
export async function upload(
  sessionId: string,
  kind: 'cv' | 'jd',
  file: File,
  confirmPii?: boolean
): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('kind', kind);
  if (confirmPii) {
    formData.append('confirmPii', 'true');
  }

  const response = await fetch(resolveUrl('/api/upload'), {
    method: 'POST',
    headers: { 'x-session-id': sessionId },
    body: formData,
  });

  if (!response.ok) {
    let errorBody: AppError | undefined;
    try {
      errorBody = (await response.json()) as AppError;
    } catch {
      // ignore
    }
    if (errorBody && typeof errorBody.code === 'string') {
      throw new ApiClientError(errorBody);
    }
    throw new ApiClientError({
      code: 'FILE_UNREADABLE',
      message: `Upload failed (HTTP ${response.status})`,
      resolution: 'Check the file format and try again.',
    });
  }

  return response.json() as Promise<UploadResponse>;
}

// ---------------------------------------------------------------------------
// Analyze
// ---------------------------------------------------------------------------

export type AnalyzeResponse =
  | { result: MatchResult }
  | { noRequirements: true };

/** Trigger role-match analysis. The mode and uploaded content are in session. */
export async function analyze(sessionId: string): Promise<AnalyzeResponse> {
  return apiFetch<AnalyzeResponse>('/api/analyze', sessionId, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
}

// ---------------------------------------------------------------------------
// Tailor
// ---------------------------------------------------------------------------

export interface TailorResponse {
  edits: ProposedEdit[];
  unverified?: string[];
  noEditableSections?: boolean;
}

/** Generate tailoring proposed edits, optionally with user-supplied evidence. */
export async function tailor(
  sessionId: string,
  userEvidence?: string[]
): Promise<TailorResponse> {
  return apiFetch<TailorResponse>('/api/tailor', sessionId, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userEvidence }),
  });
}

// ---------------------------------------------------------------------------
// Downloads
// ---------------------------------------------------------------------------

/**
 * Download the tailored CV as a `.docx` blob.
 * Returns the Blob for the caller to trigger a browser download.
 */
export async function downloadCv(
  sessionId: string,
  acceptedEditIds: string[]
): Promise<Blob> {
  const response = await fetch(resolveUrl('/api/download/cv'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-session-id': sessionId,
    },
    body: JSON.stringify({ acceptedEditIds }),
  });

  if (!response.ok) {
    let errorBody: AppError | undefined;
    try {
      errorBody = (await response.json()) as AppError;
    } catch {
      // ignore
    }
    if (errorBody && typeof errorBody.code === 'string') {
      throw new ApiClientError(errorBody);
    }
    throw new ApiClientError({
      code: 'AGREEMENT_REQUIRED',
      message: `Download failed (HTTP ${response.status})`,
      resolution: 'Confirm the user agreement and try again.',
    });
  }

  return response.blob();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build DocumentMeta from an upload response + the original File. */
export function buildDocumentMeta(
  file: File,
  response: UploadResponse
): DocumentMeta {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const format = ext === 'docx' ? 'docx' : 'txt';
  return {
    kind: response.kind,
    filename: file.name,
    format,
    sectionsDetected: response.parsed?.sectionsDetected ?? false,
  };
}

// ---------------------------------------------------------------------------
// Session texts (for the copy-paste ChatGPT prompt bridge)
// ---------------------------------------------------------------------------

export interface SessionTextsResponse {
  cvText: string;
  jdText: string;
}

/** Fetch the session's own parsed CV/JD text to build the assessment prompt. */
export async function getSessionTexts(
  sessionId: string
): Promise<SessionTextsResponse> {
  return apiFetch<SessionTextsResponse>('/api/session/texts', sessionId, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
}

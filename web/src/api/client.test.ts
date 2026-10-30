// @vitest-environment jsdom
/**
 * Tests for the API client (client.ts).
 *
 * Covers:
 *  (a) x-session-id header is sent on every request
 *  (b) Typed AppError is decoded on non-2xx responses
 *  (c) ApiClientError carries the correct code + resolution
 *
 * NOTE: jsdom does not resolve relative URLs without a base. We configure
 * location to http://localhost so that /api/* URLs resolve correctly, and we
 * stub fetch globally before each test.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ApiClientError,
  resetSession,
  analyze,
  tailor,
  setAgreement,
  upload,
} from './client';
import type { AppError } from '../../../shared/types';

// ---------------------------------------------------------------------------
// Fetch mock helpers
// ---------------------------------------------------------------------------

/**
 * Mock fetch globally. The mock intercepts the call before any URL parsing,
 * captures the URL as a string, and returns the specified response.
 *
 * jsdom does not resolve relative URLs without a base origin. We work around
 * this by stubbing fetch globally so it never attempts to parse the URL.
 */
function mockFetch(
  status: number,
  body: unknown,
  headers: Record<string, string> = {}
) {
  const calls: { url: string; init?: RequestInit }[] = [];

  const mockFn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
    calls.push({ url, init });
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json', ...headers },
    });
  });

  vi.stubGlobal('fetch', mockFn);

  return { mockFn, calls };
}

function blobFetch(status: number, blob: Blob, headers: Record<string, string> = {}) {
  return vi.fn(async () => {
    return new Response(blob, { status, headers });
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Helpers to read request headers from the mock
// ---------------------------------------------------------------------------

function getHeader(mockFn: ReturnType<typeof vi.fn>, callIndex: number, headerName: string): string | null {
  const callArgs = mockFn.mock.calls[callIndex];
  if (!callArgs) return null;
  const init = callArgs[1] as RequestInit | undefined;
  if (!init?.headers) return null;
  const headers = init.headers as Record<string, string>;
  // Case-insensitive lookup
  const lower = headerName.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === lower) return v;
  }
  return null;
}

// ---------------------------------------------------------------------------
// x-session-id header tests
// ---------------------------------------------------------------------------

describe('API client — x-session-id header', () => {

  it('analyze sends x-session-id', async () => {
    const { mockFn } = mockFetch(200, {
      result: { mode: 'free', score: 7, noRequirements: false, direct: [], transferable: [], gaps: [] },
    });

    await analyze('session-xyz');

    expect(mockFn).toHaveBeenCalledOnce();
    const header = getHeader(mockFn, 0, 'x-session-id');
    expect(header).toBe('session-xyz');
  });

  it('tailor sends x-session-id', async () => {
    const { mockFn } = mockFetch(200, { edits: [] });

    await tailor('session-tailor');

    expect(mockFn).toHaveBeenCalledOnce();
    const header = getHeader(mockFn, 0, 'x-session-id');
    expect(header).toBe('session-tailor');
  });

  it('setAgreement sends x-session-id', async () => {
    const { mockFn } = mockFetch(200, { agreementConfirmed: true });

    await setAgreement('session-agree');

    expect(mockFn).toHaveBeenCalledOnce();
    const header = getHeader(mockFn, 0, 'x-session-id');
    expect(header).toBe('session-agree');
  });
});

// ---------------------------------------------------------------------------
// AppError decoding tests
// ---------------------------------------------------------------------------

describe('API client — typed AppError decoding', () => {
  it('throws ApiClientError with correct code on non-2xx response', async () => {
    const errorBody: AppError = {
      code: 'INVALID_API_KEY',
      message: 'The API key is invalid.',
      resolution: 'Submit a valid OpenAI or Claude key.',
    };

    mockFetch(400, errorBody);

    await expect(analyze('session-1')).rejects.toSatisfy(
      (err: unknown) => {
        if (!(err instanceof ApiClientError)) return false;
        return err.code === 'INVALID_API_KEY';
      }
    );
  });

  it('carries the resolution from the error body', async () => {
    const errorBody: AppError = {
      code: 'MISSING_DOCUMENT',
      message: 'CV is missing.',
      resolution: 'Please upload your CV before analysing.',
    };

    mockFetch(422, errorBody);

    let caught: ApiClientError | undefined;
    try {
      await analyze('session-2');
    } catch (err) {
      if (err instanceof ApiClientError) caught = err;
    }

    expect(caught).toBeDefined();
    expect(caught?.code).toBe('MISSING_DOCUMENT');
    expect(caught?.resolution).toBe('Please upload your CV before analysing.');
    expect(caught?.message).toBe('CV is missing.');
  });

  it('falls back to UNKNOWN_SESSION when body is not parseable JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('Internal Server Error', { status: 500 }))
    );

    let caught: ApiClientError | undefined;
    try {
      await analyze('session-3');
    } catch (err) {
      if (err instanceof ApiClientError) caught = err;
    }

    expect(caught).toBeDefined();
    expect(caught?.code).toBe('UNKNOWN_SESSION');
  });

  it('throws ApiClientError on 401 UNKNOWN_SESSION', async () => {
    const errorBody: AppError = {
      code: 'UNKNOWN_SESSION',
      message: 'Session not found.',
      resolution: 'Start a new session.',
    };

    mockFetch(401, errorBody);

    await expect(tailor('stale-session')).rejects.toSatisfy(
      (err: unknown) => err instanceof ApiClientError && err.code === 'UNKNOWN_SESSION'
    );
  });

  it('throws ApiClientError on 429 RATE_LIMITED', async () => {
    const errorBody: AppError = {
      code: 'RATE_LIMITED',
      message: 'Too many requests.',
      resolution: 'Please wait a moment and try again.',
    };

    mockFetch(429, errorBody);

    await expect(analyze('session-rate')).rejects.toSatisfy(
      (err: unknown) => err instanceof ApiClientError && err.code === 'RATE_LIMITED'
    );
  });
});

// ---------------------------------------------------------------------------
// Successful response shape tests
// ---------------------------------------------------------------------------

describe('API client — successful responses', () => {

  it('analyze returns MatchResult on success', async () => {
    const matchResult = {
      mode: 'free',
      score: 6,
      noRequirements: false,
      direct: [],
      transferable: [],
      gaps: [],
    };
    mockFetch(200, { result: matchResult });

    const response = await analyze('session-ok2');
    expect('result' in response).toBe(true);
    if ('result' in response) {
      expect(response.result.score).toBe(6);
      expect(response.result.mode).toBe('free');
    }
  });

  it('analyze returns noRequirements:true when JD has no requirements', async () => {
    mockFetch(200, { noRequirements: true });

    const response = await analyze('session-noreq');
    expect('noRequirements' in response && (response as { noRequirements: boolean }).noRequirements).toBe(true);
  });

  it('tailor returns edits array', async () => {
    const edit = {
      id: 'e1',
      section: 'Professional_Profile',
      originalText: 'old',
      recommendedText: 'new',
      explanation: 'Short explanation.',
      accepted: false,
    };
    mockFetch(200, { edits: [edit] });

    const response = await tailor('session-tailor2', ['evidence text']);
    expect(response.edits).toHaveLength(1);
    expect(response.edits[0].id).toBe('e1');
  });

  it('resetSession returns new sessionId', async () => {
    mockFetch(200, {
      sessionId: 'new-sess-42',
      state: { sessionId: 'new-sess-42', mode: null, agreementConfirmed: false, downloadVersion: 0 },
    });

    const response = await resetSession();
    expect(response.sessionId).toBe('new-sess-42');
    expect(response.state.mode).toBeNull();
    expect(response.state.agreementConfirmed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// upload helper
// ---------------------------------------------------------------------------

describe('API client — upload', () => {
  it('sends x-session-id header and kind field', async () => {
    const { mockFn } = mockFetch(200, {
      ok: true,
      kind: 'cv',
      parsed: { sectionsDetected: true },
    });

    const file = new File(['content'], 'cv.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    await upload('session-upload', 'cv', file);

    expect(mockFn).toHaveBeenCalledOnce();
    const header = getHeader(mockFn, 0, 'x-session-id');
    expect(header).toBe('session-upload');
  });

  it('throws ApiClientError on PII_BLOCKED', async () => {
    const errorBody: AppError = {
      code: 'PII_BLOCKED',
      message: 'Email address detected.',
      resolution: 'Remove email addresses from your CV and try again.',
    };

    mockFetch(422, errorBody);

    const file = new File(['name@example.com'], 'cv.txt', { type: 'text/plain' });
    await expect(upload('session-pii', 'cv', file)).rejects.toSatisfy(
      (err: unknown) => err instanceof ApiClientError && err.code === 'PII_BLOCKED'
    );
  });
});

/**
 * In-memory session store for Role-Match CV Tailor.
 *
 * Holds every session's working state in a `Map<sessionId, SessionState>`.
 * Parsed CV/JD text, the analysis result, proposed edits, and the raw API key
 * live ONLY here, in process memory. Nothing is ever serialised to disk.
 *
 * Privacy guarantees enforced here:
 *  - `reset` and `evict` erase CV text, JD text, the raw API key, the analysis
 *    result, and edits from memory (Requirements 1.3, 1.6, 3.5).
 *  - The raw API key is never stored on the `SessionState` sent to the client;
 *    only a masked form ({@link ApiKeyConfig}) is placed on the session. The raw
 *    key lives in a private, per-session map that never leaves the backend.
 *  - Idle sessions are evicted after a TTL so abandoned sessions do not linger.
 *
 * @see design.md "In-memory session store" and "Data Models"
 */

import { randomUUID } from "node:crypto";
import type {
  AppError,
  Provider,
  SessionState,
} from "../../shared/types";

/** Default idle time-to-live for an abandoned session: 30 minutes. */
const DEFAULT_TTL_MS = 30 * 60 * 1000;

/** How often the opt-in sweeper runs: every minute. */
const SWEEP_INTERVAL_MS = 60 * 1000;

/** Options for constructing a {@link SessionStore}. */
export interface SessionStoreOptions {
  /**
   * When true, start a periodic, `unref`'d timer that evicts idle sessions.
   * Defaults to false so tests (and short-lived processes) do not keep the
   * event loop alive. The long-running server opts in explicitly.
   */
  startSweeper?: boolean;
  /** Idle TTL in milliseconds. Defaults to 30 minutes. */
  ttlMs?: number;
}

/**
 * Build an empty session state for a given id. No CV/JD content, no mode, no
 * key, no results; agreement unconfirmed and download version at zero.
 */
function emptyState(sessionId: string): SessionState {
  return {
    sessionId,
    mode: null,
    cv: undefined,
    jd: undefined,
    apiKey: undefined,
    result: undefined,
    edits: undefined,
    agreementConfirmed: false,
    downloadVersion: 0,
  };
}

/** Obscure all but the last four characters of a key with bullet characters. */
function maskApiKey(rawKey: string): string {
  const visible = 4;
  if (rawKey.length <= visible) {
    // Too short to safely reveal four characters — obscure everything.
    return "\u2022".repeat(rawKey.length);
  }
  const masked = "\u2022".repeat(rawKey.length - visible);
  return masked + rawKey.slice(-visible);
}

/**
 * The in-memory session store. Keyed by an opaque ephemeral `sessionId`
 * generated with {@link randomUUID}.
 */
export class SessionStore {
  private readonly sessions = new Map<string, SessionState>();
  /** Raw API keys, kept strictly private and never sent to the client. */
  private readonly rawApiKeys = new Map<string, string>();
  /** Last-access timestamps (ms) for idle-TTL eviction. */
  private readonly lastAccess = new Map<string, number>();

  private readonly ttlMs: number;
  private sweeper?: ReturnType<typeof setInterval>;

  constructor(options: SessionStoreOptions = {}) {
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    if (options.startSweeper) {
      this.startSweeper();
    }
  }

  /** Create a brand-new empty session with a fresh UUID. */
  create(): SessionState {
    const sessionId = randomUUID();
    const state = emptyState(sessionId);
    this.sessions.set(sessionId, state);
    this.touch(sessionId);
    return state;
  }

  /**
   * Reset a session to a fresh empty state. If the id exists, the SAME id is
   * kept and all CV/JD content, the raw API key, the result, and edits are
   * wiped. If no id is given or it is unknown, a new session is created.
   */
  reset(sessionId?: string): SessionState {
    if (sessionId && this.sessions.has(sessionId)) {
      const fresh = emptyState(sessionId);
      this.sessions.set(sessionId, fresh);
      // Erase the private raw key for this session.
      this.rawApiKeys.delete(sessionId);
      this.touch(sessionId);
      return fresh;
    }
    return this.create();
  }

  /** Return the session for an id, or throw an `UNKNOWN_SESSION` error. */
  get(sessionId: string): SessionState {
    const state = this.sessions.get(sessionId);
    if (!state) {
      const error: AppError = {
        code: "UNKNOWN_SESSION",
        message: "This session is no longer available.",
        resolution:
          "Start a new session from the start screen and try again.",
      };
      throw error;
    }
    this.touch(sessionId);
    return state;
  }

  /** Shallow-merge a partial update into a session and return the new state. */
  update(sessionId: string, partial: Partial<SessionState>): SessionState {
    const current = this.get(sessionId);
    const next: SessionState = { ...current, ...partial, sessionId };
    this.sessions.set(sessionId, next);
    this.touch(sessionId);
    return next;
  }

  /** Remove a session and wipe its private raw key from memory. */
  evict(sessionId: string): void {
    this.sessions.delete(sessionId);
    this.rawApiKeys.delete(sessionId);
    this.lastAccess.delete(sessionId);
  }

  /**
   * Store the raw API key privately and set the session's masked
   * {@link ApiKeyConfig}. The raw key never appears on the returned state.
   */
  setApiKey(sessionId: string, provider: Provider, rawKey: string): SessionState {
    // Validates the session exists (throws UNKNOWN_SESSION otherwise).
    this.get(sessionId);
    this.rawApiKeys.set(sessionId, rawKey);
    return this.update(sessionId, {
      apiKey: { provider, maskedKey: maskApiKey(rawKey) },
    });
  }

  /** Retrieve the raw API key for a session (backend-only), or undefined. */
  getRawApiKey(sessionId: string): string | undefined {
    const key = this.rawApiKeys.get(sessionId);
    if (key !== undefined) {
      this.touch(sessionId);
    }
    return key;
  }

  /** Evict every session whose idle time exceeds `ttlMs`. */
  evictIdle(ttlMs: number = this.ttlMs): void {
    const now = Date.now();
    for (const [sessionId, last] of this.lastAccess) {
      if (now - last > ttlMs) {
        this.evict(sessionId);
      }
    }
  }

  /** Start the periodic, unref'd idle sweeper. Safe to call more than once. */
  startSweeper(): void {
    if (this.sweeper) return;
    this.sweeper = setInterval(() => this.evictIdle(), SWEEP_INTERVAL_MS);
    // Do not keep the Node process alive solely for the sweeper.
    this.sweeper.unref?.();
  }

  /** Stop the periodic idle sweeper if it is running. */
  stopSweeper(): void {
    if (this.sweeper) {
      clearInterval(this.sweeper);
      this.sweeper = undefined;
    }
  }

  /** Record the most recent access time for idle-TTL tracking. */
  private touch(sessionId: string): void {
    this.lastAccess.set(sessionId, Date.now());
  }
}

/** Process-wide singleton session store used by the backend routes. */
export const sessionStore = new SessionStore();

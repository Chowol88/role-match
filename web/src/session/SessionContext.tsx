/**
 * SessionContext — React context + useReducer that mirrors the backend
 * SessionState for the front-end wizard.
 *
 * IMPORTANT: the raw API key is NEVER stored here. Only the masked form
 * returned by the backend (e.g. "••••••••3f9a") is kept in state.
 * The raw key is only ever held briefly in a controlled input before being
 * sent to POST /api/validate-key; the component is responsible for clearing
 * the raw value once the call returns.
 *
 * Requirements: 1.1, 3.1, 3.2, 11.4
 */

import React, {
  createContext,
  useContext,
  useReducer,
  type ReactNode,
  type Dispatch,
} from 'react';
import type {
  AnalysisMode,
  ApiKeyConfig,
  MatchResult,
  ProposedEdit,
  Provider,
} from '../../../shared/types';
import { getSample, type SampleId } from '../samples/sampleData';

// ---------------------------------------------------------------------------
// Client-side session state
// ---------------------------------------------------------------------------

/** Lightweight metadata stored after a successful upload. */
export interface DocumentMeta {
  kind: 'cv' | 'jd';
  filename: string;
  format: 'docx' | 'txt' | 'pdf';
  /** Whether the server detected any sections (meaningful for CVs). */
  sectionsDetected: boolean;
}

/**
 * Front-end mirror of SessionState. Note: cv/jd content is NEVER held here —
 * only upload metadata (filename, format) to drive UI state.
 */
export interface ClientSessionState {
  sessionId: string | null;
  mode: AnalysisMode | null;
  /** Masked key config — raw key is NEVER stored. */
  apiKey: ApiKeyConfig | null;
  cvMeta: DocumentMeta | null;
  jdMeta: DocumentMeta | null;
  result: MatchResult | null;
  edits: ProposedEdit[];
  agreementConfirmed: boolean;
  downloadVersion: number;
  /** The bundled demo sample the user picked (concept demo). */
  selectedSample: SampleId | null;
}

const initialState: ClientSessionState = {
  sessionId: null,
  mode: null,
  apiKey: null,
  cvMeta: null,
  jdMeta: null,
  result: null,
  edits: [],
  agreementConfirmed: false,
  downloadVersion: 0,
  selectedSample: null,
};

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export type SessionAction =
  | { type: 'SET_SESSION_ID'; sessionId: string }
  | { type: 'SET_MODE'; mode: AnalysisMode }
  /**
   * Store only the masked form of the key — never the raw value.
   * Called after a successful POST /api/validate-key.
   */
  | { type: 'SET_MASKED_KEY'; provider: Provider; maskedKey: string }
  | { type: 'SET_DOCUMENT_UPLOADED'; meta: DocumentMeta }
  | { type: 'SET_ANALYSIS_RESULT'; result: MatchResult }
  | { type: 'SET_PROPOSED_EDITS'; edits: ProposedEdit[] }
  /** Toggle accept/reject for a single edit by id. */
  | { type: 'TOGGLE_EDIT_ACCEPTED'; id: string }
  | { type: 'SET_AGREEMENT_CONFIRMED'; confirmed: boolean }
  | { type: 'INCREMENT_DOWNLOAD_VERSION' }
  /** Pick a bundled demo sample; loads its pre-authored result + edits. */
  | { type: 'SELECT_SAMPLE'; sampleId: SampleId }
  /** Full reset — clears everything and returns to blank state. */
  | { type: 'RESET' };

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function sessionReducer(
  state: ClientSessionState,
  action: SessionAction
): ClientSessionState {
  switch (action.type) {
    case 'SET_SESSION_ID':
      return { ...state, sessionId: action.sessionId };

    case 'SET_MODE':
      return { ...state, mode: action.mode };

    case 'SET_MASKED_KEY':
      // Only the masked form is persisted — raw key is never in state.
      return {
        ...state,
        apiKey: { provider: action.provider, maskedKey: action.maskedKey },
      };

    case 'SET_DOCUMENT_UPLOADED':
      if (action.meta.kind === 'cv') {
        return { ...state, cvMeta: action.meta };
      }
      return { ...state, jdMeta: action.meta };

    case 'SET_ANALYSIS_RESULT':
      return { ...state, result: action.result };

    case 'SET_PROPOSED_EDITS':
      return { ...state, edits: action.edits };

    case 'TOGGLE_EDIT_ACCEPTED':
      return {
        ...state,
        edits: state.edits.map((edit) =>
          edit.id === action.id
            ? { ...edit, accepted: !edit.accepted }
            : edit
        ),
      };

    case 'SET_AGREEMENT_CONFIRMED':
      return { ...state, agreementConfirmed: action.confirmed };

    case 'INCREMENT_DOWNLOAD_VERSION':
      return { ...state, downloadVersion: state.downloadVersion + 1 };

    case 'SELECT_SAMPLE': {
      const sample = getSample(action.sampleId);
      return {
        ...state,
        selectedSample: action.sampleId,
        // Load the pre-authored assessment and a fresh (all-unaccepted) copy
        // of the tailor edits so the before/after table renders them.
        result: sample.result,
        edits: sample.edits.map((e) => ({ ...e, accepted: false })),
      };
    }

    case 'RESET':
      // Erase everything — sessionId included so the next session starts fresh.
      return { ...initialState };

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface SessionContextValue {
  state: ClientSessionState;
  dispatch: Dispatch<SessionAction>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface SessionProviderProps {
  children: ReactNode;
}

export function SessionProvider({ children }: SessionProviderProps) {
  const [state, dispatch] = useReducer(sessionReducer, initialState);

  return (
    <SessionContext.Provider value={{ state, dispatch }}>
      {children}
    </SessionContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/** Consume the session context. Must be used inside <SessionProvider>. */
export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return ctx;
}

// Export the context itself for tests that need to provide a custom value.
export { SessionContext };
export type { SessionContextValue };

/**
 * ErrorBanner — displays a typed AppError with a non-colour-only warning
 * indicator and maps each error code to user-friendly copy.
 *
 * Requirements: 11.4, 11.5
 */

import type { AppError, AppErrorCode } from '../../../shared/types';

interface ErrorBannerProps {
  error: AppError;
  /** Optional additional CSS class names. */
  className?: string;
  /** Called when the user dismisses the banner, if dismissal is supported. */
  onDismiss?: () => void;
}

/**
 * Human-readable labels for each error code.
 * The `message` and `resolution` in AppError come from the backend, but
 * we supplement with a short user-facing title here for clarity.
 */
const ERROR_TITLES: Record<AppErrorCode, string> = {
  MISSING_DOCUMENT: 'Missing document',
  UNSUPPORTED_FORMAT: 'Unsupported file format',
  FILE_TOO_LARGE: 'File too large',
  FILE_UNREADABLE: 'File could not be read',
  PII_BLOCKED: 'Personal information detected',
  NAME_WARNING: 'Name detected',
  INVALID_API_KEY: 'Invalid API key',
  AI_CALL_FAILED: 'AI analysis failed',
  NO_REQUIREMENTS: 'No requirements found',
  NO_EDITABLE_SECTIONS: 'No editable sections found',
  EXPERIENCE_EDIT_REFUSED: 'Experience section cannot be edited',
  UNVERIFIED_EVIDENCE: 'Evidence could not be verified',
  AGREEMENT_REQUIRED: 'Agreement required',
  UNKNOWN_SESSION: 'Session not found',
  RATE_LIMITED: 'Too many requests',
};

/** Whether the error is a warning (warn-only, not a hard block). */
const IS_WARNING: Partial<Record<AppErrorCode, boolean>> = {
  NAME_WARNING: true,
  UNVERIFIED_EVIDENCE: true,
};

export function ErrorBanner({ error, className = '', onDismiss }: ErrorBannerProps) {
  const isWarning = IS_WARNING[error.code] ?? false;
  const title = ERROR_TITLES[error.code] ?? 'Error';

  const accentColor = isWarning ? '#d97706' : '#b91c1c';
  const bgColor = isWarning ? '#fffbeb' : '#fef2f2';
  const borderColor = isWarning ? '#fbbf24' : '#fca5a5';
  const textColor = isWarning ? '#78350f' : '#7f1d1d';

  // Non-colour-only indicators: icon + text label changes between warning/error
  const icon = isWarning ? '⚠️' : '⛔';
  const roleLabel = isWarning ? 'warning' : 'error';

  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-label={`${roleLabel}: ${title}`}
      className={`error-banner error-banner--${isWarning ? 'warning' : 'error'} ${className}`.trim()}
      style={{
        display: 'flex',
        gap: '0.75rem',
        padding: '0.875rem 1rem',
        borderRadius: '0.5rem',
        border: `1.5px solid ${borderColor}`,
        background: bgColor,
        color: textColor,
      }}
    >
      {/* Non-colour-only indicator: distinct icon for warning vs error */}
      <span
        aria-hidden="true"
        style={{ fontSize: '1.25rem', lineHeight: 1, flexShrink: 0, marginTop: '0.1rem' }}
      >
        {icon}
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Code badge — non-colour-only extra indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
          <span
            aria-hidden="true"
            style={{
              display: 'inline-block',
              fontSize: '0.7rem',
              fontWeight: 700,
              padding: '0.1rem 0.4rem',
              borderRadius: '0.25rem',
              background: accentColor,
              color: '#fff',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              flexShrink: 0,
            }}
          >
            {isWarning ? 'Warning' : 'Error'}
          </span>
          <strong
            style={{ fontSize: '0.9375rem', color: textColor }}
          >
            {title}
          </strong>
          {/* Error code for technical reference */}
          <code
            style={{
              fontSize: '0.75rem',
              color: accentColor,
              opacity: 0.7,
              marginLeft: 'auto',
            }}
          >
            {error.code}
          </code>
        </div>

        {/* Message */}
        <p style={{ margin: '0 0 0.375rem', fontSize: '0.875rem' }}>
          {error.message}
        </p>

        {/* Resolution guidance */}
        {error.resolution && (
          <p
            style={{
              margin: 0,
              fontSize: '0.8125rem',
              opacity: 0.9,
              fontStyle: 'italic',
            }}
          >
            What to do: {error.resolution}
          </p>
        )}
      </div>

      {/* Dismiss button */}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={`Dismiss ${roleLabel}: ${title}`}
          style={{
            alignSelf: 'flex-start',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: accentColor,
            fontSize: '1.125rem',
            lineHeight: 1,
            padding: '0.125rem',
            borderRadius: '0.25rem',
            flexShrink: 0,
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
}

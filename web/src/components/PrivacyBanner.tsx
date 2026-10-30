/**
 * PrivacyBanner — reusable privacy assurance banner.
 *
 * Displayed on the start screen and the upload step to reiterate that
 * uploaded CV and JD files are never saved (Requirements 1.2, 1.5, 4.9).
 * Must be reachable in the accessibility tree and by keyboard/screen-reader.
 */

interface PrivacyBannerProps {
  /** Optional additional CSS class names. */
  className?: string;
  /**
   * Variant controls the icon and copy emphasis.
   * "start" — full assurance on the landing screen.
   * "upload" — shorter reiteration on the upload step.
   */
  variant?: 'start' | 'upload';
}

import { tokens as t } from '../theme/tokens';

export function PrivacyBanner({
  className = '',
  variant = 'start',
}: PrivacyBannerProps) {
  const isStart = variant === 'start';

  return (
    <aside
      role="note"
      aria-label="Privacy assurance"
      className={`privacy-banner privacy-banner--${variant} ${className}`.trim()}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem',
        padding: '0.875rem 1.125rem',
        borderRadius: t.radius.md,
        border: `1px solid ${t.colour.success}`,
        background: t.colour.successSoft,
        color: t.colour.successText,
      }}
    >
      {/* Non-colour-only indicator: icon + text (Requirement 2.2 cross-ref) */}
      <span
        aria-hidden="true"
        style={{ fontSize: '1.25rem', lineHeight: 1, flexShrink: 0 }}
      >
        🔒
      </span>
      <div>
        {isStart ? (
          <>
            <p style={{ margin: 0, fontWeight: t.font.weight.bold, fontSize: t.font.size.body }}>
              Privacy-first by design
            </p>
            <p style={{ margin: '0.25rem 0 0', fontSize: t.font.size.small, lineHeight: 1.6 }}>
              This preview runs on prepared example materials only — it does not
              take or process your own CV. RoleFit is designed to keep document
              handling in-session rather than building a stored profile.
            </p>
          </>
        ) : (
          <p style={{ margin: 0, fontSize: t.font.size.small, lineHeight: 1.6 }}>
            <strong>Reminder:</strong> this preview uses prepared example
            materials only and does not take your own CV. RoleFit is designed to
            handle documents in-session rather than build a stored profile.
          </p>
        )}
      </div>
    </aside>
  );
}

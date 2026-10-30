/**
 * EvidenceTable — renders the Direct/Transferable/Gap evidence breakdown.
 *
 * Each of the three sections shows a labelled list (or "none found" fallback).
 * Requirements: 6.3, 6.4, 6.5, 11.2
 */

import type { EvidenceItem } from '../../../shared/types';
import { tokens as t } from '../theme/tokens';

interface EvidenceTableProps {
  direct: EvidenceItem[];
  transferable: EvidenceItem[];
  gaps: EvidenceItem[];
  /** Optional additional CSS class names. */
  className?: string;
}

export function EvidenceTable({
  direct,
  transferable,
  gaps,
  className = '',
}: EvidenceTableProps) {
  return (
    <div
      className={`evidence-table ${className}`.trim()}
      role="region"
      aria-label="Role-match evidence breakdown"
    >
      <EvidenceSection
        title="Direct Evidence"
        description="JD requirements explicitly demonstrated in your CV."
        items={direct}
        type="direct"
        noneFoundMessage="No direct evidence found for the extracted requirements."
      />
      <EvidenceSection
        title="Transferable Evidence"
        description="Genuine capabilities from a related context that map to a JD requirement."
        items={transferable}
        type="transferable"
        noneFoundMessage="No transferable evidence found."
      />
      <EvidenceSection
        title="Gaps"
        description="JD requirements for which your CV does not establish direct or equivalent experience."
        items={gaps}
        type="gap"
        noneFoundMessage="No gaps identified — strong coverage across all requirements."
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Internal section component
// ---------------------------------------------------------------------------

interface EvidenceSectionProps {
  title: string;
  description: string;
  items: EvidenceItem[];
  type: 'direct' | 'transferable' | 'gap';
  noneFoundMessage: string;
}

const SECTION_STYLES: Record<
  'direct' | 'transferable' | 'gap',
  { border: string; headerBg: string; headerColor: string; icon: string }
> = {
  direct: {
    border: t.colour.success,
    headerBg: t.colour.successSoft,
    headerColor: t.colour.successText,
    icon: '✅',
  },
  transferable: {
    border: t.colour.transfer,
    headerBg: t.colour.transferSoft,
    headerColor: t.colour.transferText,
    icon: '↔️',
  },
  gap: {
    border: t.colour.gap,
    headerBg: t.colour.gapSoft,
    headerColor: t.colour.gapText,
    icon: '⚠️',
  },
};

function EvidenceSection({
  title,
  description,
  items,
  type,
  noneFoundMessage,
}: EvidenceSectionProps) {
  const styles = SECTION_STYLES[type];
  const sectionId = `evidence-section-${type}`;

  return (
    <section
      aria-labelledby={sectionId}
      style={{
        marginBottom: t.space.md,
        border: `1px solid ${t.colour.border}`,
        borderLeft: `4px solid ${styles.border}`,
        borderRadius: t.radius.md,
        overflow: 'hidden',
        background: t.colour.surface,
        boxShadow: t.shadow.sm,
      }}
    >
      {/* Header — non-colour-only: icon + text label */}
      <header
        style={{
          background: styles.headerBg,
          padding: '0.625rem 1rem',
          borderBottom: `1px solid ${styles.border}`,
        }}
      >
        <h3
          id={sectionId}
          style={{
            margin: 0,
            fontSize: '1rem',
            fontWeight: 700,
            color: styles.headerColor,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <span aria-hidden="true">{styles.icon}</span>
          {title}
          <span
            aria-label={`${items.length} item${items.length !== 1 ? 's' : ''}`}
            style={{
              marginLeft: 'auto',
              fontSize: '0.75rem',
              fontWeight: 400,
              padding: '0.125rem 0.5rem',
              borderRadius: '9999px',
              background: 'rgba(0,0,0,0.08)',
            }}
          >
            {items.length}
          </span>
        </h3>
        <p
          style={{
            margin: '0.25rem 0 0',
            fontSize: '0.8125rem',
            color: styles.headerColor,
            opacity: 0.85,
          }}
        >
          {description}
        </p>
      </header>

      {/* Body */}
      <div style={{ padding: '0.75rem 1rem' }}>
        {items.length === 0 ? (
          /* "none found" fallback — Requirement 6.3, 6.4, 6.5 */
          <p
            role="status"
            aria-live="polite"
            style={{
              margin: 0,
              fontSize: '0.875rem',
              color: '#6b7280',
              fontStyle: 'italic',
            }}
          >
            {noneFoundMessage}
          </p>
        ) : (
          <ul
            aria-label={`${title} list`}
            style={{ margin: 0, padding: '0 0 0 1.25rem' }}
          >
            {items.map((item) => (
              <li
                key={item.requirementId}
                style={{ marginBottom: '0.75rem', fontSize: '0.9rem' }}
              >
                <strong style={{ display: 'block', marginBottom: '0.2rem' }}>
                  {item.requirementText}
                </strong>
                {item.cvEvidence && (
                  <span
                    style={{
                      display: 'block',
                      color: '#374151',
                      fontSize: '0.875rem',
                    }}
                  >
                    CV evidence:{' '}
                    <em style={{ color: '#6b7280' }}>{item.cvEvidence}</em>
                  </span>
                )}
                {item.section && (
                  <span
                    style={{
                      display: 'inline-block',
                      fontSize: '0.75rem',
                      color: '#9ca3af',
                      marginTop: '0.125rem',
                    }}
                  >
                    Section: {item.section.replace(/_/g, ' ')}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

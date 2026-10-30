/**
 * BeforeAfterTable — renders proposed CV edits as before/after comparisons
 * with per-edit Accept/Reject controls.
 *
 * Each row shows:
 *   - Original text
 *   - Recommended text
 *   - ≤ 2-sentence explanation
 *   - Accept / Reject buttons with ARIA labels
 *
 * Requirements: 7.13, 7.14, 11.2, 14.4
 */

import type { ProposedEdit } from '../../../shared/types';
import { tokens as t } from '../theme/tokens';

interface BeforeAfterTableProps {
  edits: ProposedEdit[];
  /** Called when the user toggles accept/reject on an edit. */
  onToggle: (id: string) => void;
  /** Optional additional CSS class names. */
  className?: string;
}

export function BeforeAfterTable({
  edits,
  onToggle,
  className = '',
}: BeforeAfterTableProps) {
  if (edits.length === 0) {
    return (
      <p
        role="status"
        aria-live="polite"
        style={{ color: '#6b7280', fontStyle: 'italic' }}
      >
        No proposed edits.
      </p>
    );
  }

  return (
    <div
      className={`before-after-table ${className}`.trim()}
      style={{
        border: `1px solid ${t.colour.border}`,
        borderRadius: t.radius.md,
        overflow: 'hidden',
        background: t.colour.surface,
        boxShadow: t.shadow.sm,
      }}
    >
      <table
        style={{ width: '100%', borderCollapse: 'collapse', fontSize: t.font.size.body }}
        aria-label="Proposed CV edits"
      >
        <thead>
          <tr>
            <th
              scope="col"
              style={{
                textAlign: 'left',
                padding: '0.5rem 0.75rem',
                background: t.colour.surfaceAlt,
                borderBottom: `2px solid ${t.colour.border}`,
                fontWeight: 700,
                color: t.colour.textMuted,
                textTransform: 'uppercase',
                fontSize: t.font.size.caption,
                letterSpacing: '0.06em',
                width: '35%',
              }}
            >
              Original
            </th>
            <th
              scope="col"
              style={{
                textAlign: 'left',
                padding: '0.5rem 0.75rem',
                background: t.colour.surfaceAlt,
                borderBottom: `2px solid ${t.colour.border}`,
                fontWeight: 700,
                color: t.colour.textMuted,
                textTransform: 'uppercase',
                fontSize: t.font.size.caption,
                letterSpacing: '0.06em',
                width: '35%',
              }}
            >
              Recommended
            </th>
            <th
              scope="col"
              style={{
                textAlign: 'left',
                padding: '0.5rem 0.75rem',
                background: t.colour.surfaceAlt,
                borderBottom: `2px solid ${t.colour.border}`,
                fontWeight: 700,
                color: t.colour.textMuted,
                textTransform: 'uppercase',
                fontSize: t.font.size.caption,
                letterSpacing: '0.06em',
                width: '20%',
              }}
            >
              Explanation
            </th>
            <th
              scope="col"
              style={{
                textAlign: 'center',
                padding: '0.5rem 0.75rem',
                background: t.colour.surfaceAlt,
                borderBottom: `2px solid ${t.colour.border}`,
                fontWeight: 700,
                color: t.colour.textMuted,
                textTransform: 'uppercase',
                fontSize: t.font.size.caption,
                letterSpacing: '0.06em',
                width: '10%',
              }}
            >
              Decision
            </th>
          </tr>
        </thead>
        <tbody>
          {edits.map((edit, index) => (
            <EditRow
              key={edit.id}
              edit={edit}
              rowIndex={index + 1}
              onToggle={onToggle}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Internal row component
// ---------------------------------------------------------------------------

interface EditRowProps {
  edit: ProposedEdit;
  rowIndex: number;
  onToggle: (id: string) => void;
}

function EditRow({ edit, rowIndex, onToggle }: EditRowProps) {
  const isAccepted = edit.accepted;

  return (
    <tr
      style={{
        background: isAccepted ? t.colour.successSoft : undefined,
        borderBottom: `1px solid ${t.colour.border}`,
      }}
      aria-label={`Edit ${rowIndex} — ${edit.section.replace(/_/g, ' ')} — ${isAccepted ? 'accepted' : 'not accepted'}`}
    >
      {/* Original text */}
      <td
        style={{
          padding: '0.75rem',
          verticalAlign: 'top',
          borderRight: `1px solid ${t.colour.border}`,
        }}
      >
        <span
          style={{
            display: 'block',
            fontSize: t.font.size.caption,
            fontWeight: 600,
            color: t.colour.textFaint,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            marginBottom: '0.25rem',
          }}
        >
          {edit.section.replace(/_/g, ' ')}
        </span>
        <p style={{ margin: 0, color: t.colour.textMuted }}>{edit.originalText}</p>
      </td>

      {/* Recommended text */}
      <td
        style={{
          padding: '0.75rem',
          verticalAlign: 'top',
          borderRight: `1px solid ${t.colour.border}`,
        }}
      >
        <p style={{ margin: 0, color: t.colour.successText, fontWeight: 600 }}>
          {edit.recommendedText}
        </p>
      </td>

      {/* Explanation (≤ 2 sentences) */}
      <td
        style={{
          padding: '0.75rem',
          verticalAlign: 'top',
          borderRight: `1px solid ${t.colour.border}`,
          fontSize: t.font.size.small,
          color: t.colour.textMuted,
        }}
      >
        {edit.explanation}
      </td>

      {/* Accept / Reject */}
      <td
        style={{
          padding: '0.5rem 0.75rem',
          verticalAlign: 'middle',
          textAlign: 'center',
        }}
      >
        <div
          style={{ display: 'flex', gap: '0.375rem', justifyContent: 'center' }}
        >
          <button
            type="button"
            onClick={() => onToggle(edit.id)}
            aria-label={
              isAccepted
                ? `Reject edit ${rowIndex}: ${edit.section.replace(/_/g, ' ')}`
                : `Accept edit ${rowIndex}: ${edit.section.replace(/_/g, ' ')}`
            }
            aria-pressed={isAccepted}
            style={{
              padding: '0.25rem 0.625rem',
              borderRadius: '0.375rem',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.8125rem',
              fontWeight: 600,
              background: isAccepted ? t.colour.success : t.colour.surfaceAlt,
              color: isAccepted ? t.colour.white : t.colour.text,
              minWidth: '4.5rem',
              // Non-colour-only: text changes between Accept/Accepted
            }}
          >
            {/* Non-colour-only indicator: text + symbol change */}
            {isAccepted ? '✓ Accepted' : 'Accept'}
          </button>
          {isAccepted && (
            <button
              type="button"
              onClick={() => onToggle(edit.id)}
              aria-label={`Reject edit ${rowIndex}: ${edit.section.replace(/_/g, ' ')}`}
              style={{
                padding: '0.25rem 0.625rem',
                borderRadius: '0.375rem',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.8125rem',
                fontWeight: 600,
                background: t.colour.dangerSoft,
                color: t.colour.dangerText,
                minWidth: '3.5rem',
              }}
            >
              ✕ Reject
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

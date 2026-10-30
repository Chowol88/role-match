import React from 'react';
import { useSession } from '../session/SessionContext';
import { BeforeAfterTable } from '../components/BeforeAfterTable';
import { getSample } from '../samples/sampleData';
import { tokens as t } from '../theme/tokens';
import { Button, Card, SectionLabel } from '../theme/primitives';

/**
 * Tailor screen — pre-authored, grounded before/after edits for the picked
 * sample. Each edit either reorders/rephrases existing CV content or promotes
 * genuine evidence from elsewhere in the CV (its source is named); nothing is
 * invented. Professional Experience is never rewritten — edits only target the
 * editable sections. Accept the edits you want, then continue to download.
 */
export function Step4Tailor({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const { state, dispatch } = useSession();
  const sample = state.selectedSample ? getSample(state.selectedSample) : null;

  // Source notes keyed by edit id (demo-only grounding provenance).
  const sourceNotes = new Map(sample?.edits.map((e) => [e.id, e.sourceNote]) ?? []);

  const acceptedCount = state.edits.filter((e) => e.accepted).length;

  function acceptAll() {
    for (const e of state.edits) {
      if (!e.accepted) dispatch({ type: 'TOGGLE_EDIT_ACCEPTED', id: e.id });
    }
  }

  return (
    <main
      aria-labelledby="tailor-heading"
      style={{ maxWidth: t.layout.maxWidth, margin: '0 auto', padding: `${t.space.xl} ${t.space.md}` }}
    >
      <SectionLabel>Recommended CV edits</SectionLabel>
      <h1
        id="tailor-heading"
        style={{ fontSize: t.font.size.h1, fontWeight: t.font.weight.heavy, letterSpacing: '-0.02em', margin: `0 0 ${t.space.sm}`, color: t.colour.text }}
      >
        {sample?.transition ?? 'Tailor the CV'}
      </h1>
      <p style={{ fontSize: t.font.size.body, color: t.colour.textMuted, maxWidth: '68ch', lineHeight: 1.7, margin: `0 0 ${t.space.lg}` }}>
        Tailor the CV: these edits pull the candidate’s strongest existing proof to the front so each
        requirement can be matched at a glance. Edits only touch Profile, Highlights, and Competencies —
        Professional Experience is never changed, and nothing is invented.
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: t.space.md, flexWrap: 'wrap', marginBottom: t.space.md }}>
        <Button variant="success" onClick={acceptAll}>
          Accept all edits
        </Button>
        <span style={{ fontSize: t.font.size.small, color: t.colour.textMuted }}>
          {acceptedCount} of {state.edits.length} edit{state.edits.length === 1 ? '' : 's'} accepted
        </span>
      </div>

      {state.edits.length > 0 ? (
        <BeforeAfterTable edits={state.edits} onToggle={(id: string) => dispatch({ type: 'TOGGLE_EDIT_ACCEPTED', id })} />
      ) : (
        <p style={{ color: t.colour.textMuted }}>No proposed edits for this example.</p>
      )}

      {/* Grounding provenance — where each promoted/reordered edit comes from. */}
      <Card as="section" aria-label="Edit sources" style={{ marginTop: t.space.lg, padding: t.space.md }}>
        <SectionLabel>Why each edit is grounded</SectionLabel>
        <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: t.font.size.small, color: t.colour.textMuted, lineHeight: 1.7 }}>
          {state.edits.map((e) => (
            <li key={e.id}>
              <strong style={{ color: t.colour.text }}>{e.section.replace(/_/g, ' ')}:</strong> {sourceNotes.get(e.id)}
            </li>
          ))}
        </ul>
      </Card>

      <div
        style={{
          marginTop: t.space.md,
          padding: `${t.space.sm} ${t.space.md}`,
          background: t.colour.surfaceAlt,
          borderRadius: t.radius.md,
          border: `1px solid ${t.colour.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}
      >
        <span aria-hidden="true" style={{ fontSize: '1rem' }}>🔒</span>
        <p style={{ fontSize: t.font.size.small, color: t.colour.textMuted, margin: 0 }}>
          Professional Experience is preserved unchanged and cannot be edited.
        </p>
      </div>

      <div style={{ display: 'flex', gap: t.space.sm, marginTop: t.space.lg }}>
        <Button variant="subtle" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext}>Continue to download →</Button>
      </div>
    </main>
  );
}

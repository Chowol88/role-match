import React from 'react';
import { useSession } from '../session/SessionContext';
import { getSample } from '../samples/sampleData';
import { tokens as t } from '../theme/tokens';
import { Button, Card, SectionLabel } from '../theme/primitives';

/** Human-readable labels for the mock PII trigger types. */
const PII_LABELS: Record<string, string> = {
  email: 'email address',
  phone: 'phone number',
  nric_fin: 'NRIC/FIN',
  url_social: 'URL / social handle',
  address: 'address',
  passport: 'passport number',
};

/**
 * Sample privacy gate — shown only for a sample that carries mock PII
 * (Sample B). It mirrors the live upload flow's warn-and-confirm gate: RoleFit
 * detects personal data in the sample CV, flags it, and offers "Proceed at my
 * own risk" or "Remove and choose another". This showcases the privacy guard
 * as the safety net promised at the agreement gate.
 *
 * Not reached in the current single-sample (Sample A) demo; retained for
 * Phase 2.
 */
export function SamplePiiGate({ onProceed, onBack }: { onProceed: () => void; onBack: () => void }) {
  const { state } = useSession();
  const sample = state.selectedSample ? getSample(state.selectedSample) : null;
  const triggers = sample?.pii?.triggers ?? [];

  // Defensive: if a non-PII sample reaches here, just continue.
  if (!sample || triggers.length === 0) {
    onProceed();
    return null;
  }

  const labelList = triggers.map((trigger) => PII_LABELS[trigger] ?? trigger).join(', ');

  return (
    <main
      aria-labelledby="pii-gate-heading"
      style={{ maxWidth: t.layout.readableWidth, margin: '0 auto', padding: `${t.space.xl} ${t.space.md}` }}
    >
      <SectionLabel>Privacy safety net</SectionLabel>
      <h1
        id="pii-gate-heading"
        style={{ fontSize: t.font.size.h1, fontWeight: t.font.weight.heavy, letterSpacing: '-0.02em', margin: `0 0 ${t.space.lg}`, color: t.colour.text }}
      >
        Personal data detected
      </h1>

      <Card
        as="section"
        role="alert"
        style={{ border: `1px solid ${t.colour.warnBorder}`, background: t.colour.warnSoft, marginBottom: t.space.lg }}
      >
        <p style={{ fontWeight: t.font.weight.bold, color: t.colour.warnText, margin: `0 0 ${t.space.sm}` }}>
          This example CV contains personal data.
        </p>
        <p style={{ fontSize: t.font.size.body, color: t.colour.warnText, lineHeight: 1.7, margin: `0 0 ${t.space.sm}` }}>
          RoleFit’s privacy guard found the following in this example CV: <strong>{labelList}</strong>.
          RoleFit is designed to flag likely personal data so the decision stays with you. Choosing
          “Remove personal data and proceed” continues to the assessment and the example tailored CV with
          this personal data removed — nothing identifying is carried through.
        </p>
        <p style={{ fontSize: t.font.size.small, color: t.colour.warnText, opacity: 0.85, margin: 0 }}>
          This is a deliberate demonstration of the privacy warn-and-confirm gate using fictional data.
        </p>
      </Card>

      <div style={{ display: 'flex', gap: t.space.sm, flexWrap: 'wrap' }}>
        <Button variant="success" onClick={onProceed}>
          Remove personal data and proceed
        </Button>
        <Button variant="subtle" onClick={onBack}>
          Back
        </Button>
      </div>
    </main>
  );
}

import React, { useEffect, useState } from 'react';
import { useSession } from '../session/SessionContext';
import { EvidenceTable } from '../components/EvidenceTable';
import { getSample } from '../samples/sampleData';
import { tokens as t } from '../theme/tokens';
import { Button, Card, ScoreRing, SectionLabel } from '../theme/primitives';

/** How long the brief transition is shown before the prepared result loads. */
const ANALYSING_MS = 1400;

/**
 * Assessment screen — shows the pre-authored, prepared sample assessment for
 * the picked sample. A brief transition ("Loading the prepared assessment…")
 * precedes the 1–10 indicator, a two-sentence assessment summary, and the
 * Direct/Transferable/Gap evidence breakdown. The assessment is prepared
 * content tied to the selected sample — it is not a personalised analysis of
 * the visitor's own CV, and the transition deliberately does not imply that a
 * live/AI analysis is being generated.
 */
export function Step3Results({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const { state } = useSession();
  const sample = state.selectedSample ? getSample(state.selectedSample) : null;

  const [analysing, setAnalysing] = useState(true);

  useEffect(() => {
    setAnalysing(true);
    const timer = setTimeout(() => setAnalysing(false), ANALYSING_MS);
    return () => clearTimeout(timer);
  }, [state.selectedSample]);

  // Genuine empty state: reached only if no example is selected at all. (Normal
  // flow always arrives here from a pick, so this is a safety fallback.)
  if (!sample) {
    return (
      <main style={{ maxWidth: t.layout.readableWidth, margin: '0 auto', padding: `${t.space.xl} ${t.space.md}` }}>
        <p style={{ color: t.colour.textMuted }}>No example selected.</p>
        <Button variant="subtle" onClick={onBack}>
          Back
        </Button>
      </main>
    );
  }

  // Show the transition while analysing OR until the prepared result has
  // settled into state — this avoids a flash of the empty state / a half-built
  // screen when the selection and navigation land a render apart.
  const result = state.result;
  const resultReady = !!result && result.score != null;
  const showLoader = analysing || !resultReady;

  return (
    <main
      aria-labelledby="results-heading"
      style={{ maxWidth: t.layout.maxWidth, margin: '0 auto', padding: `${t.space.xl} ${t.space.md}` }}
    >
      <SectionLabel>Structured role-match assessment</SectionLabel>
      <h1
        id="results-heading"
        style={{ fontSize: t.font.size.h1, fontWeight: t.font.weight.heavy, letterSpacing: '-0.02em', margin: `0 0 ${t.space.xs}`, color: t.colour.text }}
      >
        {sample.transition}
      </h1>
      <p style={{ margin: `0 0 ${t.space.sm}`, fontSize: t.font.size.small, color: t.colour.textMuted, lineHeight: 1.6 }}>
        Prepared example assessment — this evaluates the bundled example CV against its example role. It is
        not a personalised analysis of your own CV.
      </p>

      {showLoader || !result ? (
        <Card style={{ marginTop: t.space.lg }}>
          <div role="status" aria-live="polite" style={{ padding: `${t.space.xl} ${t.space.md}`, textAlign: 'center' }}>
            <div
              aria-hidden="true"
              style={{
                width: 44,
                height: 44,
                margin: '0 auto',
                borderRadius: '50%',
                border: `4px solid ${t.colour.border}`,
                borderTopColor: t.colour.brand,
                animation: 'rolefit-spin 0.8s linear infinite',
              }}
            />
            <p style={{ fontSize: t.font.size.lead, fontWeight: t.font.weight.bold, color: t.colour.text, margin: `${t.space.md} 0 0` }}>
              Loading the prepared assessment…
            </p>
            <p style={{ fontSize: t.font.size.body, color: t.colour.textMuted, margin: '0.25rem 0 0' }}>
              Showing how this example CV maps to its example role.
            </p>
            <style>{`@keyframes rolefit-spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        </Card>
      ) : (
        <>
          <Card style={{ marginTop: t.space.lg, marginBottom: t.space.lg }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: t.space.lg, flexWrap: 'wrap' }}>
              <ScoreRing score={result.score as number} max={10} />
              <div style={{ flex: 1, minWidth: 260 }}>
                <SectionLabel>Assessment summary</SectionLabel>
                <p style={{ margin: 0, fontSize: t.font.size.body, color: t.colour.text, lineHeight: 1.7 }}>
                  {sample.summary}
                </p>
              </div>
            </div>

            {/* Honest framing of what the 1–10 indicator means. It is an
                illustrative, qualitative indicator — explicitly NOT a formula
                over the counts below, and NOT a hiring/interview prediction. */}
            <p
              style={{
                margin: `${t.space.md} 0 0`,
                paddingTop: t.space.md,
                borderTop: `1px solid ${t.colour.border}`,
                fontSize: t.font.size.small,
                color: t.colour.textMuted,
                lineHeight: 1.6,
              }}
            >
              Illustrative role-match indicator (out of 10). Based on a qualitative assessment of how the
              example CV's evidence aligns with the role requirements, considering direct matches,
              transferable experience and gaps. This is not a prediction of interview or hiring outcomes.
              Each score is hand-authored for its prepared example to illustrate the kind of judgement
              RoleFit aims to make; the scores are indicative and not a precise, directly comparable ranking
              across examples.
            </p>

            {/* Compact evidence-count strip, taken from the actual stored
                arrays. The evidence table below shows the same counts per
                section; this is a quick summary, not an input to the score. */}
            <div
              style={{ display: 'flex', flexWrap: 'wrap', gap: t.space.sm, marginTop: t.space.md }}
              aria-label="Evidence breakdown counts"
            >
              <EvidenceCount label="Direct matches" count={result.direct.length} tone="direct" />
              <EvidenceCount label="Transferable" count={result.transferable.length} tone="transferable" />
              <EvidenceCount label="Gaps" count={result.gaps.length} tone="gap" />
            </div>
          </Card>

          <EvidenceTable direct={result.direct} transferable={result.transferable} gaps={result.gaps} />

          <div style={{ display: 'flex', gap: t.space.sm, marginTop: t.space.lg }}>
            <Button variant="subtle" onClick={onBack}>
              Back
            </Button>
            <Button onClick={onNext}>See recommended edits →</Button>
          </div>
        </>
      )}
    </main>
  );
}

/** Semantic colours mirror the EvidenceTable sections so the compact strip
 *  and the full table read as the same three categories. */
const COUNT_TONES: Record<'direct' | 'transferable' | 'gap', { bg: string; fg: string; border: string }> = {
  direct: { bg: t.colour.successSoft, fg: t.colour.successText, border: t.colour.success },
  transferable: { bg: t.colour.transferSoft, fg: t.colour.transferText, border: t.colour.transfer },
  gap: { bg: t.colour.gapSoft, fg: t.colour.gapText, border: t.colour.gap },
};

/** A single compact "label: N" pill for the evidence-count strip. */
function EvidenceCount({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: 'direct' | 'transferable' | 'gap';
}) {
  const c = COUNT_TONES[tone];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: '0.4rem',
        padding: '0.25rem 0.7rem',
        borderRadius: t.radius.pill,
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
        fontSize: t.font.size.small,
        fontWeight: t.font.weight.semibold,
      }}
    >
      {label}
      <strong style={{ fontSize: t.font.size.body, fontWeight: t.font.weight.heavy }}>{count}</strong>
    </span>
  );
}

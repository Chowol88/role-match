import React from 'react';
import { useSession } from '../session/SessionContext';
import { SAMPLES, type SampleId } from '../samples/sampleData';
import { tokens as t } from '../theme/tokens';
import { Button, Card, Chip, SectionLabel } from '../theme/primitives';

/**
 * Sample bundle screen (concept demo).
 *
 * The live-upload path is hidden in the demo. For the current single-sample
 * release we show only Sample A — a fictional CV paired with a real-world job
 * description — and load its pre-authored result and tailor edits into session
 * state on continue.
 *
 * {@link SHOW_ALL_SAMPLES} is the Phase-2 switch: flip it to `true` to restore
 * the multi-card A/B/C chooser (all the logic below already handles it). The
 * A/B/C chooser screen is intended to live between "Try the demo" and this
 * bundle in Phase 2; for now the single bundle stands in for it.
 */
const SHOW_ALL_SAMPLES = true;

/**
 * Honest scenario-type label per sample, describing what each prepared example
 * actually demonstrates (confirmed against the sample content):
 *  - A (Healthcare): strong floor, leadership proof present but buried → transferable.
 *  - B (Finance): director-level numbers already evidenced → strong match.
 *  - C (Banking): capable analyst reaching up a level → meaningful gaps.
 * Labels are presentational only; they do not alter the underlying sample data.
 */
const SCENARIO_LABEL: Record<SampleId, string> = {
  A: 'Transferable experience',
  B: 'Strong match',
  C: 'Meaningful gaps',
};

/** Circle-badge colour per example (A purple, B green, C blue). */
const BADGE_COLOUR: Record<SampleId, string> = {
  A: t.colour.brand, // indigo/purple
  B: t.colour.success, // green
  C: '#2563eb', // blue
};

/**
 * Per-example descriptive copy shown on the chooser card. Presentational only
 * (kept here rather than in sampleData) — describes what each prepared example
 * demonstrates and what it's best for exploring.
 */
const CARD_DESCRIPTION: Record<SampleId, string> = {
  A: 'Relevant capabilities are described differently from the job requirements. See how the assessment interprets the evidence. Best for exploring contextual matching.',
  B: 'Relevant experience is already present. See how the assessment identifies it and improves how it is presented. Best for exploring strengths and clearer positioning.',
  C: 'Some job requirements are not supported by the CV. See how missing evidence is distinguished from poorly expressed experience. Best for exploring the limits of tailoring.',
};

/** Split a "CV role → Target role" transition into its two sides. */
function splitTransition(transition: string): { cvRole: string; targetRole: string } {
  const [cvRole, targetRole] = transition.split('→').map((s) => s.trim());
  return { cvRole: cvRole ?? transition, targetRole: targetRole ?? '' };
}

export function Step1Pick({ onPick, onBack }: { onPick: (id: SampleId) => void; onBack: () => void }) {
  const { dispatch } = useSession();

  const visibleSamples = SHOW_ALL_SAMPLES ? SAMPLES : SAMPLES.filter((s) => s.id === 'A');

  function choose(id: SampleId) {
    // Load the picked example into session state AND hand the id to the caller
    // so routing (e.g. the PII gate) is decided from the id being picked, not
    // from session state that has not updated yet this render.
    dispatch({ type: 'SELECT_SAMPLE', sampleId: id });
    onPick(id);
  }

  const single = visibleSamples.length === 1;

  return (
    <main
      aria-labelledby="pick-heading"
      style={{ maxWidth: t.layout.maxWidth, margin: '0 auto', padding: `${t.space.xl} ${t.space.md}` }}
    >
      <SectionLabel>Choose example</SectionLabel>
      <h1
        id="pick-heading"
        style={{ fontSize: t.font.size.h1, fontWeight: t.font.weight.heavy, letterSpacing: '-0.02em', margin: `0 0 ${t.space.sm}`, color: t.colour.text }}
      >
        Choose an example to explore
      </h1>
      <p style={{ fontSize: t.font.size.body, color: t.colour.textMuted, maxWidth: '72ch', lineHeight: 1.7, margin: `0 0 ${t.space.xl}` }}>
        Explore how RoleFit assesses a prepared CV against a job description.
        Each example demonstrates a different assessment situation. All results
        are prepared in advance.
      </p>

      <div
        style={{
          display: 'grid',
          gap: t.space.lg,
          gridTemplateColumns: single ? '1fr' : 'repeat(auto-fit, minmax(280px, 1fr))',
          alignItems: 'stretch',
        }}
      >
        {visibleSamples.map((s) => {
          const { cvRole, targetRole } = splitTransition(s.transition);
          return (
            <Card key={s.id} style={{ padding: t.space.lg, position: 'relative', height: '100%' }}>
              {/* Full-height column so every card's CTA bottom-aligns. */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: t.space.md, height: '100%' }}>
                {/* Badge + prominent scenario title, as the card's heading. */}
                <div style={{ display: 'flex', alignItems: 'center', gap: t.space.md }}>
                  <CircleBadge letter={s.id} colour={BADGE_COLOUR[s.id]} />
                  <h2
                    style={{
                      margin: 0,
                      fontSize: t.font.size.h3,
                      fontWeight: t.font.weight.heavy,
                      letterSpacing: '-0.01em',
                      color: t.colour.text,
                      lineHeight: 1.15,
                    }}
                  >
                    {SCENARIO_LABEL[s.id]}
                  </h2>
                </div>

                {s.pii && (
                  <div>
                    <Chip tone="warn">Demonstrates the privacy warning</Chip>
                  </div>
                )}

                {/* Equal-height description block so the DOCUMENT/TARGET boxes
                    start at the same vertical position across all cards. */}
                <p style={{ margin: 0, minHeight: '7.5rem', fontSize: t.font.size.body, color: t.colour.textMuted, lineHeight: 1.6 }}>
                  {CARD_DESCRIPTION[s.id]}
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: t.space.sm }}>
                  <BundleFact label="Document" sub="Fictional CV" value={cvRole} />
                  <BundleFact label="Target" sub="Real-world job description" value={targetRole} />
                </div>

                {/* Pushed to the bottom so all three buttons share one line. */}
                <div style={{ marginTop: 'auto', paddingTop: t.space.sm }}>
                  <Button
                    onClick={() => choose(s.id)}
                    aria-label={`Explore the example: ${s.transition}`}
                    size="lg"
                    block
                  >
                    Explore the assessment →
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Live-upload is not in the preview — set expectations + a privacy nudge. */}
      <div
        role="note"
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.625rem',
          marginTop: t.space.xl,
          padding: t.space.md,
          background: t.colour.warnSoft,
          border: `1px solid ${t.colour.warnBorder}`,
          borderRadius: t.radius.md,
        }}
      >
        <span aria-hidden="true" style={{ fontSize: '1.125rem', lineHeight: 1.4 }}>⚠️</span>
        <p style={{ margin: 0, fontSize: t.font.size.small, color: t.colour.warnText, lineHeight: 1.6 }}>
          File upload coming soon in the live version. Anonymise sensitive data before uploading.
        </p>
      </div>

      <div style={{ display: 'flex', gap: t.space.sm, marginTop: t.space.lg }}>
        <Button variant="subtle" onClick={onBack}>
          Back
        </Button>
      </div>
    </main>
  );
}

/**
 * One "DOCUMENT / TARGET" fact block.
 *  - `label` is the uppercase eyebrow (DOCUMENT / TARGET),
 *  - `sub` is the kind line ("Fictional CV" / "Real-world job description"),
 *  - `value` is the real role title the example is about.
 */
function BundleFact({ label, sub, value }: { label: string; sub: string; value: string }) {
  return (
    <div
      style={{
        background: t.colour.surfaceAlt,
        border: `1px solid ${t.colour.border}`,
        borderRadius: t.radius.md,
        padding: '0.625rem 0.875rem',
      }}
    >
      {/* One caption line (eyebrow + kind) — fewer distinct sizes per card. */}
      <div style={{ fontSize: t.font.size.caption, textTransform: 'uppercase', letterSpacing: '0.08em', color: t.colour.textFaint, fontWeight: t.font.weight.bold }}>
        {label} · {sub}
      </div>
      {value && (
        <div style={{ fontSize: t.font.size.body, color: t.colour.text, fontWeight: t.font.weight.bold, marginTop: '0.15rem' }}>
          {value}
        </div>
      )}
    </div>
  );
}

/** Colour-coded circle with the example letter, shown inline beside the card
 *  title. Sized to pair with the h3 scenario title. */
function CircleBadge({ letter, colour }: { letter: string; colour: string }) {
  return (
    <div
      aria-hidden="true"
      style={{
        flexShrink: 0,
        width: 44,
        height: 44,
        borderRadius: '50%',
        background: colour,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: t.shadow.md,
      }}
    >
      <span style={{ fontSize: '1.4rem', fontWeight: t.font.weight.heavy, color: t.colour.white, lineHeight: 1 }}>
        {letter}
      </span>
    </div>
  );
}

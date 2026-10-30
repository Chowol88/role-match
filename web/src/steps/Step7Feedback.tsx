import React, { useState } from 'react';
import { tokens as t } from '../theme/tokens';
import { Button, Card, SectionLabel } from '../theme/primitives';

/**
 * Optional feedback → personal "snapshot" of the user's own answers.
 *
 * Three multiple-choice questions, then a visual summary that reflects back the
 * individual's choices as a meaningful close to the journey. Deliberately:
 *  - NO composite score (the three questions measure different things),
 *  - NO percentages / averages / rankings / cross-user comparison,
 *  - NO persistence — answers live only in this component's state for the
 *    current view and are discarded when the flow closes or resets (nothing is
 *    written to localStorage, a database, or any analytics sink).
 *
 * "Finish" closes the flow (returns Home) without submitting or saving anything.
 * "Skip" returns to the download screen without showing a snapshot.
 */

type QuestionId = 'credible' | 'editsUseful' | 'improve';

const CREDIBLE_OPTIONS = [
  { id: 'yes', status: 'Yes, credible' },
  { id: 'somewhat', status: 'Somewhat credible' },
  { id: 'no', status: 'Not credible' },
] as const;

const EDITS_OPTIONS = [
  { id: 'very', status: 'Very useful' },
  { id: 'somewhat', status: 'Somewhat useful' },
  { id: 'not', status: 'Not useful' },
] as const;

const IMPROVE_OPTIONS = [
  { id: 'evidence', label: 'Evidence & explanations' },
  { id: 'gaps', label: 'Gap identification' },
  { id: 'editQuality', label: 'CV edit quality' },
  { id: 'trust', label: 'Accuracy, privacy & trust' },
] as const;

export function Step7Feedback({ onSkip, onHome }: { onSkip: () => void; onHome: () => void }) {
  const [credible, setCredible] = useState<string | null>(null);
  const [editsUseful, setEditsUseful] = useState<string | null>(null);
  const [improve, setImprove] = useState<string[]>([]);
  const [showSnapshot, setShowSnapshot] = useState(false);

  // The two single-choice questions must be answered to view the snapshot;
  // improvement areas are optional (zero is a valid, graceful state).
  const canView = credible !== null && editsUseful !== null;

  function toggleImprove(id: string) {
    setImprove((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  if (showSnapshot) {
    return (
      <Snapshot
        credible={credible!}
        editsUseful={editsUseful!}
        improve={improve}
        onFinish={onHome}
      />
    );
  }

  return (
    <main
      aria-labelledby="fb-heading"
      style={{ maxWidth: t.layout.readableWidth, margin: '0 auto', padding: `${t.space.xl} ${t.space.md}` }}
    >
      <SectionLabel>Tell us what you think</SectionLabel>
      <h1
        id="fb-heading"
        style={{ fontSize: t.font.size.h1, fontWeight: t.font.weight.heavy, letterSpacing: '-0.02em', margin: `0 0 ${t.space.sm}`, color: t.colour.text }}
      >
        Your feedback helps shape RoleFit
      </h1>
      <p style={{ fontSize: t.font.size.body, color: t.colour.textMuted, lineHeight: 1.7, margin: `0 0 ${t.space.lg}`, maxWidth: '64ch' }}>
        Three quick questions — no sign-up, no personal details, nothing saved or sent. Optional, and takes
        under a minute.
      </p>

      <QuestionCard prompt="Were the assessment findings credible?">
        <Pills
          options={CREDIBLE_OPTIONS.map((o) => ({ id: o.id, label: o.status }))}
          selected={credible ? [credible] : []}
          onToggle={(id) => setCredible((prev) => (prev === id ? null : id))}
        />
      </QuestionCard>

      <QuestionCard prompt="How useful were the proposed CV edits?">
        <Pills
          options={EDITS_OPTIONS.map((o) => ({ id: o.id, label: o.status }))}
          selected={editsUseful ? [editsUseful] : []}
          onToggle={(id) => setEditsUseful((prev) => (prev === id ? null : id))}
        />
      </QuestionCard>

      <QuestionCard prompt="What is the most critical feature to get right? (choose any)">
        <Pills
          options={IMPROVE_OPTIONS.map((o) => ({ id: o.id, label: o.label }))}
          selected={improve}
          onToggle={toggleImprove}
        />
      </QuestionCard>

      <div style={{ display: 'flex', gap: t.space.sm, flexWrap: 'wrap', marginTop: t.space.md }}>
        <Button onClick={() => setShowSnapshot(true)} disabled={!canView} size="lg">
          View my snapshot →
        </Button>
        <Button variant="subtle" onClick={onSkip}>
          Skip for now
        </Button>
      </div>
      {!canView && (
        <p style={{ fontSize: t.font.size.caption, color: t.colour.textFaint, margin: `${t.space.sm} 0 0` }}>
          Answer the first two questions to see your snapshot, or skip.
        </p>
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------
// Question UI
// ---------------------------------------------------------------------------

function QuestionCard({ prompt, children }: { prompt: string; children: React.ReactNode }) {
  return (
    <Card as="section" style={{ marginBottom: t.space.md, padding: t.space.lg }}>
      <h2 style={{ fontSize: t.font.size.lead, fontWeight: t.font.weight.bold, margin: `0 0 ${t.space.md}`, color: t.colour.text }}>
        {prompt}
      </h2>
      {children}
    </Card>
  );
}

function Pills({
  options,
  selected,
  onToggle,
}: {
  options: { id: string; label: string }[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: t.space.sm }}>
      {options.map((opt) => {
        const active = selected.includes(opt.id);
        return (
          <button
            key={opt.id}
            type="button"
            aria-pressed={active}
            onClick={() => onToggle(opt.id)}
            style={{
              padding: '0.5rem 0.9rem',
              borderRadius: t.radius.pill,
              cursor: 'pointer',
              fontSize: t.font.size.body,
              fontWeight: t.font.weight.semibold,
              fontFamily: t.font.sans,
              border: `1px solid ${active ? t.colour.brand : t.colour.borderStrong}`,
              background: active ? t.colour.brandSoft : t.colour.surface,
              color: active ? t.colour.transferText : t.colour.text,
              transition: 'background 120ms ease, border 120ms ease',
            }}
          >
            {active ? '✓ ' : ''}{opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Personal snapshot (dark panel, per Dashboard Mockup.PNG)
// ---------------------------------------------------------------------------

function statusFor(options: readonly { id: string; status: string }[], id: string): string {
  return options.find((o) => o.id === id)?.status ?? '—';
}

function Snapshot({
  credible,
  editsUseful,
  improve,
  onFinish,
}: {
  credible: string;
  editsUseful: string;
  improve: string[];
  onFinish: () => void;
}) {
  const selectedAreas = IMPROVE_OPTIONS.filter((o) => improve.includes(o.id));

  return (
    <main
      aria-labelledby="snap-heading"
      style={{ maxWidth: t.layout.readableWidth, margin: '0 auto', padding: `${t.space.lg} ${t.space.md} ${t.space.xl}` }}
    >
      <div
        style={{
          borderRadius: t.radius.xl,
          background: `radial-gradient(1200px 400px at 15% -10%, ${t.colour.ink700}, ${t.colour.ink900} 70%)`,
          border: `1px solid ${t.colour.ink600}`,
          boxShadow: t.shadow.lg,
          overflow: 'hidden',
          padding: `${t.space.xl} ${t.space.xl} ${t.space.lg}`,
        }}
      >
        <SectionLabel tone="dark">Your feedback snapshot</SectionLabel>
        <h1
          id="snap-heading"
          style={{ fontSize: t.font.size.h1, fontWeight: t.font.weight.heavy, letterSpacing: '-0.02em', margin: `0 0 ${t.space.xs}`, color: t.colour.inkText }}
        >
          Your take on the assessment
        </h1>
        <p style={{ margin: `0 0 ${t.space.lg}`, fontSize: t.font.size.body, color: t.colour.inkMuted, lineHeight: 1.6 }}>
          A summary of your experience, based on your answers.
        </p>

        <SnapshotSection
          index="01"
          eyebrow="Assessment credibility"
          icon={<CredibleIcon />}
          accent={t.colour.success}
          status={statusFor(CREDIBLE_OPTIONS, credible)}
          description="Your confidence in the assessment findings."
        />

        <SnapshotSection
          index="02"
          eyebrow="CV edit usefulness"
          icon={<EditsIcon />}
          accent={t.colour.brand}
          status={statusFor(EDITS_OPTIONS, editsUseful)}
          description="How much value you found in the proposed edits."
        />

        <SnapshotSection
          index="03"
          eyebrow="Feature priorities"
          icon={<ImproveIcon />}
          accent={t.colour.gap}
          status={selectedAreas.length === 0 ? 'No specific features flagged' : `${selectedAreas.length} feature${selectedAreas.length === 1 ? '' : 's'} selected`}
          description="Your selected critical features, not a score or ranking."
          noUnderline
        >
          {selectedAreas.length === 0 ? (
            <p style={{ margin: `${t.space.sm} 0 0`, fontSize: t.font.size.body, color: t.colour.inkMuted, lineHeight: 1.6 }}>
              You didn’t flag any specific features — nothing stood out as most critical in your view.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', margin: `${t.space.sm} 0 0`, padding: 0, display: 'flex', flexDirection: 'column', gap: t.space.xs }}>
              {selectedAreas.map((a) => (
                <li key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: t.colour.inkText, fontSize: t.font.size.body }}>
                  <TickIcon colour={t.colour.gap} />
                  {a.label}
                </li>
              ))}
            </ul>
          )}
        </SnapshotSection>

        {/* Reassurance — session-only, nothing saved or sent. */}
        <div
          style={{
            marginTop: t.space.lg,
            padding: t.space.md,
            borderRadius: t.radius.md,
            background: t.colour.ink800,
            border: `1px solid ${t.colour.ink600}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
            <ShieldIcon />
            <span style={{ fontSize: t.font.size.body, fontWeight: t.font.weight.bold, color: t.colour.inkText }}>
              Your feedback stays with you
            </span>
          </div>
          <p style={{ margin: 0, fontSize: t.font.size.small, color: t.colour.inkMuted, lineHeight: 1.7 }}>
            This snapshot is generated from your answers in this session. No responses are saved or sent for
            collection. Leaving this page ends the feedback flow.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', marginTop: t.space.lg }}>
        <Button onClick={onFinish} size="lg" block>
          Finish
        </Button>
      </div>
    </main>
  );
}

function SnapshotSection({
  index,
  eyebrow,
  icon,
  accent,
  status,
  description,
  noUnderline = false,
  children,
}: {
  index: string;
  eyebrow: string;
  icon: React.ReactNode;
  accent: string;
  status: string;
  description: string;
  noUnderline?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <section style={{ padding: `${t.space.md} 0`, borderTop: `1px solid ${t.colour.ink600}` }}>
      <div style={{ display: 'flex', gap: t.space.md, alignItems: 'flex-start' }}>
        <span
          aria-hidden="true"
          style={{
            flexShrink: 0,
            width: 44,
            height: 44,
            borderRadius: t.radius.md,
            background: 'rgba(255,255,255,0.06)',
            border: `1px solid ${t.colour.ink600}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {icon}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: t.font.size.caption, fontWeight: t.font.weight.bold, letterSpacing: '0.08em', textTransform: 'uppercase', color: t.colour.inkMuted, marginBottom: '0.15rem' }}>
            {index} · {eyebrow}
          </div>
          <div style={{ fontSize: t.font.size.h3, fontWeight: t.font.weight.heavy, color: t.colour.inkText, lineHeight: 1.2 }}>
            {status}
          </div>
          <p style={{ margin: '0.25rem 0 0', fontSize: t.font.size.body, color: t.colour.inkMuted, lineHeight: 1.6 }}>
            {description}
          </p>
          {children}
          {!noUnderline && (
            <div style={{ height: 4, borderRadius: t.radius.pill, background: accent, marginTop: t.space.md, opacity: 0.9 }} />
          )}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Inline icons
// ---------------------------------------------------------------------------

function CredibleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke={t.colour.success} strokeWidth="2" />
      <path d="M8 12.3l2.6 2.6L16 9.5" stroke={t.colour.success} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EditsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M13 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" stroke={t.colour.brand} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18.5 3.5a1.9 1.9 0 0 1 2.7 2.7L13 14.4l-3.4.7.7-3.4 8.2-8.2z" stroke={t.colour.brand} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ImproveIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke={t.colour.gap} strokeWidth="2" />
      <circle cx="12" cy="12" r="5" stroke={t.colour.gap} strokeWidth="2" />
      <circle cx="12" cy="12" r="1.6" fill={t.colour.gap} />
    </svg>
  );
}

function TickIcon({ colour }: { colour: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="9" stroke={colour} strokeWidth="2" />
      <path d="M8 12.3l2.6 2.6L16 9.5" stroke={colour} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M12 3l7 3v5c0 4.2-2.9 7.4-7 8.5-4.1-1.1-7-4.3-7-8.5V6l7-3z" stroke={t.colour.inkText} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9 12l2 2 4-4" stroke={t.colour.inkText} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

import React, { useState } from 'react';
import { useSession } from '../session/SessionContext';
import { resetSession, setAgreement } from '../api/client';
import { tokens as t } from '../theme/tokens';
import { Brand, Button, Chip, Hero } from '../theme/primitives';

/**
 * Landing page — two focused sections on one dark panel.
 *
 * Section A ("the product") sells RoleFit itself: brand, headline, the value
 * strip, and the one-line "role fit at a glance" promise.
 *
 * Section B ("this Early Preview") explains what the preview actually offers —
 * exploring prepared example assessments — with a single blue CTA that enters
 * the example chooser, a short "what you can explore" list, and an honest
 * scope note.
 *
 * The two sections sit on slightly different dark shades so the shift in focus
 * (product → this preview) reads at a glance. There is no agreement checkbox:
 * the preview runs on prepared example materials only and never takes the
 * visitor's own documents, so "Explore examples" enters the chooser directly.
 * We still start a best-effort backend session on entry to keep the existing
 * audit/agreement trail intact; a failure never blocks the preview.
 */
export function Step0Start({ onNext }: { onNext: () => void }) {
  const { dispatch } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExplore() {
    setLoading(true);
    setError(null);
    try {
      const res = await resetSession();
      dispatch({ type: 'SET_SESSION_ID', sessionId: res.sessionId });
      await setAgreement(res.sessionId);
    } catch (e) {
      // Non-fatal in the preview — proceed regardless.
      void e;
    } finally {
      dispatch({ type: 'SET_AGREEMENT_CONFIRMED', confirmed: true });
      setLoading(false);
      onNext();
    }
  }

  return (
    // The landing page is content sitting on the white page canvas (set on
    // <body>). The wrapper stays transparent so the gutters read as true
    // "not-the-app" white, giving the dark panel clear contrast.
    <div style={{ minHeight: '100%', background: 'transparent' }}>
      <main
        aria-labelledby="start-heading"
        style={{
          maxWidth: t.layout.maxWidth,
          margin: '0 auto',
          padding: `${t.space.lg} ${t.space.lg} ${t.space.xl}`,
        }}
      >
        <div
          style={{
            borderRadius: t.radius.xl,
            border: `1px solid ${t.colour.ink600}`,
            boxShadow: t.shadow.lg,
            overflow: 'hidden',
          }}
        >
          {/* ======================================================= */}
          {/* SECTION A — the product (RoleFit features & value)      */}
          {/* ======================================================= */}
          <Hero bare>
            <div
              style={{
                background: `radial-gradient(1200px 400px at 15% -10%, ${t.colour.ink700}, ${t.colour.ink900} 70%)`,
                padding: `${t.space.xl} ${t.space.xl} ${t.space.lg}`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: t.space.md, marginBottom: t.space.lg }}>
                <Brand tone="dark" size="lg" subtitle="CV matching & tailoring" />
                <Chip tone="onDark">Early preview</Chip>
              </div>

              <h1
                id="start-heading"
                style={{
                  // One line on wide screens, scaling down gracefully on narrow
                  // viewports instead of overflowing (clamp tied to available
                  // width); capped at the 3rem display size, floored for phones.
                  fontSize: 'clamp(0.9rem, calc((100vw - 7.5rem) / 18.7), 3rem)',
                  lineHeight: 1.05,
                  letterSpacing: '-0.03em',
                  fontWeight: t.font.weight.heavy,
                  margin: `0 0 ${t.space.md}`,
                  color: t.colour.inkText,
                  whiteSpace: 'nowrap',
                }}
              >
                Your experience deserves to be seen.
              </h1>

              {/* Yellow value strip. */}
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: `${t.space.xs} ${t.space.lg}`,
                  color: t.colour.accent,
                  fontSize: t.font.size.body,
                  fontWeight: t.font.weight.bold,
                  marginBottom: t.space.md,
                }}
              >
                <span>Structured role-match assessment</span>
                <Dot />
                <span>Strengths and gaps against the role</span>
                <Dot />
                <span>Grounded edits</span>
              </div>

              <p
                style={{
                  margin: `0 0 ${t.space.sm}`,
                  maxWidth: '72ch',
                  fontSize: t.font.size.lead,
                  lineHeight: 1.6,
                  color: t.colour.inkText,
                  fontWeight: t.font.weight.medium,
                }}
              >
                Discover how well your CV matches a role. Bring your strongest,
                most relevant experience to the surface. Create a tailored CV
                grounded in your real qualifications.
              </p>

              {/* Footnote strip — tick icon + "role fit at a glance". Sits
                  directly under the paragraph (no divider / dark gap). */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <CheckTickIcon />
                <span style={{ fontSize: t.font.size.body, fontWeight: t.font.weight.bold, color: t.colour.inkText }}>
                  Show role fit instantly when each requirement can be ticked off at a glance.
                </span>
              </div>
            </div>
          </Hero>

          {/* ======================================================= */}
          {/* SECTION B — this Early Preview (explore examples)       */}
          {/* ======================================================= */}
          <section
            aria-labelledby="preview-heading"
            style={{ background: t.colour.ink800, padding: t.space.lg }}
          >
            {/* Inset yellow-bordered box — draws the eye to the "this preview"
                content. Border only (no fill); margin lets the box edges read
                against the dark section. */}
            <div
              style={{
                border: `2px solid ${t.colour.accent}`,
                borderRadius: t.radius.lg,
                padding: t.space.xl,
              }}
            >
            <h2
              id="preview-heading"
              style={{ margin: `0 0 ${t.space.sm}`, fontSize: t.font.size.h3, fontWeight: t.font.weight.bold, color: t.colour.inkText }}
            >
              See how RoleFit helps align a CV to a job.
            </h2>
            <p style={{ margin: `0 0 ${t.space.lg}`, maxWidth: '72ch', fontSize: t.font.size.body, lineHeight: 1.7, color: t.colour.inkMuted }}>
              Explore example assessments, inspect the evidence behind findings, and review recommended CV edits.
            </p>

            {/* White CTA card. */}
            <div
              style={{
                background: t.colour.surface,
                borderRadius: t.radius.lg,
                border: `1px solid ${t.colour.border}`,
                boxShadow: t.shadow.md,
                padding: t.space.lg,
                marginBottom: t.space.lg,
              }}
            >
              <h3 style={{ margin: `0 0 ${t.space.xs}`, fontSize: t.font.size.lead, fontWeight: t.font.weight.bold, color: t.colour.text }}>
                Explore example assessments
              </h3>
              <p style={{ margin: `0 0 ${t.space.md}`, fontSize: t.font.size.body, color: t.colour.textMuted, lineHeight: 1.6 }}>
                See how the approach works across different role-match scenarios.
              </p>
              <Button
                size="lg"
                onClick={handleExplore}
                disabled={loading}
                aria-busy={loading}
              >
                {loading ? 'Starting…' : '→ Explore examples'}
              </Button>
              {error && (
                <p role="alert" style={{ margin: `${t.space.sm} 0 0`, fontSize: t.font.size.small, color: t.colour.dangerText }}>
                  {error}
                </p>
              )}
            </div>

            {/* What you can explore. */}
            <h3 style={{ margin: `0 0 ${t.space.md}`, fontSize: t.font.size.lead, fontWeight: t.font.weight.bold, color: t.colour.inkText }}>
              What you can explore
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: t.space.md }}>
              <ExploreItem
                icon={<AssessIcon />}
                title="Understand the assessment"
                body="Explore strengths, transferable evidence and gaps in a prepared example."
              />
              <ExploreItem
                icon={<EditIcon />}
                title="Review proposed edits"
                body="See how CV wording could be improved without adding unsupported experience."
              />
            </div>

            {/* Please note — honest scope of the preview. */}
            <div style={{ marginTop: t.space.lg, paddingTop: t.space.lg, borderTop: `1px solid ${t.colour.ink600}` }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
                <InfoIcon />
                <div>
                  <p style={{ margin: `0 0 0.2rem`, fontSize: t.font.size.body, fontWeight: t.font.weight.bold, color: t.colour.inkText }}>
                    Please note
                  </p>
                  <p style={{ margin: 0, maxWidth: '72ch', fontSize: t.font.size.small, color: t.colour.inkMuted, lineHeight: 1.7 }}>
                    This preview uses prepared example CVs, job descriptions and
                    results. It does not yet assess or tailor your own documents.
                    Use example materials only.
                  </p>
                </div>
              </div>
            </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

/** Amber separator dot used between the value-strip phrases. */
function Dot() {
  return (
    <span aria-hidden="true" style={{ color: t.colour.accent, fontWeight: t.font.weight.heavy }}>
      •
    </span>
  );
}

/** One "what you can explore" row: icon + title + body. */
function ExploreItem({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.7rem' }}>
      <span style={{ flexShrink: 0, marginTop: '0.1rem' }}>{icon}</span>
      <div>
        <p style={{ margin: `0 0 0.15rem`, fontSize: t.font.size.body, fontWeight: t.font.weight.bold, color: t.colour.inkText }}>
          {title}
        </p>
        <p style={{ margin: 0, maxWidth: '68ch', fontSize: t.font.size.small, color: t.colour.inkMuted, lineHeight: 1.6 }}>
          {body}
        </p>
      </div>
    </div>
  );
}

// --- Inline icons (match the reference PNG) --------------------------------

/** Tick inside a rounded box — the Section A footer-strip glyph. */
function CheckTickIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <rect x="3" y="3" width="18" height="18" rx="4" stroke={t.colour.accent} strokeWidth="2" />
      <path d="M8 12.5l2.5 2.5L16 9" stroke={t.colour.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Magnifier with a tick — "understand the assessment". */
function AssessIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke={t.colour.success} strokeWidth="2" />
      <path d="M8 11l2.2 2.2L14.5 9" stroke={t.colour.success} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16.5 16.5L21 21" stroke={t.colour.success} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** Pencil on a document — "review proposed edits". */
function EditIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M13 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" stroke={t.colour.success} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18.5 3.5a1.9 1.9 0 0 1 2.7 2.7L13 14.4l-3.4.7.7-3.4 8.2-8.2z" stroke={t.colour.success} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Info circle — the "please note" glyph. */
function InfoIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0, marginTop: '0.1rem' }}>
      <circle cx="12" cy="12" r="9" stroke={t.colour.inkMuted} strokeWidth="2" />
      <path d="M12 11v5" stroke={t.colour.inkMuted} strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="8" r="1.1" fill={t.colour.inkMuted} />
    </svg>
  );
}

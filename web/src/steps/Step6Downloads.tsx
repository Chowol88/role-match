import React, { useState } from 'react';
import { useSession } from '../session/SessionContext';
import { getSample } from '../samples/sampleData';
import { buildCvDocx } from '../download/buildCvDocx';
import { tokens as t } from '../theme/tokens';
import { Button, Card, SectionLabel } from '../theme/primitives';

/**
 * Download screen — builds the example CV `.docx` IN THE BROWSER at download
 * time so the file reflects exactly the edits the user accepted (reject /
 * no-click are honoured per row; nothing accepted → the untailored CV). This
 * replaces the previous static `public/*.docx` fetch, which always contained
 * every edit.
 *
 * "Try another example" returns to the chooser with a clean edit state.
 */
export function Step6Downloads({
  onBack,
  onRestart,
  onHome,
  onFeedback,
}: {
  /** Return to the Recommended CV edits step (accept/reject state is kept). */
  onBack: () => void;
  /** Return to the example chooser to try a different example. */
  onRestart: () => void;
  /** Start over from the landing page (also resets the session). */
  onHome: () => void;
  /** Open the optional feedback step + engagement dashboard. */
  onFeedback: () => void;
}) {
  const { state } = useSession();
  const sample = state.selectedSample ? getSample(state.selectedSample) : null;
  const [cvDone, setCvDone] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const acceptedCount = state.edits.filter((e) => e.accepted).length;
  const totalEdits = state.edits.length;

  async function handleDownloadCv() {
    if (!sample) return;
    setDownloading(true);
    setError(null);
    try {
      const blob = await buildCvDocx(sample, state.edits);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rolefit-example-${sample.id.toLowerCase()}-cv.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setCvDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Download failed.');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <main
      aria-labelledby="dl-heading"
      style={{ maxWidth: t.layout.readableWidth, margin: '0 auto', padding: `${t.space.xl} ${t.space.md}` }}
    >
      <SectionLabel>Example output</SectionLabel>
      <h1
        id="dl-heading"
        style={{ fontSize: t.font.size.h1, fontWeight: t.font.weight.heavy, letterSpacing: '-0.02em', margin: `0 0 ${t.space.md}`, color: t.colour.text }}
      >
        Download the example CV
      </h1>

      <p style={{ fontSize: t.font.size.body, color: t.colour.textMuted, lineHeight: 1.7, margin: `0 0 ${t.space.lg}` }}>
        {acceptedCount > 0
          ? `This example CV applies the ${acceptedCount} of ${totalEdits} edit${totalEdits === 1 ? '' : 's'} you accepted; any edit you rejected or left undecided keeps the original wording. Professional Experience is preserved unchanged. It is an example output, not a tailored version of your own CV.`
          : 'No edits were accepted, so this example CV keeps the original wording throughout, with Professional Experience preserved unchanged. Accept edits on the previous step to see them applied here. It is an example output, not a tailored version of your own CV.'}
      </p>

      <Card style={{ marginBottom: t.space.lg, padding: t.space.lg }}>
        <Button onClick={handleDownloadCv} disabled={downloading || !sample} size="lg" block>
          {downloading ? 'Preparing…' : cvDone ? 'Downloaded — download again' : 'Download example CV (.docx)'}
        </Button>

        {error && (
          <p role="alert" style={{ color: t.colour.dangerText, fontSize: t.font.size.body, margin: `${t.space.md} 0 0` }}>
            {error}
          </p>
        )}
        {cvDone && (
          <p role="status" style={{ color: t.colour.successText, fontSize: t.font.size.body, margin: `${t.space.md} 0 0` }}>
            Example CV downloaded successfully. Open it to see how the accepted edits read in a finished document.
          </p>
        )}
      </Card>

      {/* Guidance + scope note, in one yellow panel. */}
      <div
        style={{
          padding: `${t.space.md}`,
          background: t.colour.warnSoft,
          borderRadius: t.radius.md,
          border: `1px solid ${t.colour.warnBorder}`,
          display: 'flex',
          gap: '0.625rem',
          marginBottom: t.space.lg,
        }}
      >
        <span aria-hidden="true" style={{ fontSize: '1.125rem', lineHeight: 1.4 }}>⚠️</span>
        <div>
          <p style={{ fontSize: t.font.size.small, color: t.colour.warnText, margin: `0 0 ${t.space.xs}`, lineHeight: 1.6 }}>
            Please review this example CV carefully for correctness, accuracy and applicability before you use it.
          </p>
          <p style={{ fontSize: t.font.size.small, color: t.colour.warnText, margin: `0 0 ${t.space.xs}`, lineHeight: 1.6 }}>
            Remember to add your name and contact details before sending it to anyone.
          </p>
          <p style={{ fontSize: t.font.size.small, color: t.colour.warnText, margin: `0 0 ${t.space.xs}`, lineHeight: 1.6 }}>
            We wish you every success with your application.
          </p>
          <p style={{ fontSize: t.font.size.small, color: t.colour.warnText, margin: 0, lineHeight: 1.6 }}>
            This is a prepared example built from fictional example data, provided to show the output format.
            It is not your own CV.
          </p>
        </div>
      </div>

      {/* Navigation — consistent with the Back/next rows on earlier steps. */}
      <div style={{ display: 'flex', gap: t.space.sm, flexWrap: 'wrap' }}>
        <Button variant="subtle" onClick={onBack}>
          ← Back
        </Button>
        <Button variant="subtle" onClick={onRestart}>
          Try another example
        </Button>
        <Button onClick={onFeedback}>
          Share feedback
        </Button>
        <Button variant="secondary" onClick={onHome}>
          ⌂ Home
        </Button>
      </div>
    </main>
  );
}

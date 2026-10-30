import React, { useState } from 'react';
import { SessionProvider, useSession } from './session/SessionContext';
import { Step0Start } from './steps/Step0Start';
import { Step1Pick } from './steps/Step1Pick';
import { SamplePiiGate } from './steps/SamplePiiGate';
import { Step3Results } from './steps/Step3Results';
import { Step4Tailor } from './steps/Step4Tailor';
import { Step6Downloads } from './steps/Step6Downloads';
import { Step7Feedback } from './steps/Step7Feedback';
import { getSample, type SampleId } from './samples/sampleData';
import { Brand, Chip } from './theme/primitives';
import { tokens as t } from './theme/tokens';

/**
 * The wizard phases.
 *
 * The flow is deliberately lean for the single-sample demo:
 *   start → pick (Sample A bundle) → [piiGate] → results → tailor → download
 *
 * The PII gate is conditional (sample-dependent) and is skipped for Sample A,
 * which carries no PII. The gate, the multi-sample picker, and the restart
 * wiring all remain in place for Phase 2 (A/B/C chooser, live upload).
 */
type Phase = 'start' | 'pick' | 'piiGate' | 'results' | 'tailor' | 'download' | 'feedback';

/** Whether to show the RoleFit app header above a given phase. The landing
 *  screen carries its own branded hero, so the slim header starts from `pick`. */
const SHOW_HEADER: Record<Phase, boolean> = {
  start: false,
  pick: true,
  piiGate: true,
  results: true,
  tailor: true,
  download: true,
  feedback: true,
};

function AppHeader() {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        padding: '0.75rem 1.25rem',
        background: t.colour.surface,
        borderBottom: `1px solid ${t.colour.border}`,
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}
    >
      <Brand size="sm" />
      <Chip tone="brand">Early preview</Chip>
    </header>
  );
}

function Wizard() {
  const { dispatch } = useSession();
  const [phase, setPhase] = useState<Phase>('start');

  // "Home" is a full start-over: clear the session, then return to the landing.
  const goHome = () => {
    dispatch({ type: 'RESET' });
    setPhase('start');
  };

  // Advancing from the picker routes through the PII gate only when the PICKED
  // sample carries mock PII. The decision is taken from the id passed by the
  // picker, NOT from `state.selectedSample`, which has not updated yet on the
  // same render the pick fires (that lag caused the gate to be shown for the
  // wrong example / skipped for B).
  const afterPick = (id: SampleId) => {
    const picked = getSample(id);
    const hasPii = !!picked.pii?.triggers.length;
    setPhase(hasPii ? 'piiGate' : 'results');
  };

  // The landing phase sits on a white page canvas — white is reserved for
  // space that is not part of the working app, so the dark hero reads as a
  // distinct app frame against it. The actual work screens (pick → download)
  // use the light-grey app surface.
  const pageBackground = phase === 'start' ? t.colour.white : t.colour.bg;

  return (
    <div style={{ minHeight: '100%', background: pageBackground }}>
      {SHOW_HEADER[phase] && <AppHeader />}

      {phase === 'start' && <Step0Start onNext={() => setPhase('pick')} />}
      {phase === 'pick' && <Step1Pick onPick={afterPick} onBack={() => setPhase('start')} />}
      {phase === 'piiGate' && <SamplePiiGate onProceed={() => setPhase('results')} onBack={() => setPhase('pick')} />}
      {phase === 'results' && <Step3Results onNext={() => setPhase('tailor')} onBack={() => setPhase('pick')} />}
      {phase === 'tailor' && <Step4Tailor onNext={() => setPhase('download')} onBack={() => setPhase('results')} />}
      {phase === 'download' && (
        <Step6Downloads
          onBack={() => setPhase('tailor')}
          onRestart={() => setPhase('pick')}
          onHome={goHome}
          onFeedback={() => setPhase('feedback')}
        />
      )}
      {phase === 'feedback' && (
        <Step7Feedback onSkip={() => setPhase('download')} onHome={goHome} />
      )}
    </div>
  );
}

export function App() {
  return (
    <SessionProvider>
      <Wizard />
    </SessionProvider>
  );
}

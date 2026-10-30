/**
 * Bundled demo samples for the Role-Match CV Tailor concept demo.
 *
 * Each sample is ORIGINAL FICTION (no real CV is ever reused). A sample carries:
 *  - display metadata for the picker card,
 *  - a pre-authored {@link MatchResult} (score + Direct/Transferable/Gap
 *    evidence) shown after a brief simulated "Analysing…",
 *  - pre-authored {@link ProposedEdit}[] (grounded before/after tailor edits,
 *    each naming its source location), and
 *  - the filename of the hand-crafted, pixel-perfect tailored `.docx` served
 *    on download (Path 2).
 *
 * Grounding rule (owner Q5): every edit reorders/rephrases existing CV content
 * OR promotes genuine evidence that already exists elsewhere in the CV (its
 * `sourceNote` names where). Nothing is invented. Professional Experience is
 * never rewritten — edits only ever target the editable sections
 * (Professional_Profile / Career_Highlights / Core_Competencies).
 *
 * Sample B additionally embeds mock PII (email + phone + NRIC) so the privacy
 * warn-and-confirm gate can be demonstrated as a feature.
 */

import type { MatchResult, ProposedEdit } from '../../../shared/types';

/** The canonical demo sample identifiers. */
export type SampleId = 'A' | 'B' | 'C';

/** One proposed edit plus the demo-only source note shown under it. */
export interface SampleEdit extends ProposedEdit {
  /** Where the promoted/reordered evidence came from (shown in the UI). */
  sourceNote: string;
}

/** The mock PII a sample deliberately embeds (Sample B only). */
export interface SamplePii {
  /** Human-readable trigger labels shown in the privacy alert. */
  triggers: string[];
}

/** A complete bundled demo sample. */
export interface Sample {
  id: SampleId;
  /** Short card title, e.g. "Healthcare". */
  sector: string;
  /** The move being demonstrated, e.g. "Senior Staff Nurse → Nurse Manager". */
  transition: string;
  /** One-line card teaser. */
  teaser: string;
  /** Pre-authored assessment result (score + evidence). */
  result: MatchResult;
  /** Two-sentence recruiter summary shown above the table. */
  summary: string;
  /** Pre-authored grounded tailor edits. */
  edits: SampleEdit[];
  /** Hand-crafted tailored .docx served on download (lives in web/public). */
  docxFile: string;
  /** Mock PII to surface via the warn-and-confirm gate (Sample B only). */
  pii?: SamplePii;
}

// ---------------------------------------------------------------------------
// Sample A — Healthcare (score 7)
// ---------------------------------------------------------------------------

const SAMPLE_A: Sample = {
  id: 'A',
  sector: 'Healthcare',
  transition: 'Senior Staff Nurse → Nurse Manager',
  teaser: 'Strong floor credibility; the management proof is there but buried.',
  summary:
    'You clearly run a ward day-to-day and have the clinical depth a Nurse Manager needs, so the floor credibility is not in question. What is missing is the proof a hiring panel actually scores on: formal people-leadership span, budget/roster ownership, and a measurable quality or patient-safety outcome you led — right now those are implied, not stated.',
  result: {
    mode: 'free',
    score: 7,
    noRequirements: false,
    direct: [
      {
        type: 'direct',
        requirementId: 'a-d1',
        requirementText: 'Registered nurse with 5+ years acute care',
        cvEvidence: '8 years acute medical/surgical ward, SNB-registered',
        section: 'Professional_Experience',
      },
      {
        type: 'direct',
        requirementId: 'a-d2',
        requirementText: 'Clinical supervision of junior nursing staff',
        cvEvidence: 'Precept and supervise 6 junior staff nurses and nursing students',
        section: 'Professional_Experience',
      },
      {
        type: 'direct',
        requirementId: 'a-d3',
        requirementText: 'Medication safety / infection control compliance',
        cvEvidence: 'Ward infection-control link nurse; zero medication-error audit flags 2023',
        section: 'Professional_Experience',
      },
    ],
    transferable: [
      {
        type: 'transferable',
        requirementId: 'a-t1',
        requirementText: 'People / team leadership',
        cvEvidence: 'Acts as shift-in-charge coordinating a 12-bed team (informal, not a titled role)',
        section: 'Professional_Experience',
      },
      {
        type: 'transferable',
        requirementId: 'a-t2',
        requirementText: 'Service-improvement delivery',
        cvEvidence: 'Led a ward handover-process change that cut handover time',
        section: 'Career_Highlights',
      },
    ],
    gaps: [
      {
        type: 'gap',
        requirementId: 'a-g1',
        requirementText: 'Formal line-management of a nursing team (headcount, appraisals)',
      },
      {
        type: 'gap',
        requirementId: 'a-g2',
        requirementText: 'Budget / roster / resource ownership',
      },
      {
        type: 'gap',
        requirementId: 'a-g3',
        requirementText: 'Quantified patient-safety or quality outcome',
      },
    ],
  },
  edits: [
    {
      id: 'a-e1',
      section: 'Professional_Profile',
      originalText:
        'Dedicated and compassionate senior staff nurse with experience in acute ward settings.',
      recommendedText:
        'Senior Staff Nurse (8 years, acute medical/surgical) who coordinates a 12-bed shift team and led a handover redesign adopted ward-wide — stepping toward formal nursing management.',
      explanation:
        'Pulls the shift-leadership and the adopted process change into the opening line so a panel sees management readiness first.',
      accepted: false,
      sourceNote: 'Promoted from Professional Experience + Career Highlights.',
    },
    {
      id: 'a-e2',
      section: 'Career_Highlights',
      originalText:
        '1. Patient-satisfaction feedback  2. Infection-control link nurse  3. Precepting juniors  4. Led ward handover redesign',
      recommendedText:
        '1. Led ward handover redesign (adopted ward-wide)  2. Infection-control link nurse  3. Precepting juniors  4. Patient-satisfaction feedback',
      explanation:
        'Reorders the existing highlights so the strongest leadership/quality signal leads; wording is unchanged.',
      accepted: false,
      sourceNote: 'Reorder only; the bullets themselves are unchanged.',
    },
    {
      id: 'a-e3',
      section: 'Core_Competencies',
      originalText: 'Teamwork; patient care; shift handovers.',
      recommendedText:
        'Shift-team coordination (12-bed); clinical precepting of junior staff; ward service-improvement; infection-control link nurse.',
      explanation:
        'Renames generic skills using the candidate’s own concrete responsibilities so each maps to a JD requirement.',
      accepted: false,
      sourceNote: 'Rephrase of existing competencies; nothing added that isn’t in Experience.',
    },
  ],
  docxFile: 'sample-a-tailored-cv.docx',
};

// ---------------------------------------------------------------------------
// Sample B — Finance exec with mock PII (score 8)
// ---------------------------------------------------------------------------

const SAMPLE_B: Sample = {
  id: 'B',
  sector: 'Finance / Banking',
  transition: 'Senior Finance Manager → Finance Director',
  teaser: 'Director-level numbers — and a live demo of the privacy warning.',
  summary:
    'On numbers you’re already operating at Director level — regional consolidation, board-facing reporting, and a real cost-out result are all here, which is why this scores high. The one thing a board will probe is strategic ownership beyond finance-as-a-function: you’ve influenced commercial decisions but haven’t yet framed yourself as a partner who drives them.',
  result: {
    mode: 'free',
    score: 8,
    noRequirements: false,
    direct: [
      {
        type: 'direct',
        requirementId: 'b-d1',
        requirementText: 'Regional financial consolidation & reporting',
        cvEvidence: 'Consolidated monthly reporting across 5 SEA entities',
        section: 'Professional_Experience',
      },
      {
        type: 'direct',
        requirementId: 'b-d2',
        requirementText: 'Board / audit committee engagement',
        cvEvidence: 'Present quarterly results to the Audit Committee',
        section: 'Professional_Experience',
      },
      {
        type: 'direct',
        requirementId: 'b-d3',
        requirementText: 'Cost optimisation delivery',
        cvEvidence: 'Led a procurement review delivering S$2.4m annual savings',
        section: 'Career_Highlights',
      },
      {
        type: 'direct',
        requirementId: 'b-d4',
        requirementText: 'Team leadership',
        cvEvidence: 'Manage a 9-person regional finance team',
        section: 'Professional_Experience',
      },
    ],
    transferable: [
      {
        type: 'transferable',
        requirementId: 'b-t1',
        requirementText: 'Commercial / strategic partnering',
        cvEvidence: 'Supported pricing decisions for a product launch',
        section: 'Professional_Experience',
      },
      {
        type: 'transferable',
        requirementId: 'b-t2',
        requirementText: 'M&A / corporate development',
        cvEvidence: 'Ran financial due diligence on one acquisition',
        section: 'Career_Highlights',
      },
    ],
    gaps: [
      {
        type: 'gap',
        requirementId: 'b-g1',
        requirementText: 'Owning enterprise strategy / commercial P&L',
      },
      {
        type: 'gap',
        requirementId: 'b-g2',
        requirementText: 'External stakeholder / investor relations',
      },
    ],
  },
  edits: [
    {
      id: 'b-e1',
      section: 'Professional_Profile',
      originalText: 'Experienced finance manager with regional reporting responsibilities.',
      recommendedText:
        'Senior Finance Manager leading regional consolidation across 5 SEA entities and a 9-person team, with a S$2.4m cost-out and board-level reporting to the Audit Committee.',
      explanation:
        'Lifts the headcount, the quantified saving, and board exposure into the first line so Director-level scope is obvious instantly.',
      accepted: false,
      sourceNote: 'Promoted from Professional Experience + Career Highlights.',
    },
    {
      id: 'b-e2',
      section: 'Career_Highlights',
      originalText:
        '1. Standardised monthly consolidation  2. Financial due diligence on an acquisition  3. Led procurement review (S$2.4m savings)',
      recommendedText:
        '1. Led procurement review (S$2.4m savings)  2. Financial due diligence on an acquisition  3. Standardised monthly consolidation',
      explanation:
        'Reorders existing highlights so the quantified bottom-line result leads, letting a recruiter tick "delivers value" at a glance.',
      accepted: false,
      sourceNote: 'Reorder only; the bullets themselves are unchanged.',
    },
    {
      id: 'b-e3',
      section: 'Core_Competencies',
      originalText: 'Financial reporting; budgeting; team management.',
      recommendedText:
        'Regional consolidation (5 entities); board & audit-committee reporting; cost optimisation (S$2.4m delivered); commercial decision support.',
      explanation:
        'Renames generic competencies with the candidate’s real, quantified scope and surfaces the commercial-partnering angle the JD asks for.',
      accepted: false,
      sourceNote: 'Rephrase of existing content; commercial-support point drawn from Professional Experience.',
    },
  ],
  docxFile: 'sample-b-tailored-cv.docx',
  pii: {
    triggers: ['email', 'phone', 'nric_fin'],
  },
};

// ---------------------------------------------------------------------------
// Sample C — Banking, stretch (score 6)
// ---------------------------------------------------------------------------

const SAMPLE_C: Sample = {
  id: 'C',
  sector: 'Banking',
  transition: 'Credit Risk Analyst → AVP, Credit Risk',
  teaser: 'A capable analyst reaching up a level — an honest, mid-range match.',
  summary:
    'Your technical credit-risk foundation is solid and clearly relevant — modelling, portfolio monitoring, and regulatory awareness are all evidenced. But an AVP role is judged on ownership and influence, not analysis alone, and right now the CV reads as "does the analysis for others" rather than "owns the credit decision and the stakeholders around it".',
  result: {
    mode: 'free',
    score: 6,
    noRequirements: false,
    direct: [
      {
        type: 'direct',
        requirementId: 'c-d1',
        requirementText: 'Credit risk analysis for corporate portfolios',
        cvEvidence: 'Assess credit for a S$300m corporate portfolio',
        section: 'Professional_Experience',
      },
      {
        type: 'direct',
        requirementId: 'c-d2',
        requirementText: 'Credit modelling / scoring',
        cvEvidence: 'Built and maintained PD/LGD scoring models',
        section: 'Professional_Experience',
      },
      {
        type: 'direct',
        requirementId: 'c-d3',
        requirementText: 'Regulatory awareness (MAS / Basel)',
        cvEvidence: 'Prepare inputs for MAS regulatory reporting',
        section: 'Professional_Experience',
      },
    ],
    transferable: [
      {
        type: 'transferable',
        requirementId: 'c-t1',
        requirementText: 'Stakeholder influence / recommendations',
        cvEvidence: 'Writes credit recommendations reviewed by the credit committee (analyst-level input)',
        section: 'Professional_Experience',
      },
      {
        type: 'transferable',
        requirementId: 'c-t2',
        requirementText: 'Mentoring / early leadership',
        cvEvidence: 'Onboarded 2 new analysts',
        section: 'Career_Highlights',
      },
    ],
    gaps: [
      {
        type: 'gap',
        requirementId: 'c-g1',
        requirementText: 'Owning credit approval / signing authority',
      },
      {
        type: 'gap',
        requirementId: 'c-g2',
        requirementText: 'Managing a credit-risk team',
      },
      {
        type: 'gap',
        requirementId: 'c-g3',
        requirementText: 'Client / relationship-manager negotiation',
      },
    ],
  },
  edits: [
    {
      id: 'c-e1',
      section: 'Professional_Profile',
      originalText: 'Credit risk analyst with experience in corporate lending.',
      recommendedText:
        'Credit Risk Analyst covering a S$300m corporate portfolio, building the PD/LGD models and writing the credit recommendations the committee relies on.',
      explanation:
        'Surfaces portfolio size, model ownership, and committee-facing recommendations so readiness-to-step-up is visible first.',
      accepted: false,
      sourceNote: 'Promoted from Professional Experience.',
    },
    {
      id: 'c-e2',
      section: 'Career_Highlights',
      originalText:
        '1. Built/maintained PD/LGD models  2. Assessed a S$300m portfolio  3. Onboarded & mentored 2 new analysts',
      recommendedText:
        '1. Built/maintained PD/LGD models  2. Onboarded & mentored 2 new analysts  3. Assessed a S$300m portfolio',
      explanation:
        'Reorders existing highlights so the early-leadership signal is visible near the top, not buried last — important for an AVP step-up.',
      accepted: false,
      sourceNote: 'Reorder only; the bullets themselves are unchanged.',
    },
    {
      id: 'c-e3',
      section: 'Core_Competencies',
      originalText: 'Credit analysis; Excel; reporting.',
      recommendedText:
        'Corporate credit assessment (S$300m book); PD/LGD model development; credit-committee recommendations; MAS regulatory reporting.',
      explanation:
        'Replaces generic skills with the candidate’s real scope and names the committee-recommendation influence that maps to the AVP requirement.',
      accepted: false,
      sourceNote: 'Rephrase of existing content; nothing invented.',
    },
  ],
  docxFile: 'sample-c-tailored-cv.docx',
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/** All demo samples, in picker display order. */
export const SAMPLES: readonly Sample[] = [SAMPLE_A, SAMPLE_B, SAMPLE_C];

/** Look up a sample by id. */
export function getSample(id: SampleId): Sample {
  const found = SAMPLES.find((s) => s.id === id);
  if (!found) throw new Error(`Unknown sample id: ${id}`);
  return found;
}

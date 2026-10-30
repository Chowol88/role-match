/**
 * Client-side tailored-CV document builder.
 *
 * Builds the example CV `.docx` in the browser AT DOWNLOAD TIME so the file
 * reflects exactly which edits the user accepted — honouring reject / no-click
 * per row. This replaces the previous static `public/*.docx` fetch, which
 * always contained every edit regardless of the user's choices.
 *
 * Model: each CV is a fixed scaffold (name header, Professional Experience,
 * Education, etc.) plus THREE switchable sections — Professional Profile,
 * Career Highlights, Core Competencies. For each switchable section we render
 * the ACCEPTED (recommended) version when that section's edit is accepted, and
 * the ORIGINAL (untailored) version otherwise. With nothing accepted the file
 * is the plain, untailored CV.
 *
 * Content and formatting mirror `scripts/build-sample-docx.mjs`; the advisory
 * block is intentionally NOT included here — that guidance is shown on-screen
 * on the download step instead.
 */

import {
  AlignmentType,
  Document,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  TextRun,
} from 'docx';
import type { Sample } from '../samples/sampleData';
import type { CanonicalSection, ProposedEdit } from '../../../shared/types';

const NAME_PLACEHOLDER = '[Your Name]';
const CONTACT_PLACEHOLDER = '[Add your contact details before sending]';
const BULLET_REFERENCE = 'cv-bullets';

// ---------------------------------------------------------------------------
// Formatting helpers (mirror scripts/build-sample-docx.mjs)
// ---------------------------------------------------------------------------

function nameHeader(): Paragraph[] {
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [new TextRun({ text: NAME_PLACEHOLDER, bold: true, size: 36 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [new TextRun({ text: CONTACT_PLACEHOLDER, italics: true, size: 18, color: '6b7280' })],
    }),
  ];
}

function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 200, after: 80 },
    children: [new TextRun({ text, bold: true })],
  });
}

function para(text: string): Paragraph {
  return new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text })] });
}

function bullet(text: string): Paragraph {
  return new Paragraph({
    numbering: { reference: BULLET_REFERENCE, level: 0 },
    spacing: { after: 60 },
    children: [new TextRun({ text })],
  });
}

function experienceEntry(title: string, employer: string, dates: string, bullets: string[]): Paragraph[] {
  return [
    new Paragraph({
      spacing: { before: 140, after: 0 },
      keepNext: true,
      children: [
        new TextRun({ text: `${title}, `, bold: true }),
        new TextRun({ text: employer, bold: true }),
      ],
    }),
    new Paragraph({
      spacing: { after: 60 },
      keepNext: true,
      children: [new TextRun({ text: dates, italics: true, color: '6b7280', size: 18 })],
    }),
    ...bullets.map((b) => bullet(b)),
  ];
}

function credentialEntry(qualification: string, institution: string, year: string): Paragraph[] {
  return [
    new Paragraph({ spacing: { before: 100, after: 0 }, children: [new TextRun({ text: qualification, bold: true })] }),
    new Paragraph({
      spacing: { after: 40 },
      children: [new TextRun({ text: `${institution}${year ? `  ·  ${year}` : ''}`, italics: true, color: '6b7280', size: 18 })],
    }),
  ];
}

function labelledLine(label: string, value: string): Paragraph {
  return new Paragraph({
    spacing: { after: 60 },
    children: [new TextRun({ text: `${label}: `, bold: true }), new TextRun({ text: value })],
  });
}

// ---------------------------------------------------------------------------
// Switchable-section content
// ---------------------------------------------------------------------------

/**
 * The ACCEPTED (tailored) rendering of the three switchable sections, per
 * sample. Mirrors the rich content in scripts/build-sample-docx.mjs. The
 * ORIGINAL (rejected / not-accepted) rendering is derived from the edit's
 * `originalText` in sampleData — see {@link originalSection}.
 */
type SectionId = Extract<CanonicalSection, 'Professional_Profile' | 'Career_Highlights' | 'Core_Competencies'>;

const ACCEPTED_SECTIONS: Record<Sample['id'], Record<SectionId, Paragraph[]>> = {
  A: {
    Professional_Profile: [
      para(
        'Senior Staff Nurse with 8 years in acute medical/surgical care, currently coordinating a 12-bed shift team as shift-in-charge in a restructured hospital ward. Singapore Nursing Board (SNB)-registered, with a consistent track record in clinical quality, infection control and the development of junior nursing staff. Led a ward handover redesign that was adopted ward-wide, and now stepping toward formal nursing management with proven day-to-day leadership of the floor.'
      ),
    ],
    Career_Highlights: [
      bullet('Led ward handover redesign adopted across the ward, cutting handover time and reducing missed tasks.'),
      bullet('Served as ward infection-control link nurse with zero medication-error audit flags in 2023.'),
      bullet('Precepted and supervised 6 junior staff nurses and nursing students.'),
      bullet('Coordinated a 12-bed team as shift-in-charge across day and night rotations.'),
      bullet('Recognised for consistent patient-satisfaction feedback across medical/surgical rotations.'),
    ],
    Core_Competencies: [
      para('Shift-team coordination (12-bed)  |  Clinical precepting of junior staff  |  Ward service-improvement  |  Infection-control link nurse  |  Medication safety & documentation compliance  |  Patient and family communication'),
    ],
  },
  B: {
    Professional_Profile: [
      para(
        'Senior Finance Manager with 12 years in regional finance across South-East Asia, currently leading monthly consolidation across 5 SEA entities and a 9-person team. Chartered Accountant (CA Singapore) with board-level exposure, presenting quarterly results to the Audit Committee and partnering the business on commercial decisions. Delivered a S$2.4m annual cost-out and standardised regional close, and is now targeting a Finance Director role with full strategic and commercial ownership.'
      ),
    ],
    Career_Highlights: [
      bullet('Led a procurement review delivering S$2.4m in annual savings.'),
      bullet('Ran financial due diligence on a regional acquisition.'),
      bullet('Standardised monthly consolidation across 5 SEA entities, shortening the close cycle.'),
      bullet('Presented quarterly results and risk matters to the Audit Committee.'),
      bullet('Managed and developed a 9-person regional finance team across multiple markets.'),
    ],
    Core_Competencies: [
      para('Regional consolidation (5 entities)  |  Board & audit-committee reporting  |  Cost optimisation (S$2.4m delivered)  |  Commercial decision support  |  Financial due diligence  |  Team leadership & development'),
    ],
  },
  C: {
    Professional_Profile: [
      para(
        'Credit Risk Analyst with 7 years in corporate and commercial banking in Singapore, covering a S$300m corporate portfolio. Builds and maintains the PD/LGD scoring models and writes the credit recommendations the credit committee relies on, with hands-on MAS regulatory reporting experience. Known for rigorous credit analysis and clear write-ups, and now working toward an AVP, Credit Risk role with greater ownership of credit decisions and stakeholder relationships.'
      ),
    ],
    Career_Highlights: [
      bullet('Built and maintained PD/LGD scoring models used for portfolio decisions.'),
      bullet('Onboarded and mentored 2 new analysts.'),
      bullet('Assessed credit for a S$300m corporate portfolio with no overdue review breaches.'),
      bullet('Authored credit recommendations reviewed by the credit committee.'),
      bullet('Prepared inputs for MAS regulatory reporting on schedule each cycle.'),
    ],
    Core_Competencies: [
      para('Corporate credit assessment (S$300m book)  |  PD/LGD model development  |  Credit-committee recommendations  |  MAS regulatory reporting  |  Financial spreading & covenant monitoring  |  Analyst mentoring'),
    ],
  },
};

/** The fixed, non-switchable scaffold after the three editable sections. */
const SCAFFOLD: Record<Sample['id'], Paragraph[]> = {
  A: [
    sectionHeading('Professional Experience'),
    ...experienceEntry('Senior Staff Nurse', 'Acute Medical/Surgical Ward, Restructured Hospital (Singapore)', 'Jan 2019 – Present', [
      'Coordinate a 12-bed team as shift-in-charge, allocating workload across nurses and support staff.',
      'Precept and supervise 6 junior staff nurses and nursing students, including competency sign-off and clinical mentoring.',
      'Act as ward infection-control link nurse; zero medication-error audit flags in 2023.',
      'Led a ward handover-process change that cut handover time and reduced missed clinical tasks.',
      'Manage escalation of deteriorating patients, liaising with the medical team and allied health.',
      'Support ward audits on hand hygiene, falls prevention and medication administration records.',
    ]),
    ...experienceEntry('Staff Nurse', 'General Medical Ward, Restructured Hospital (Singapore)', 'Mar 2016 – Dec 2018', [
      'Delivered direct patient care across a broad medical and surgical case mix.',
      'Administered medication and maintained documentation compliance to ward standards.',
      'Coordinated admissions, discharges and transfers with the multidisciplinary team.',
      'Precepted student nurses on clinical attachment during their ward rotations.',
    ]),
    ...experienceEntry('Enrolled Nurse', 'Community Hospital (Singapore)', 'Jul 2014 – Feb 2016', [
      'Provided bedside care and rehabilitation support for sub-acute and step-down patients.',
      'Monitored vital signs and reported changes in patient condition to registered nurses.',
      'Assisted with activities of daily living and supported family education on discharge care.',
    ]),
    sectionHeading('Education & Professional Credentials'),
    ...credentialEntry('Bachelor of Science (Nursing)', 'Local university, Singapore', '2014'),
    ...credentialEntry('Registered Nurse — Singapore Nursing Board (SNB)', 'Current practising certificate', ''),
    ...credentialEntry('Diploma in Nursing', 'Local polytechnic, Singapore', '2011'),
    sectionHeading('Certifications & Professional Development'),
    bullet('Basic and Advanced Cardiac Life Support (BCLS / ACLS) — current.'),
    bullet('Infection Control Link Nurse programme.'),
    bullet('Preceptorship and clinical teaching workshop.'),
    sectionHeading('Languages'),
    labelledLine('Languages', 'English (professional); Mandarin and Malay (conversational)'),
  ],
  B: [
    sectionHeading('Professional Experience'),
    ...experienceEntry('Senior Finance Manager', 'Regional Consumer Group (SEA)', 'Apr 2018 – Present', [
      'Consolidate monthly reporting across 5 SEA entities.',
      'Manage a 9-person regional finance team across multiple markets.',
      'Present quarterly results to the Audit Committee.',
      'Supported pricing decisions for a product launch.',
      'Led a group-wide procurement review delivering S$2.4m in annual savings.',
      'Ran financial due diligence on a regional acquisition, from data room to integration planning.',
    ]),
    ...experienceEntry('Finance Manager', 'Manufacturing Division, Regional Group', 'Jan 2013 – Mar 2018', [
      'Owned the divisional budget, forecast and monthly management accounts.',
      'Partnered operations on cost control, variance analysis and capital expenditure cases.',
      'Implemented monthly business reviews adopted across the division.',
      'Coordinated the external audit and statutory reporting for the division.',
    ]),
    ...experienceEntry('Senior Auditor / Audit Associate', 'Professional Services Firm (Singapore)', 'Aug 2009 – Dec 2012', [
      'Led statutory audit engagements for mid-market and listed clients across sectors.',
      'Reviewed group consolidations and assessed internal controls over financial reporting.',
      'Supervised and coached junior audit staff on engagement teams.',
    ]),
    sectionHeading('Education & Professional Credentials'),
    ...credentialEntry('Chartered Accountant of Singapore (CA Singapore)', 'Institute of Singapore Chartered Accountants (ISCA)', ''),
    ...credentialEntry('Bachelor of Accountancy', 'Local university, Singapore', '2009'),
    sectionHeading('Systems & Technical'),
    labelledLine('ERP & reporting', 'SAP, Oracle Hyperion / consolidation tools, advanced Excel'),
    labelledLine('Standards', 'SFRS / IFRS, group consolidation, management reporting'),
    sectionHeading('Languages'),
    labelledLine('Languages', 'English (professional); Mandarin (professional)'),
  ],
  C: [
    sectionHeading('Professional Experience'),
    ...experienceEntry('Credit Risk Analyst', 'Corporate Banking, Bank (Singapore)', 'Feb 2019 – Present', [
      'Assess credit for a S$300m corporate portfolio.',
      'Built and maintained PD/LGD scoring models.',
      'Write credit recommendations reviewed by the credit committee.',
      'Prepare inputs for MAS regulatory reporting.',
      'Onboarded 2 new analysts.',
      'Conduct annual and interim credit reviews, monitoring covenants and early-warning indicators.',
    ]),
    ...experienceEntry('Credit Analyst', 'Commercial Banking, Bank (Singapore)', 'Jan 2016 – Jan 2019', [
      'Spread financials and prepared credit memos for SME lending.',
      'Monitored covenant compliance across an assigned book.',
      'Supported relationship managers on renewals, limit reviews and annual reviews.',
      'Flagged deteriorating names early for closer monitoring and remedial action.',
    ]),
    ...experienceEntry('Management Associate (Risk)', 'Bank (Singapore)', 'Jul 2014 – Dec 2015', [
      'Rotated across credit risk, operations and reporting as part of a graduate programme.',
      'Built reconciliation and reporting templates still used by the team.',
    ]),
    sectionHeading('Education & Professional Credentials'),
    ...credentialEntry('Bachelor of Business / Finance', 'Local university, Singapore', '2014'),
    ...credentialEntry('Financial Risk Manager (FRM)', 'GARP — Part I completed, Part II in progress', ''),
    sectionHeading('Systems & Technical'),
    labelledLine('Tools', 'Moody\u2019s / credit rating tools, SQL, advanced Excel, Python (basic)'),
    labelledLine('Regulatory', 'MAS reporting, Basel capital & provisioning concepts'),
    sectionHeading('Languages'),
    labelledLine('Languages', 'English (professional); Mandarin (professional)'),
  ],
};

/** Heading label per switchable section. */
const SECTION_HEADING: Record<SectionId, string> = {
  Professional_Profile: 'Professional Profile',
  Career_Highlights: 'Career Highlights',
  Core_Competencies: 'Core Competencies',
};

/** The display order of the three switchable sections. */
const SECTION_ORDER: SectionId[] = ['Professional_Profile', 'Career_Highlights', 'Core_Competencies'];

/**
 * Render the ORIGINAL (untailored) version of a switchable section from the
 * edit's `originalText`. Profile/Competencies are single paragraphs; Career
 * Highlights' original text is a "1. … 2. …" run we split back into bullets.
 */
function originalSection(section: SectionId, originalText: string): Paragraph[] {
  if (section === 'Career_Highlights') {
    const items = originalText
      .split(/\s*\d+\.\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (items.length > 1) return items.map((it) => bullet(it));
  }
  return [para(originalText)];
}

// ---------------------------------------------------------------------------
// Public builder
// ---------------------------------------------------------------------------

/**
 * Build the example CV as a Blob, applying ONLY the accepted edits. An edit is
 * applied when its id is in `acceptedEditIds`; otherwise that section keeps its
 * original wording. Sections with no corresponding edit always use the
 * accepted (prepared) content as a sensible default.
 */
export async function buildCvDocx(sample: Sample, edits: ProposedEdit[]): Promise<Blob> {
  const acceptedBySection = new Map<string, boolean>();
  const originalBySection = new Map<string, string>();
  for (const e of edits) {
    acceptedBySection.set(e.section, e.accepted);
    originalBySection.set(e.section, e.originalText);
  }

  const children: Paragraph[] = [...nameHeader()];

  for (const section of SECTION_ORDER) {
    children.push(sectionHeading(SECTION_HEADING[section]));
    const hasEdit = acceptedBySection.has(section);
    const accepted = acceptedBySection.get(section) === true;
    if (!hasEdit || accepted) {
      children.push(...ACCEPTED_SECTIONS[sample.id][section]);
    } else {
      children.push(...originalSection(section, originalBySection.get(section) ?? ''));
    }
  }

  children.push(...SCAFFOLD[sample.id]);

  const doc = new Document({
    numbering: {
      config: [
        {
          reference: BULLET_REFERENCE,
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: '\u2022',
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 360, hanging: 260 } } },
            },
          ],
        },
      ],
    },
    styles: {
      default: { document: { run: { font: 'Calibri', size: 22 } } },
      paragraphStyles: [
        {
          id: 'Heading1',
          name: 'Heading 1',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { bold: true, size: 26, color: '1e3a8a' },
          paragraph: {
            spacing: { before: 200, after: 80 },
            border: { bottom: { style: 'single', size: 6, color: '1e3a8a', space: 4 } },
          },
        },
      ],
    },
    sections: [{ children }],
  });

  return Packer.toBlob(doc);
}

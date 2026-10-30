// scripts/build-sample-docx.mjs
//
// Authors the three hand-crafted, pixel-perfect tailored CV .docx files for the
// concept demo (Path 2). Each file is a designed Word document — styled
// headings, bold role/employer runs, real bullet lists, consistent spacing —
// with the agreed tailor edits already applied and the Professional Experience
// section left intact. Output goes to web/public so Vite serves them statically.
//
// Run: node scripts/build-sample-docx.mjs
//
// NOTE: this is a build-time asset generator, not shipped app code. It uses the
// `docx` library (already a project dependency).

import {
  AlignmentType,
  Document,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  TextRun,
} from 'docx';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'web', 'public');

// ---------------------------------------------------------------------------
// Formatting helpers — shared look across all three CVs
// ---------------------------------------------------------------------------

const NAME_PLACEHOLDER = '[Your Name]';
const CONTACT_PLACEHOLDER = '[Add your contact details before sending]';

const ADVISORY = [
  'Please review this revised CV carefully for correctness, accuracy, and applicability before you use it.',
  'Remember to add your name and contact details before sending it to anyone.',
  'We wish you every success with your application.',
];

/** A bullet-list reference so all three docs share one numbering definition. */
const BULLET_REFERENCE = 'cv-bullets';

const numbering = {
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
};

function nameHeader() {
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

function sectionHeading(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 200, after: 80 },
    children: [new TextRun({ text, bold: true })],
  });
}

function para(text, opts = {}) {
  return new Paragraph({
    spacing: { after: opts.after ?? 100 },
    children: [new TextRun({ text, italics: opts.italics, color: opts.color })],
  });
}

/** A real Word bullet. `runs` is an array of {text, bold?} for inline styling. */
function bullet(runs) {
  const children = (Array.isArray(runs) ? runs : [{ text: runs }]).map(
    (r) => new TextRun({ text: r.text, bold: r.bold })
  );
  return new Paragraph({
    numbering: { reference: BULLET_REFERENCE, level: 0 },
    spacing: { after: 60 },
    children,
  });
}

/** An experience entry: bold "Title, Employer" then a dates line then bullets. */
function experienceEntry(title, employer, dates, bullets) {
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

/**
 * A credential / education entry: bold qualification, then an institution +
 * year line. Used for Education and Professional Credentials.
 */
function credentialEntry(qualification, institution, year) {
  return [
    new Paragraph({
      spacing: { before: 100, after: 0 },
      children: [new TextRun({ text: qualification, bold: true })],
    }),
    new Paragraph({
      spacing: { after: 40 },
      children: [new TextRun({ text: `${institution}${year ? `  ·  ${year}` : ''}`, italics: true, color: '6b7280', size: 18 })],
    }),
  ];
}

/** A compact "Label: value" line for short sections (Languages, Memberships). */
function labelledLine(label, value) {
  return new Paragraph({
    spacing: { after: 60 },
    children: [
      new TextRun({ text: `${label}: `, bold: true }),
      new TextRun({ text: value }),
    ],
  });
}

function advisoryBlock() {
  return [
    new Paragraph({ spacing: { before: 280, after: 40 }, border: { top: { style: 'single', size: 6, color: 'd1d5db', space: 8 } }, children: [] }),
    ...ADVISORY.map(
      (line) =>
        new Paragraph({
          spacing: { after: 60 },
          children: [new TextRun({ text: line, italics: true, size: 18, color: '6b7280' })],
        })
    ),
  ];
}

function buildDoc(children) {
  return new Document({
    numbering,
    styles: {
      default: {
        document: { run: { font: 'Calibri', size: 22 } },
      },
      paragraphStyles: [
        {
          id: 'Heading1',
          name: 'Heading 1',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { bold: true, size: 26, color: '1e3a8a' },
          paragraph: { spacing: { before: 200, after: 80 }, border: { bottom: { style: 'single', size: 6, color: '1e3a8a', space: 4 } } },
        },
      ],
    },
    sections: [{ children }],
  });
}

// ---------------------------------------------------------------------------
// Sample A — Healthcare (tailored: all 3 edits applied)
// ---------------------------------------------------------------------------

function sampleA() {
  return buildDoc([
    ...nameHeader(),

    sectionHeading('Professional Profile'),
    para(
      'Senior Staff Nurse with 8 years in acute medical/surgical care, currently coordinating a 12-bed shift team as shift-in-charge in a restructured hospital ward. Singapore Nursing Board (SNB)-registered, with a consistent track record in clinical quality, infection control and the development of junior nursing staff. Led a ward handover redesign that was adopted ward-wide, and now stepping toward formal nursing management with proven day-to-day leadership of the floor.'
    ),

    sectionHeading('Career Highlights'),
    bullet([{ text: 'Led ward handover redesign adopted across the ward, cutting handover time and reducing missed tasks.' }]),
    bullet([{ text: 'Served as ward infection-control link nurse with zero medication-error audit flags in 2023.' }]),
    bullet([{ text: 'Precepted and supervised 6 junior staff nurses and nursing students.' }]),
    bullet([{ text: 'Coordinated a 12-bed team as shift-in-charge across day and night rotations.' }]),
    bullet([{ text: 'Recognised for consistent patient-satisfaction feedback across medical/surgical rotations.' }]),

    sectionHeading('Core Competencies'),
    para('Shift-team coordination (12-bed)  |  Clinical precepting of junior staff  |  Ward service-improvement  |  Infection-control link nurse  |  Medication safety & documentation compliance  |  Patient and family communication'),

    sectionHeading('Professional Experience'),
    ...experienceEntry('Senior Staff Nurse', 'Acute Medical/Surgical Ward, Restructured Hospital (Singapore)', 'Jan 2019 – Present', [
      [{ text: 'Coordinate a 12-bed team as shift-in-charge, allocating workload across nurses and support staff.' }],
      [{ text: 'Precept and supervise 6 junior staff nurses and nursing students, including competency sign-off and clinical mentoring.' }],
      [{ text: 'Act as ward infection-control link nurse; zero medication-error audit flags in 2023.' }],
      [{ text: 'Led a ward handover-process change that cut handover time and reduced missed clinical tasks.' }],
      [{ text: 'Manage escalation of deteriorating patients, liaising with the medical team and allied health.' }],
      [{ text: 'Support ward audits on hand hygiene, falls prevention and medication administration records.' }],
    ]),
    ...experienceEntry('Staff Nurse', 'General Medical Ward, Restructured Hospital (Singapore)', 'Mar 2016 – Dec 2018', [
      [{ text: 'Delivered direct patient care across a broad medical and surgical case mix.' }],
      [{ text: 'Administered medication and maintained documentation compliance to ward standards.' }],
      [{ text: 'Coordinated admissions, discharges and transfers with the multidisciplinary team.' }],
      [{ text: 'Precepted student nurses on clinical attachment during their ward rotations.' }],
    ]),
    ...experienceEntry('Enrolled Nurse', 'Community Hospital (Singapore)', 'Jul 2014 – Feb 2016', [
      [{ text: 'Provided bedside care and rehabilitation support for sub-acute and step-down patients.' }],
      [{ text: 'Monitored vital signs and reported changes in patient condition to registered nurses.' }],
      [{ text: 'Assisted with activities of daily living and supported family education on discharge care.' }],
    ]),

    sectionHeading('Education & Professional Credentials'),
    ...credentialEntry('Bachelor of Science (Nursing)', 'Local university, Singapore', '2014'),
    ...credentialEntry('Registered Nurse — Singapore Nursing Board (SNB)', 'Current practising certificate', ''),
    ...credentialEntry('Diploma in Nursing', 'Local polytechnic, Singapore', '2011'),

    sectionHeading('Certifications & Professional Development'),
    bullet([{ text: 'Basic and Advanced Cardiac Life Support (BCLS / ACLS) — current.' }]),
    bullet([{ text: 'Infection Control Link Nurse programme.' }]),
    bullet([{ text: 'Preceptorship and clinical teaching workshop.' }]),

    sectionHeading('Languages'),
    labelledLine('Languages', 'English (professional); Mandarin and Malay (conversational)'),

    ...advisoryBlock(),
  ]);
}

// ---------------------------------------------------------------------------
// Sample B — Finance exec (tailored: all 3 edits applied).
// NOTE: the tailored OUTPUT is anonymised — the mock PII only lives in the
// demo's on-screen "uploaded" sample to trip the privacy gate, never here.
// ---------------------------------------------------------------------------

function sampleB() {
  return buildDoc([
    ...nameHeader(),

    sectionHeading('Professional Profile'),
    para(
      'Senior Finance Manager with 12 years in regional finance across South-East Asia, currently leading monthly consolidation across 5 SEA entities and a 9-person team. Chartered Accountant (CA Singapore) with board-level exposure, presenting quarterly results to the Audit Committee and partnering the business on commercial decisions. Delivered a S$2.4m annual cost-out and standardised regional close, and is now targeting a Finance Director role with full strategic and commercial ownership.'
    ),

    sectionHeading('Career Highlights'),
    bullet([{ text: 'Led a procurement review delivering S$2.4m in annual savings.' }]),
    bullet([{ text: 'Ran financial due diligence on a regional acquisition.' }]),
    bullet([{ text: 'Standardised monthly consolidation across 5 SEA entities, shortening the close cycle.' }]),
    bullet([{ text: 'Presented quarterly results and risk matters to the Audit Committee.' }]),
    bullet([{ text: 'Managed and developed a 9-person regional finance team across multiple markets.' }]),

    sectionHeading('Core Competencies'),
    para('Regional consolidation (5 entities)  |  Board & audit-committee reporting  |  Cost optimisation (S$2.4m delivered)  |  Commercial decision support  |  Financial due diligence  |  Team leadership & development'),

    sectionHeading('Professional Experience'),
    ...experienceEntry('Senior Finance Manager', 'Regional Consumer Group (SEA)', 'Apr 2018 – Present', [
      [{ text: 'Consolidate monthly reporting across 5 SEA entities.' }],
      [{ text: 'Manage a 9-person regional finance team across multiple markets.' }],
      [{ text: 'Present quarterly results to the Audit Committee.' }],
      [{ text: 'Supported pricing decisions for a product launch.' }],
      [{ text: 'Led a group-wide procurement review delivering S$2.4m in annual savings.' }],
      [{ text: 'Ran financial due diligence on a regional acquisition, from data room to integration planning.' }],
    ]),
    ...experienceEntry('Finance Manager', 'Manufacturing Division, Regional Group', 'Jan 2013 – Mar 2018', [
      [{ text: 'Owned the divisional budget, forecast and monthly management accounts.' }],
      [{ text: 'Partnered operations on cost control, variance analysis and capital expenditure cases.' }],
      [{ text: 'Implemented monthly business reviews adopted across the division.' }],
      [{ text: 'Coordinated the external audit and statutory reporting for the division.' }],
    ]),
    ...experienceEntry('Senior Auditor / Audit Associate', 'Professional Services Firm (Singapore)', 'Aug 2009 – Dec 2012', [
      [{ text: 'Led statutory audit engagements for mid-market and listed clients across sectors.' }],
      [{ text: 'Reviewed group consolidations and assessed internal controls over financial reporting.' }],
      [{ text: 'Supervised and coached junior audit staff on engagement teams.' }],
    ]),

    sectionHeading('Education & Professional Credentials'),
    ...credentialEntry('Chartered Accountant of Singapore (CA Singapore)', 'Institute of Singapore Chartered Accountants (ISCA)', ''),
    ...credentialEntry('Bachelor of Accountancy', 'Local university, Singapore', '2009'),

    sectionHeading('Systems & Technical'),
    labelledLine('ERP & reporting', 'SAP, Oracle Hyperion / consolidation tools, advanced Excel'),
    labelledLine('Standards', 'SFRS / IFRS, group consolidation, management reporting'),

    sectionHeading('Languages'),
    labelledLine('Languages', 'English (professional); Mandarin (professional)'),

    ...advisoryBlock(),
  ]);
}

// ---------------------------------------------------------------------------
// Sample C — Banking, stretch (tailored: all 3 edits applied)
// ---------------------------------------------------------------------------

function sampleC() {
  return buildDoc([
    ...nameHeader(),

    sectionHeading('Professional Profile'),
    para(
      'Credit Risk Analyst with 7 years in corporate and commercial banking in Singapore, covering a S$300m corporate portfolio. Builds and maintains the PD/LGD scoring models and writes the credit recommendations the credit committee relies on, with hands-on MAS regulatory reporting experience. Known for rigorous credit analysis and clear write-ups, and now working toward an AVP, Credit Risk role with greater ownership of credit decisions and stakeholder relationships.'
    ),

    sectionHeading('Career Highlights'),
    bullet([{ text: 'Built and maintained PD/LGD scoring models used for portfolio decisions.' }]),
    bullet([{ text: 'Onboarded and mentored 2 new analysts.' }]),
    bullet([{ text: 'Assessed credit for a S$300m corporate portfolio with no overdue review breaches.' }]),
    bullet([{ text: 'Authored credit recommendations reviewed by the credit committee.' }]),
    bullet([{ text: 'Prepared inputs for MAS regulatory reporting on schedule each cycle.' }]),

    sectionHeading('Core Competencies'),
    para('Corporate credit assessment (S$300m book)  |  PD/LGD model development  |  Credit-committee recommendations  |  MAS regulatory reporting  |  Financial spreading & covenant monitoring  |  Analyst mentoring'),

    sectionHeading('Professional Experience'),
    ...experienceEntry('Credit Risk Analyst', 'Corporate Banking, Bank (Singapore)', 'Feb 2019 – Present', [
      [{ text: 'Assess credit for a S$300m corporate portfolio.' }],
      [{ text: 'Built and maintained PD/LGD scoring models.' }],
      [{ text: 'Write credit recommendations reviewed by the credit committee.' }],
      [{ text: 'Prepare inputs for MAS regulatory reporting.' }],
      [{ text: 'Onboarded 2 new analysts.' }],
      [{ text: 'Conduct annual and interim credit reviews, monitoring covenants and early-warning indicators.' }],
    ]),
    ...experienceEntry('Credit Analyst', 'Commercial Banking, Bank (Singapore)', 'Jan 2016 – Jan 2019', [
      [{ text: 'Spread financials and prepared credit memos for SME lending.' }],
      [{ text: 'Monitored covenant compliance across an assigned book.' }],
      [{ text: 'Supported relationship managers on renewals, limit reviews and annual reviews.' }],
      [{ text: 'Flagged deteriorating names early for closer monitoring and remedial action.' }],
    ]),
    ...experienceEntry('Management Associate (Risk)', 'Bank (Singapore)', 'Jul 2014 – Dec 2015', [
      [{ text: 'Rotated across credit risk, operations and reporting as part of a graduate programme.' }],
      [{ text: 'Built reconciliation and reporting templates still used by the team.' }],
    ]),

    sectionHeading('Education & Professional Credentials'),
    ...credentialEntry('Bachelor of Business / Finance', 'Local university, Singapore', '2014'),
    ...credentialEntry('Financial Risk Manager (FRM)', 'GARP — Part I completed, Part II in progress', ''),

    sectionHeading('Systems & Technical'),
    labelledLine('Tools', 'Moody\u2019s / credit rating tools, SQL, advanced Excel, Python (basic)'),
    labelledLine('Regulatory', 'MAS reporting, Basel capital & provisioning concepts'),

    sectionHeading('Languages'),
    labelledLine('Languages', 'English (professional); Mandarin (professional)'),

    ...advisoryBlock(),
  ]);
}

// ---------------------------------------------------------------------------
// Write them out
// ---------------------------------------------------------------------------

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const jobs = [
    ['sample-a-tailored-cv.docx', sampleA()],
    ['sample-b-tailored-cv.docx', sampleB()],
    ['sample-c-tailored-cv.docx', sampleC()],
  ];
  for (const [filename, doc] of jobs) {
    const buffer = await Packer.toBuffer(doc);
    const path = join(OUT_DIR, filename);
    writeFileSync(path, buffer);
    console.log(`wrote ${path} (${buffer.length} bytes)`);
  }
  console.log('done');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

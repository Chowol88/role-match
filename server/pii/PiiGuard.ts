/**
 * PII guard for Role-Match CV Tailor.
 *
 * Runs on the uploaded CV text at upload time and reports EVERY hard-block PII
 * type found together (not just the first), plus a warn-only name heuristic.
 * Pure and deterministic — no I/O, no side effects.
 *
 * Hard-block detectors (see design.md "PII Detection"):
 *  - Email      — local-part, "@", domain, 2+ letter TLD.
 *  - Phone      — a candidate run that strips to 7–15 digits; a bare 4-digit
 *                 year and common date forms are excluded by a pre-filter run
 *                 BEFORE phone matching.
 *  - URL/social — strings beginning http(s):// or www., or containing a known
 *                 social-media domain.
 *  - NRIC/FIN   — a Singapore NRIC/FIN FORMAT match: prefix [STFGM], 7 digits,
 *                 1 trailing letter (format only — no checksum, the
 *                 conservative privacy choice).
 *  - Address    — a Singapore physical-address signal: a "#NN-NN" floor-unit
 *                 marker OR the word "Singapore" immediately followed by a
 *                 6-digit postal code. Free-form street lines are NOT parsed
 *                 (they over-block).
 *  - Passport   — a passport number keyed off an explicit "passport" label
 *                 (word-boundary, case-insensitive) near an alphanumeric token
 *                 of 6–9 chars containing at least one digit.
 *
 * These Singapore-context types (NRIC/FIN, address, passport) are hard-blocked
 * because the PDPC classifies them as personal data.
 *
 * Name heuristic (warn-only): flags a likely personal name near the top of the
 * document. It NEVER contributes to `blockedTypes` and NEVER sets `blocked`.
 *
 * @see design.md "PII Detection"
 * Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
 */

import type { PiiReport, PiiType } from "../../shared/types";

// ---------------------------------------------------------------------------
// Hard-block detector patterns
// ---------------------------------------------------------------------------

/** Email: local-part, "@", domain, and a 2+ letter TLD. */
const EMAIL_RE = /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/;

/**
 * Candidate phone run: an optional leading "+", optional "(", a leading digit,
 * then 5+ separator/digit characters, ending on a digit. Post-filtered on the
 * stripped digit count (7–15). Global so every candidate run is examined.
 */
const PHONE_CANDIDATE_RE = /\+?\(?\d[\d\s\-()]{5,}\d/g;

/** URL prefix: strings beginning http://, https://, or www. */
const URL_PREFIX_RE = /\b(?:https?:\/\/|www\.)\S+/i;

/** Known social-media domains that, when referenced, count as url_social. */
const SOCIAL_DOMAINS: readonly string[] = [
  "linkedin.com",
  "github.com",
  "twitter.com",
  "x.com",
  "facebook.com",
  "instagram.com",
  "t.me",
  "medium.com",
];

/**
 * Date-shaped substrings to strip BEFORE phone matching so they are never
 * mistaken for phone numbers:
 *  - dd/mm/yyyy or d/m/yyyy (and "." or "-" separated variants)
 *  - yyyy-mm-dd (and "/" or "." separated variants)
 */
const DATE_SHAPED_RE =
  /\b(?:\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}|\d{4}[\/.\-]\d{1,2}[\/.\-]\d{1,2})\b/g;

/** A bare, standalone 4-digit number (e.g. a year such as 1999 or 2024). */
const BARE_YEAR_RE = /\b\d{4}\b/g;

/**
 * Singapore NRIC/FIN FORMAT: a prefix letter (S, T, F, G, or M), exactly 7
 * digits, then a single trailing check letter. Matched by format only (no
 * checksum validation) — flagging on format is the conservative privacy
 * choice. Word boundaries keep it from matching inside a longer token.
 *
 * Single source of truth for the NRIC/FIN shape: the detector tests this,
 * and the phone pre-filter neutralises matches (an NRIC's embedded 7-digit
 * run is not a phone number) via the global {@link NRIC_FIN_GLOBAL_RE}.
 */
const NRIC_FIN_RE = /\b[STFGM]\d{7}[A-Z]\b/;

/** Global form of {@link NRIC_FIN_RE} for the phone pre-filter strip. */
const NRIC_FIN_GLOBAL_RE = new RegExp(NRIC_FIN_RE.source, "g");

/**
 * Floor-unit marker: a "#" then 1–2 digits, a hyphen, then 1–4 digits
 * (e.g. "#12-05"). A high-precision, low-false-positive Singapore address
 * signal.
 */
const UNIT_MARKER_RE = /#\d{1,2}-\d{1,4}\b/;

/**
 * "Singapore" immediately followed by a 6-digit postal code (e.g.
 * "Singapore 408600"). The second high-precision Singapore address signal.
 */
const SG_POSTAL_RE = /\bSingapore\s+\d{6}\b/i;

/**
 * An explicit "passport" label (word-boundary, case-insensitive). Detection
 * keys off this label — never off a bare alphanumeric token.
 */
const PASSPORT_LABEL_RE = /\bpassport\b/i;

/**
 * A passport-number token: 6–9 alphanumeric characters containing at least one
 * letter AND one digit. Validated only when it appears near a
 * {@link PASSPORT_LABEL_RE} label.
 */
const PASSPORT_TOKEN_RE = /\b(?=[A-Za-z0-9]{6,9}\b)(?=[A-Za-z0-9]*[A-Za-z])(?=[A-Za-z0-9]*\d)[A-Za-z0-9]+\b/g;

/** Max gap (chars) between a passport label and its number token. */
const PASSPORT_PROXIMITY = 30;

// ---------------------------------------------------------------------------
// Detectors
// ---------------------------------------------------------------------------

/** True when the text contains a valid email address. */
function hasEmail(text: string): boolean {
  return EMAIL_RE.test(text);
}

/**
 * True when the text contains a phone-shaped run that strips to 7–15 digits,
 * after date-shaped substrings and bare 4-digit years have been removed. The
 * pre-filter guarantees that a standalone year or a date form with no genuine
 * 7–15-digit run is never flagged as a phone.
 */
function hasPhone(text: string): boolean {
  // Pre-filter: neutralise date-shaped substrings, bare 4-digit years, and
  // NRIC/FIN-shaped tokens so their digits cannot be assembled into a
  // phone-length run (an NRIC's embedded 7-digit run is not a phone number;
  // it is hard-blocked separately as `nric_fin`).
  let prefiltered = text
    .replace(DATE_SHAPED_RE, " ")
    .replace(BARE_YEAR_RE, " ")
    .replace(NRIC_FIN_GLOBAL_RE, " ");

  // Also neutralise labelled passport numbers (hard-blocked separately as
  // `passport`) so their digit runs are not mistaken for a phone number.
  for (const passportNumber of findPassportNumbers(prefiltered)) {
    prefiltered = prefiltered.split(passportNumber).join(" ");
  }

  const candidates = prefiltered.match(PHONE_CANDIDATE_RE);
  if (!candidates) return false;

  for (const candidate of candidates) {
    const digitCount = (candidate.match(/\d/g) ?? []).length;
    if (digitCount >= 7 && digitCount <= 15) {
      return true;
    }
  }
  return false;
}

/**
 * Per-domain matchers that require a proper LEFT boundary so a social domain is
 * only matched as a standalone domain reference, never as a substring inside a
 * larger domain or word. The character immediately before the domain must be
 * start-of-string or a character that is NOT part of a domain label (NOT
 * [A-Za-z0-9.-]). This prevents, e.g., the email domain "ax.com" from matching
 * the social domain "x.com", or "t.me" matching inside a larger word.
 */
const SOCIAL_DOMAIN_RES: readonly RegExp[] = SOCIAL_DOMAINS.map((domain) => {
  const escaped = domain.replace(/[.\-]/g, (ch) => `\\${ch}`);
  return new RegExp(`(?<![A-Za-z0-9.\\-])${escaped}`, "i");
});

/** True when the text contains a URL prefix or a known social-media domain. */
function hasUrlSocial(text: string): boolean {
  if (URL_PREFIX_RE.test(text)) return true;
  return SOCIAL_DOMAIN_RES.some((re) => re.test(text));
}

/**
 * True when the text contains a Singapore NRIC/FIN by FORMAT: prefix [STFGM],
 * 7 digits, trailing letter. No checksum is applied — a format match alone is
 * treated as PII (the conservative privacy choice).
 */
function hasNricFin(text: string): boolean {
  return NRIC_FIN_RE.test(text);
}

/**
 * True when the text contains a high-precision Singapore address signal: a
 * "#NN-NN" floor-unit marker OR the word "Singapore" immediately followed by a
 * 6-digit postal code. Free-form street lines are intentionally NOT parsed, so
 * a lone 6-digit number without the "Singapore" prefix does not flag.
 */
function hasAddress(text: string): boolean {
  return UNIT_MARKER_RE.test(text) || SG_POSTAL_RE.test(text);
}

/**
/**
 * Find EVERY labelled passport number: each passport-shaped token (6–9
 * alphanumeric characters with at least one digit) whose nearest edge is
 * within {@link PASSPORT_PROXIMITY} characters of an explicit "passport"
 * label. Keying off the LABEL — not a bare token — keeps ordinary alphanumeric
 * strings from flagging, and a "passport" mention with no nearby id does not
 * flag either. Returns the matched number tokens (empty when none qualify).
 *
 * All qualifying tokens are returned (not just the first) because more than
 * one passport-shaped token can sit inside the proximity window; the phone
 * pre-filter must strip them ALL so no residual digit run is read as a phone.
 *
 * Single source of truth for passport detection: {@link hasPassport} reports
 * on it, and the phone pre-filter strips the returned tokens (a labelled
 * passport number is not a phone number).
 */
function findPassportNumbers(text: string): string[] {
  const label = PASSPORT_LABEL_RE.exec(text);
  if (!label) return [];

  const labelStart = label.index;
  const labelEnd = labelStart + label[0].length;

  // Collect every passport-shaped token whose nearest edge is within the
  // proximity window of the label (either side of it).
  const matches: string[] = [];
  PASSPORT_TOKEN_RE.lastIndex = 0;
  for (
    let m = PASSPORT_TOKEN_RE.exec(text);
    m !== null;
    m = PASSPORT_TOKEN_RE.exec(text)
  ) {
    const tokenStart = m.index;
    const tokenEnd = tokenStart + m[0].length;
    // Skip the label word itself if it happened to match the token shape.
    if (tokenStart === labelStart) continue;

    const gap =
      tokenStart >= labelEnd
        ? tokenStart - labelEnd // token after the label
        : labelStart - tokenEnd; // token before the label
    if (gap <= PASSPORT_PROXIMITY) matches.push(m[0]);
  }
  return matches;
}

/** True when at least one labelled passport number is present. */
function hasPassport(text: string): boolean {
  return findPassportNumbers(text).length > 0;
}

// ---------------------------------------------------------------------------
// Name heuristic (warn-only)
// ---------------------------------------------------------------------------

/** Recognised section headings — a top line matching one is NOT a name. */
const SECTION_HEADING_WORDS = new Set<string>([
  "professional",
  "profile",
  "executive",
  "career",
  "summary",
  "highlights",
  "achievements",
  "accomplishments",
  "core",
  "competencies",
  "skills",
  "expertise",
  "areas",
  "experience",
  "work",
  "employment",
  "history",
  "background",
  "education",
  "qualifications",
  "certifications",
  "references",
  "contact",
  "curriculum",
  "vitae",
  "resume",
  "cv",
]);

/** Common company/role words that, if present, disqualify a name line. */
const COMPANY_ROLE_WORDS = new Set<string>([
  "ltd",
  "limited",
  "inc",
  "llc",
  "corp",
  "corporation",
  "company",
  "co",
  "group",
  "manager",
  "director",
  "engineer",
  "developer",
  "analyst",
  "consultant",
  "officer",
  "lead",
  "head",
  "president",
  "ceo",
  "cto",
  "cfo",
  "coo",
  "vp",
  "specialist",
  "coordinator",
  "administrator",
  "executive",
]);

/** A single capitalised token: an initial uppercase letter then letters. */
const CAP_TOKEN_RE = /^[A-Z][A-Za-z'’\-]*$/;

/**
 * Warn-only name heuristic. Flags a likely personal name on one of the first
 * few non-empty lines when that line is 2–3 capitalised tokens, is not a
 * recognised section heading, and is not a known company/role word. Never
 * blocks.
 */
function hasLikelyName(text: string): boolean {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  // Inspect only the top of the document.
  const topLines = lines.slice(0, 5);

  for (const line of topLines) {
    const tokens = line.split(/\s+/);
    if (tokens.length < 2 || tokens.length > 3) continue;

    // Every token must look like a capitalised name token.
    if (!tokens.every((t) => CAP_TOKEN_RE.test(t))) continue;

    const lowered = tokens.map((t) => t.toLowerCase());

    // Not a recognised section heading.
    if (lowered.some((t) => SECTION_HEADING_WORDS.has(t))) continue;

    // Not a known company/role word.
    if (lowered.some((t) => COMPANY_ROLE_WORDS.has(t))) continue;

    return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run the PII guard over CV text and return a {@link PiiReport}.
 *
 * `blockedTypes` lists EVERY detected hard-block type together, in the stable
 * canonical order (email, phone, url_social, nric_fin, address, passport).
 * `blocked` is true when any hard-block type is present. `nameWarning` is
 * warn-only and never affects `blockedTypes` or `blocked`.
 */
// Placeholder neutralisation: accept obvious anonymised masks, still block real PII.
const PLACEHOLDER_RUN_RE = new RegExp("([xX*\u2022])\\1{2,}", "g");
const REDACTION_LABEL_RE = new RegExp("[\\[<{]{1,2}\\s*(?:email|e-mail|phone|mobile|tel|name|redacted|nric|fin|address|passport|removed|anonymi[sz]ed)\\s*[\\]>}]{1,2}", "gi");
function stripPlaceholders(text: string): string {
  return text.replace(REDACTION_LABEL_RE, " ").replace(PLACEHOLDER_RUN_RE, " ");
}

export function runPiiGuard(cvText: string): PiiReport {
  const scanText = stripPlaceholders(cvText);
  const blockedTypes: PiiType[] = [];

  if (hasEmail(scanText)) blockedTypes.push("email");
  if (hasPhone(scanText)) blockedTypes.push("phone");
  if (hasUrlSocial(scanText)) blockedTypes.push("url_social");
  if (hasNricFin(scanText)) blockedTypes.push("nric_fin");
  if (hasAddress(scanText)) blockedTypes.push("address");
  if (hasPassport(scanText)) blockedTypes.push("passport");

  return {
    blockedTypes,
    nameWarning: hasLikelyName(cvText),
    blocked: blockedTypes.length > 0,
  };
}

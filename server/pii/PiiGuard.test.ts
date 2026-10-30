// server/pii/PiiGuard.test.ts
//
// Property-based + unit tests for the PII guard.
//
// Feature: role-match-cv-tailor
//   Property 8  Email detection blocks          — Validates: Requirements 5.1
//   Property 9  Phone detection (7–15 digits,    — Validates: Requirements 5.2
//               not years/dates)
//   Property 10 URL / social-link detection      — Validates: Requirements 5.3
//   Property 11 All detected PII types reported  — Validates: Requirements 5.4
//   plus a unit test for the warn-only name gate — Requirements 5.5, 5.6
//
// runPiiGuard(cvText: string): PiiReport
//   - blockedTypes lists EVERY hard-block type found (email, phone, url_social)
//   - blocked === blockedTypes.length > 0
//   - nameWarning is warn-only and never contributes to blockedTypes/blocked

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { runPiiGuard } from "./PiiGuard";
import type { PiiType } from "../../shared/types";

const NUM_RUNS = 100;

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

/** Neutral filler text with no email/phone/url and no name-shaped top line. */
const fillerArb = fc.constantFrom(
  "the candidate delivered measurable outcomes across teams",
  "responsible for planning and delivery of key programmes",
  "led initiatives that improved efficiency and quality",
  "worked within a cross functional group to ship features",
  "",
);

/** A valid email address built from safe parts. */
const emailArb = fc
  .tuple(
    fc.stringMatching(/^[a-z][a-z0-9._%+\-]{0,10}$/),
    fc.stringMatching(/^[a-z][a-z0-9\-]{0,8}$/),
    fc.constantFrom("com", "org", "net", "io", "co"),
  )
  .map(([local, domain, tld]) => `${local}@mail${domain}x.${tld}`);

/**
 * A genuine phone number whose stripped digit count is 7–15. Built from a
 * digit string of that length with optional "+" prefix and separators, kept
 * free of any date-shaped triple so it is never neutralised by the pre-filter.
 */
const phoneArb = fc
  .tuple(
    fc.integer({ min: 1, max: 9 }),
    fc.integer({ min: 7, max: 15 }),
    fc.boolean(),
    fc.constantFrom(" ", "-", ""),
  )
  .map(([first, len, plus, sep]) => {
    // Build a digit string of the chosen length deterministically from the
    // generated inputs (no leading zero so the visual length is preserved).
    let digits = String(first);
    for (let i = 1; i < len; i++) {
      digits += String((i * 7 + 3) % 10);
    }
    // Group into chunks of 3 with the chosen separator (spaces/hyphens only).
    const grouped = sep
      ? digits.replace(/(.{3})(?=.)/g, `$1${sep}`)
      : digits;
    return (plus ? "+" : "") + grouped;
  });

/** A standalone 4-digit year in 1900–2099. */
const yearArb = fc.integer({ min: 1900, max: 2099 }).map((y) => String(y));

/** A date-shaped string: dd/mm/yyyy or yyyy-mm-dd forms. */
const dateArb = fc.oneof(
  fc
    .tuple(
      fc.integer({ min: 1, max: 28 }),
      fc.integer({ min: 1, max: 12 }),
      fc.integer({ min: 1950, max: 2099 }),
    )
    .map(([d, m, y]) => `${pad2(d)}/${pad2(m)}/${y}`),
  fc
    .tuple(
      fc.integer({ min: 1950, max: 2099 }),
      fc.integer({ min: 1, max: 12 }),
      fc.integer({ min: 1, max: 28 }),
    )
    .map(([y, m, d]) => `${y}-${pad2(m)}-${pad2(d)}`),
);

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** A URL or social-link fragment. */
const urlSocialArb = fc.oneof(
  fc.constantFrom(
    "https://example.com/profile",
    "http://mysite.org/cv",
    "www.portfolio.io",
  ),
  fc.constantFrom(
    "linkedin.com/in/someone",
    "github.com/someone",
    "twitter.com/someone",
    "x.com/someone",
    "facebook.com/someone",
    "instagram.com/someone",
    "t.me/someone",
    "medium.com/@someone",
  ),
);

/**
 * A valid-FORMAT Singapore NRIC/FIN: prefix [S,T,F,G,M], 7 digits, trailing
 * uppercase letter (e.g. S1234567D). Format only — no checksum.
 */
const nricFinArb = fc
  .tuple(
    fc.constantFrom("S", "T", "F", "G", "M"),
    fc.stringMatching(/^\d{7}$/),
    fc.constantFrom(..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")),
  )
  .map(([prefix, digits, check]) => `${prefix}${digits}${check}`);

/** A Singapore address signal: a "#NN-NN" unit marker or "Singapore NNNNNN". */
const addressArb = fc.oneof(
  fc
    .tuple(fc.integer({ min: 1, max: 99 }), fc.integer({ min: 1, max: 9999 }))
    .map(([floor, unit]) => `#${floor}-${unit}`),
  fc.integer({ min: 100000, max: 999999 }).map((code) => `Singapore ${code}`),
);

/** A labelled passport number, e.g. "Passport No: E1234567". */
const passportArb = fc
  .tuple(
    fc.constantFrom("Passport No:", "passport", "Passport #", "PASSPORT"),
    fc.constantFrom("E1234567", "K12345678", "A987654", "X2345678"),
  )
  .map(([label, token]) => `${label} ${token}`);

/** Wrap a PII fragment inside neutral filler lines at a random position. */
function embed(fragment: string, filler: string): string {
  return `Career summary\n${filler}\ndetail ${fragment} continued\nmore context here`;
}

// ---------------------------------------------------------------------------
// Property 8 — Email detection blocks
// Feature: role-match-cv-tailor, Property 8
// Validates: Requirements 5.1
// ---------------------------------------------------------------------------

describe("Property 8: email detection blocks", () => {
  it("flags 'email' and blocks for any CV text containing a valid email", () => {
    fc.assert(
      fc.property(emailArb, fillerArb, (email, filler) => {
        const report = runPiiGuard(embed(email, filler));
        expect(report.blockedTypes).toContain("email");
        expect(report.blocked).toBe(true);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 9 — Phone detection blocks 7–15 digits but not years/dates
// Feature: role-match-cv-tailor, Property 9
// Validates: Requirements 5.2
// ---------------------------------------------------------------------------

describe("Property 9: phone detection excludes years and dates", () => {
  it("flags 'phone' for any run resolving to 7–15 digits", () => {
    fc.assert(
      fc.property(phoneArb, fillerArb, (phone, filler) => {
        const report = runPiiGuard(embed(phone, filler));
        expect(report.blockedTypes).toContain("phone");
        expect(report.blocked).toBe(true);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("does NOT flag 'phone' for a standalone 4-digit year", () => {
    fc.assert(
      fc.property(yearArb, fillerArb, (year, filler) => {
        const report = runPiiGuard(embed(year, filler));
        expect(report.blockedTypes).not.toContain("phone");
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("does NOT flag 'phone' for a date-shaped string with no 7–15 digit run", () => {
    fc.assert(
      fc.property(dateArb, fillerArb, (date, filler) => {
        const report = runPiiGuard(embed(date, filler));
        expect(report.blockedTypes).not.toContain("phone");
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 10 — URL and social-link detection blocks
// Feature: role-match-cv-tailor, Property 10
// Validates: Requirements 5.3
// ---------------------------------------------------------------------------

describe("Property 10: url/social detection blocks", () => {
  it("flags 'url_social' and blocks for http/https/www or a known social domain", () => {
    fc.assert(
      fc.property(urlSocialArb, fillerArb, (link, filler) => {
        const report = runPiiGuard(embed(link, filler));
        expect(report.blockedTypes).toContain("url_social");
        expect(report.blocked).toBe(true);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

// ---------------------------------------------------------------------------
// NRIC/FIN detection blocks (Singapore personal data — format match)
// Validates: Requirements 5.3
// ---------------------------------------------------------------------------

describe("NRIC/FIN detection blocks", () => {
  it("flags 'nric_fin' and blocks for any valid-format NRIC/FIN", () => {
    fc.assert(
      fc.property(nricFinArb, fillerArb, (nric, filler) => {
        const report = runPiiGuard(embed(nric, filler));
        expect(report.blockedTypes).toContain("nric_fin");
        expect(report.blocked).toBe(true);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("does NOT flag 'nric_fin' for 6-digit, 8-digit, or bare 4-digit numbers", () => {
    for (const num of ["123456", "12345678", "2024", "1999"]) {
      const report = runPiiGuard(embed(num, ""));
      expect(report.blockedTypes).not.toContain("nric_fin");
    }
  });
});

// ---------------------------------------------------------------------------
// Address detection blocks (Singapore physical-address signals)
// Validates: Requirements 5.3
// ---------------------------------------------------------------------------

describe("Singapore address detection blocks", () => {
  it("flags 'address' and blocks for a unit marker or 'Singapore' + postal code", () => {
    fc.assert(
      fc.property(addressArb, fillerArb, (addr, filler) => {
        const report = runPiiGuard(embed(addr, filler));
        expect(report.blockedTypes).toContain("address");
        expect(report.blocked).toBe(true);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("flags explicit '#12-05' and 'Singapore 408600' examples", () => {
    expect(runPiiGuard("Unit at #12-05 tower").blockedTypes).toContain(
      "address",
    );
    expect(runPiiGuard("resides in Singapore 408600").blockedTypes).toContain(
      "address",
    );
  });

  it("does NOT flag a lone 6-digit number without the 'Singapore' prefix", () => {
    const report = runPiiGuard(embed("408600", ""));
    expect(report.blockedTypes).not.toContain("address");
  });

  it("does NOT flag plain prose with no address signal", () => {
    const report = runPiiGuard(
      embed("delivered outcomes across multiple teams", ""),
    );
    expect(report.blockedTypes).not.toContain("address");
  });
});

// ---------------------------------------------------------------------------
// Passport detection blocks (label-keyed)
// Validates: Requirements 5.3
// ---------------------------------------------------------------------------

describe("Passport detection blocks", () => {
  it("flags 'passport' and blocks for a labelled passport number", () => {
    fc.assert(
      fc.property(passportArb, fillerArb, (passport, filler) => {
        const report = runPiiGuard(embed(passport, filler));
        expect(report.blockedTypes).toContain("passport");
        expect(report.blocked).toBe(true);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("flags the explicit 'Passport No: E1234567' example", () => {
    expect(runPiiGuard("Passport No: E1234567").blockedTypes).toContain(
      "passport",
    );
  });

  it("does NOT flag 'passport' alone with no nearby id token", () => {
    const report = runPiiGuard(
      embed("holds a valid passport for travel purposes", ""),
    );
    expect(report.blockedTypes).not.toContain("passport");
  });

  it("does NOT flag an ordinary id-shaped token without the label", () => {
    const report = runPiiGuard(embed("reference A987654 approved", ""));
    expect(report.blockedTypes).not.toContain("passport");
  });
});

// ---------------------------------------------------------------------------
// Property 11 — All detected PII types are reported together
// Feature: role-match-cv-tailor, Property 11
// Validates: Requirements 5.4
// ---------------------------------------------------------------------------

describe("Property 11: all detected PII types reported together", () => {
  it("blockedTypes equals exactly the injected set (order-insensitive)", () => {
    const subsetArb = fc
      .subarray<PiiType>(
        ["email", "phone", "url_social", "nric_fin", "address", "passport"],
        { minLength: 1 },
      )
      .filter((s) => s.length >= 1);

    fc.assert(
      fc.property(
        subsetArb,
        emailArb,
        phoneArb,
        urlSocialArb,
        nricFinArb,
        addressArb,
        passportArb,
        fillerArb,
        (subset, email, phone, link, nric, addr, passport, filler) => {
          // Build a text injecting exactly the chosen hard-block types.
          const parts: string[] = ["Career summary", filler];
          if (subset.includes("email")) parts.push(`reach ${email}`);
          if (subset.includes("phone")) parts.push(`call ${phone}`);
          if (subset.includes("url_social")) parts.push(`see ${link}`);
          if (subset.includes("nric_fin")) parts.push(`id ${nric}`);
          if (subset.includes("address")) parts.push(`at ${addr}`);
          if (subset.includes("passport")) parts.push(passport);
          parts.push("more context here");
          const text = parts.join("\n");

          const report = runPiiGuard(text);
          expect([...report.blockedTypes].sort()).toEqual([...subset].sort());
          expect(report.blocked).toBe(true);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});

// ---------------------------------------------------------------------------
// Unit test (task 4.6) — warn-only name heuristic + clean CV
// Validates: Requirements 5.5, 5.6
// ---------------------------------------------------------------------------

describe("name warning is warn-only and never blocks", () => {
  it("sets nameWarning true for a clear personal name at the top but does not block", () => {
    const cv = [
      "Jane Smith",
      "Career Summary",
      "Delivered large programmes across multiple teams.",
      "Led a group to improve operational efficiency.",
    ].join("\n");

    const report = runPiiGuard(cv);
    expect(report.nameWarning).toBe(true);
    expect(report.blocked).toBe(false);
    expect(report.blockedTypes).toEqual([]);
  });

  it("flags a three-token name at the top as warn-only", () => {
    const cv = [
      "Maria De Souza",
      "Professional Profile",
      "Experienced leader focused on measurable outcomes.",
    ].join("\n");

    const report = runPiiGuard(cv);
    expect(report.nameWarning).toBe(true);
    expect(report.blocked).toBe(false);
    expect(report.blockedTypes).toEqual([]);
  });

  it("yields blocked:false and nameWarning:false for a CV with no PII and no name", () => {
    const cv = [
      "Professional Profile",
      "A results driven leader with broad delivery experience.",
      "Core Competencies",
      "planning, delivery, stakeholder management",
      "Achievements in 1999 and 2024 across several programmes.",
    ].join("\n");

    const report = runPiiGuard(cv);
    expect(report.blocked).toBe(false);
    expect(report.blockedTypes).toEqual([]);
    expect(report.nameWarning).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Anonymised placeholders are ACCEPTED; real PII is still BLOCKED.
// Validates the 'anonymised, not deleted' requirement.
// ---------------------------------------------------------------------------
describe('PiiGuard - accepts anonymised placeholders, blocks real PII', () => {
  const accepted = [
    'Contact: xxxx@gmail.com',
    'Email XXXX@gmail.com',
    'reach ****@example.com',
    'see name@xxxxx.com',
    'Phone: +65 xxxx xxxx',
    'Email: [email]',
    'Contact [REDACTED] here',
    'Phone <phone> here',
    'NRIC SxxxxxxxX on file',
  ];
  for (const text of accepted) {
    it('accepts placeholder: ' + text, () => {
      const r = runPiiGuard(text);
      expect(r.blocked).toBe(false);
      expect(r.blockedTypes).toEqual([]);
    });
  }

  const blocked = [
    ['john.tan@gmail.com', 'email'],
    ['Call +6591234567 today', 'phone'],
    ['NRIC S1234567D', 'nric_fin'],
    ['Unit at #12-05 tower', 'address'],
    ['resides in Singapore 408600', 'address'],
    ['Passport No: E1234567', 'passport'],
    ['see linkedin.com/in/jane', 'url_social'],
  ];
  for (const [text, type] of blocked) {
    it('still blocks real PII: ' + text, () => {
      const r = runPiiGuard(text);
      expect(r.blocked).toBe(true);
      expect(r.blockedTypes).toContain(type);
    });
  }
});

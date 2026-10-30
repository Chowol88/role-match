/**
 * RoleFit design tokens — the single source of truth for the demo's visual
 * language. Every screen and component reads colour, spacing, radius, shadow,
 * and type values from here so the UI stays consistent and is trivial to
 * re-skin in one place.
 *
 * The palette is a premium B2B-SaaS dark/high-contrast system:
 *  - a deep navy "ink" scale for dark hero surfaces,
 *  - a clean light "surface" scale for the high-contrast work screens,
 *  - a single confident brand accent (precise, automated), and
 *  - semantic colours for success / transferable / gap / warning / danger.
 *
 * British spelling is used throughout (colour, grey).
 */

export const tokens = {
  colour: {
    // Brand accent — "sleek, precise, automated".
    brand: '#4f46e5', // indigo 600
    brandHover: '#4338ca', // indigo 700
    brandSoft: '#eef2ff', // indigo 50 (light-surface tint)
    brandRing: 'rgba(99, 102, 241, 0.35)',

    // High-contrast attention accent — used sparingly to guide the eye
    // (primary CTA cue, key in-copy highlights). Chosen to read on both the
    // dark hero and white surfaces; AA-legible as text on the dark ink.
    accent: '#facc15', // amber/gold 400
    accentText: '#1a1403', // near-black for text ON the accent
    accentSoftOnDark: 'rgba(250, 204, 21, 0.14)',

    // Dark "ink" scale — hero / landing surfaces.
    ink900: '#0b1020', // near-black navy (page)
    ink800: '#111833', // raised dark panel
    ink700: '#1b2444', // card on dark
    ink600: '#283357', // border on dark
    inkText: '#f8fafc', // primary text on dark
    inkMuted: '#aab3cb', // muted text on dark

    // Light "surface" scale — high-contrast work screens.
    bg: '#f6f7fb', // app background (work screens)
    surface: '#ffffff', // cards / panels
    surfaceAlt: '#f3f4f6', // subtle fills, table headers
    border: '#e2e5ec', // hairlines
    borderStrong: '#cbd1dd',

    // Text on light.
    text: '#0f1428', // primary
    textMuted: '#5b647a', // secondary
    textFaint: '#9aa2b5', // tertiary / captions

    // Semantics.
    success: '#0f9d6b',
    successSoft: '#e7f7f0',
    successText: '#065f3b',
    transfer: '#4f46e5',
    transferSoft: '#eef2ff',
    transferText: '#2d2a97',
    gap: '#d97706',
    gapSoft: '#fff7ed',
    gapText: '#7c3a0a',
    warn: '#b45309',
    warnSoft: '#fffbeb',
    warnBorder: '#fde68a',
    warnText: '#92400e',
    danger: '#dc2626',
    dangerSoft: '#fef2f2',
    dangerText: '#991b1b',

    white: '#ffffff',
  },

  space: {
    xs: '0.375rem',
    sm: '0.625rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2.25rem',
    xxl: '3.5rem',
  },

  radius: {
    sm: '0.5rem',
    md: '0.75rem',
    lg: '1rem',
    xl: '1.5rem',
    pill: '9999px',
  },

  shadow: {
    sm: '0 1px 2px rgba(15, 20, 40, 0.06)',
    md: '0 6px 20px rgba(15, 20, 40, 0.08)',
    lg: '0 18px 48px rgba(15, 20, 40, 0.16)',
    glow: '0 10px 40px rgba(79, 70, 229, 0.35)',
  },

  font: {
    sans: `'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`,
    // Fluid-ish type scale (rem).
    size: {
      caption: '0.75rem',
      small: '0.8125rem',
      body: '0.9375rem',
      lead: '1.0625rem',
      h3: '1.25rem',
      h2: '1.6rem',
      h1: '2.25rem',
      display: '3rem',
    },
    weight: {
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
      heavy: 800,
    },
  },

  layout: {
    maxWidth: 960,
    readableWidth: 680,
  },
} as const;

export type Tokens = typeof tokens;

/**
 * RoleFit UI primitives — a small, token-driven component kit shared across
 * every screen. Each primitive reads only from {@link tokens}, so the whole
 * look-and-feel is governed from one place.
 *
 * Primitives:
 *  - PageShell   page frame (dark hero variant or light work variant)
 *  - Hero        dark landing/header band
 *  - Brand       the RoleFit wordmark + bullseye glyph
 *  - Card        raised surface container
 *  - Button      primary / secondary / subtle / warn / success / ghost
 *  - Chip        small pill label (brand / success / warn / neutral)
 *  - ScoreRing   circular 1–10 score indicator
 *  - Checkbox    large, accessible agreement checkbox row
 *  - SectionLabel  uppercase eyebrow label
 */

import React from 'react';
import { tokens as t } from './tokens';

// ---------------------------------------------------------------------------
// PageShell
// ---------------------------------------------------------------------------

type ShellTone = 'dark' | 'light';

export function PageShell({
  tone = 'light',
  children,
  maxWidth = t.layout.maxWidth,
}: {
  tone?: ShellTone;
  children: React.ReactNode;
  maxWidth?: number;
}) {
  const dark = tone === 'dark';
  return (
    <div
      style={{
        minHeight: '100%',
        background: dark ? t.colour.ink900 : t.colour.bg,
        color: dark ? t.colour.inkText : t.colour.text,
        fontFamily: t.font.sans,
      }}
    >
      <div style={{ maxWidth, margin: '0 auto', padding: `${t.space.xl} ${t.space.md}` }}>
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Brand wordmark + bullseye glyph
// ---------------------------------------------------------------------------

/** Path to the RoleFit app icon (blue tile + target & arrow). Served from
 *  web/public, so it is referenced from the site root. */
export const APP_ICON_SRC = '/rolefit-icon.png';

/**
 * App icon tile. Renders the provided PNG at a generous size so the arrow/tick
 * inside the target is clearly legible (the earlier inline SVG glyph was too
 * small for the mark to read). The PNG already carries its own rounded-tile
 * background, so no extra frame is applied.
 */
export function AppIcon({ size = 44 }: { size?: number }) {
  return (
    <img
      src={APP_ICON_SRC}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      style={{ width: size, height: size, display: 'block', flexShrink: 0 }}
    />
  );
}

export function Brand({
  tone = 'light',
  size = 'md',
  subtitle,
}: {
  tone?: ShellTone;
  size?: 'sm' | 'md' | 'lg';
  /** Optional one-line descriptor shown under the wordmark (hero use). */
  subtitle?: string;
}) {
  // Icon and wordmark scale together so the mark and name stay in proportion.
  const iconSize = size === 'sm' ? 30 : size === 'lg' ? 56 : 40;
  const fontSize = size === 'sm' ? '1.125rem' : size === 'lg' ? '1.9rem' : '1.4rem';
  const onDark = tone === 'dark';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: size === 'lg' ? '0.85rem' : '0.6rem' }}>
      <AppIcon size={iconSize} />
      <span style={{ display: 'inline-flex', flexDirection: 'column', lineHeight: 1.1 }}>
        <span
          style={{
            fontSize,
            fontWeight: t.font.weight.heavy,
            letterSpacing: '-0.02em',
            color: onDark ? t.colour.inkText : t.colour.text,
          }}
        >
          Role<span style={{ color: t.colour.brand }}>Fit</span>
        </span>
        {subtitle && (
          <span
            style={{
              fontSize: t.font.size.small,
              fontWeight: t.font.weight.medium,
              color: onDark ? t.colour.inkMuted : t.colour.textMuted,
              marginTop: '0.1rem',
            }}
          >
            {subtitle}
          </span>
        )}
      </span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Hero (dark band)
// ---------------------------------------------------------------------------

export function Hero({ children, bare = false }: { children: React.ReactNode; bare?: boolean }) {
  // `bare` strips the self-contained dark box styling so the hero can blend
  // into an enclosing dark panel (used on the landing page, where the hero,
  // value strip and agreement gate share one continuous dark surface).
  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        ...(bare
          ? {}
          : {
              borderRadius: t.radius.xl,
              padding: `${t.space.xl} ${t.space.xl}`,
              background: `radial-gradient(1200px 400px at 15% -10%, ${t.colour.ink700}, ${t.colour.ink900} 70%)`,
              border: `1px solid ${t.colour.ink600}`,
              boxShadow: t.shadow.lg,
            }),
      }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

type CardProps = React.HTMLAttributes<HTMLElement> & {
  children: React.ReactNode;
  tone?: ShellTone;
  as?: 'div' | 'section';
};

export function Card({ children, tone = 'light', style, as = 'div', ...rest }: CardProps) {
  const dark = tone === 'dark';
  const Tag = as;
  return (
    <Tag
      style={{
        background: dark ? t.colour.ink700 : t.colour.surface,
        border: `1px solid ${dark ? t.colour.ink600 : t.colour.border}`,
        borderRadius: t.radius.lg,
        boxShadow: dark ? 'none' : t.shadow.md,
        padding: t.space.lg,
        ...style,
      }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

type ButtonVariant = 'primary' | 'secondary' | 'subtle' | 'warn' | 'success' | 'ghost';

const BUTTON_VARIANTS: Record<ButtonVariant, React.CSSProperties> = {
  primary: { background: t.colour.brand, color: t.colour.white, border: '1px solid transparent' },
  secondary: {
    background: t.colour.surface,
    color: t.colour.text,
    border: `1px solid ${t.colour.borderStrong}`,
  },
  subtle: {
    background: t.colour.surfaceAlt,
    color: t.colour.text,
    border: `1px solid ${t.colour.border}`,
  },
  warn: { background: t.colour.warn, color: t.colour.white, border: '1px solid transparent' },
  success: { background: t.colour.success, color: t.colour.white, border: '1px solid transparent' },
  ghost: {
    background: 'transparent',
    color: t.colour.inkText,
    border: `1px solid ${t.colour.ink600}`,
  },
};

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: 'md' | 'lg';
  block?: boolean;
};

export function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  disabled,
  style,
  children,
  ...rest
}: ButtonProps) {
  const base = BUTTON_VARIANTS[variant];
  const pad = size === 'lg' ? `0.85rem 2rem` : `0.6rem 1.25rem`;
  return (
    <button
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
        padding: pad,
        width: block ? '100%' : undefined,
        fontFamily: t.font.sans,
        fontSize: size === 'lg' ? t.font.size.lead : t.font.size.body,
        fontWeight: t.font.weight.bold,
        borderRadius: t.radius.md,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'transform 120ms ease, box-shadow 120ms ease, background 120ms ease',
        opacity: disabled ? 0.55 : 1,
        boxShadow: variant === 'primary' && !disabled ? t.shadow.glow : 'none',
        ...base,
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Chip
// ---------------------------------------------------------------------------

type ChipTone = 'brand' | 'success' | 'warn' | 'neutral' | 'onDark';

const CHIP_TONES: Record<ChipTone, React.CSSProperties> = {
  brand: { background: t.colour.brandSoft, color: t.colour.transferText, border: `1px solid ${t.colour.brandRing}` },
  success: { background: t.colour.successSoft, color: t.colour.successText, border: `1px solid ${t.colour.success}` },
  warn: { background: t.colour.warnSoft, color: t.colour.warnText, border: `1px solid ${t.colour.warnBorder}` },
  neutral: { background: t.colour.surfaceAlt, color: t.colour.textMuted, border: `1px solid ${t.colour.border}` },
  onDark: { background: 'rgba(255,255,255,0.08)', color: t.colour.inkText, border: '1px solid rgba(255,255,255,0.18)' },
};

export function Chip({
  children,
  tone = 'neutral',
  style,
}: {
  children: React.ReactNode;
  tone?: ChipTone;
  style?: React.CSSProperties;
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.375rem',
        fontSize: t.font.size.caption,
        fontWeight: t.font.weight.bold,
        letterSpacing: '0.02em',
        padding: '0.2rem 0.7rem',
        borderRadius: t.radius.pill,
        ...CHIP_TONES[tone],
        ...style,
      }}
    >
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// SectionLabel (eyebrow)
// ---------------------------------------------------------------------------

export function SectionLabel({ children, tone = 'light' }: { children: React.ReactNode; tone?: ShellTone }) {
  return (
    <span
      style={{
        display: 'block',
        fontSize: t.font.size.caption,
        fontWeight: t.font.weight.bold,
        textTransform: 'uppercase',
        letterSpacing: '0.12em',
        color: tone === 'dark' ? t.colour.inkMuted : t.colour.brand,
        marginBottom: '0.5rem',
      }}
    >
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// ScoreRing (1–10)
// ---------------------------------------------------------------------------

export function ScoreRing({
  score,
  max = 10,
  size = 108,
}: {
  score: number;
  max?: number;
  size?: number;
}) {
  const stroke = 9;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, score / max));
  const dash = circ * pct;

  // Band colour by score tier.
  const ringColour =
    score >= 8 ? t.colour.success : score >= 5 ? t.colour.brand : t.colour.gap;

  return (
    <div
      role="img"
      aria-label={`Role-match score ${score} out of ${max}`}
      style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}
    >
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={t.colour.border} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={ringColour}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ - dash}`}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          lineHeight: 1,
        }}
      >
        <span style={{ fontSize: '2rem', fontWeight: t.font.weight.heavy, color: t.colour.text }}>
          {score}
        </span>
        <span style={{ fontSize: t.font.size.small, fontWeight: t.font.weight.semibold, color: t.colour.textFaint }}>
          out of {max}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Checkbox (agreement row)
// ---------------------------------------------------------------------------

export function Checkbox({
  checked,
  onChange,
  children,
  id,
  tone = 'light',
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: React.ReactNode;
  id?: string;
  tone?: ShellTone;
}) {
  const dark = tone === 'dark';
  const borderColour = checked
    ? t.colour.brand
    : dark
      ? t.colour.ink600
      : t.colour.border;
  const bgColour = checked
    ? dark
      ? 'rgba(79, 70, 229, 0.18)'
      : t.colour.brandSoft
    : dark
      ? t.colour.ink800
      : t.colour.surface;
  return (
    <label
      htmlFor={id}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem',
        fontSize: t.font.size.body,
        lineHeight: 1.6,
        color: dark ? t.colour.inkText : t.colour.text,
        cursor: 'pointer',
        padding: '0.875rem 1rem',
        borderRadius: t.radius.md,
        border: `1px solid ${borderColour}`,
        background: bgColour,
        transition: 'border 120ms ease, background 120ms ease',
      }}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ marginTop: '0.15rem', width: '1.25rem', height: '1.25rem', accentColor: t.colour.brand, flexShrink: 0 }}
      />
      <span>{children}</span>
    </label>
  );
}

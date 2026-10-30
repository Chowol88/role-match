// @vitest-environment jsdom
/**
 * Tests for ErrorBanner component.
 *
 * Verifies: renders error code, message, resolution; accessible role/aria-live;
 * non-colour-only warning indicator; dismiss callback; code-to-copy mapping
 * (Requirements 11.4, 11.5).
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ErrorBanner } from './ErrorBanner';
import type { AppError } from '../../../shared/types';

const baseError: AppError = {
  code: 'INVALID_API_KEY',
  message: 'The submitted API key is invalid.',
  resolution: 'Check your OpenAI or Claude key and try again.',
};

const warningError: AppError = {
  code: 'NAME_WARNING',
  message: 'A likely personal name was detected in your CV.',
  resolution: 'Confirm names have been removed before proceeding.',
};

describe('ErrorBanner', () => {
  describe('Error mode', () => {
    it('renders with role="alert"', () => {
      render(<ErrorBanner error={baseError} />);
      expect(screen.getByRole('alert')).toBeDefined();
    });

    it('has aria-live="assertive"', () => {
      render(<ErrorBanner error={baseError} />);
      expect(screen.getByRole('alert').getAttribute('aria-live')).toBe('assertive');
    });

    it('shows the error message', () => {
      render(<ErrorBanner error={baseError} />);
      expect(screen.getByText(baseError.message)).toBeDefined();
    });

    it('shows the resolution guidance', () => {
      render(<ErrorBanner error={baseError} />);
      expect(screen.getByText(/Check your OpenAI or Claude key/i)).toBeDefined();
    });

    it('shows the error code as a <code> element', () => {
      const { container } = render(<ErrorBanner error={baseError} />);
      const code = container.querySelector('code');
      expect(code?.textContent).toBe('INVALID_API_KEY');
    });

    it('shows the human-readable error title', () => {
      render(<ErrorBanner error={baseError} />);
      expect(screen.getByText('Invalid API key')).toBeDefined();
    });

    it('does NOT show "Warning" label for hard errors', () => {
      render(<ErrorBanner error={baseError} />);
      // The badge shows "Error" not "Warning"
      expect(screen.queryByText('Warning')).toBeNull();
      expect(screen.getByText('Error')).toBeDefined();
    });

    it('has non-colour-only indicator (⛔ icon for errors)', () => {
      const { container } = render(<ErrorBanner error={baseError} />);
      // Check aria-hidden icon span exists
      const iconSpans = container.querySelectorAll('[aria-hidden="true"]');
      const hasErrorIcon = Array.from(iconSpans).some((s) => s.textContent?.includes('⛔'));
      expect(hasErrorIcon).toBe(true);
    });
  });

  describe('Warning mode (NAME_WARNING)', () => {
    it('renders with role="alert"', () => {
      render(<ErrorBanner error={warningError} />);
      expect(screen.getByRole('alert')).toBeDefined();
    });

    it('shows "Warning" badge label (not "Error")', () => {
      render(<ErrorBanner error={warningError} />);
      expect(screen.getByText('Warning')).toBeDefined();
    });

    it('has non-colour-only indicator (⚠️ icon for warnings)', () => {
      const { container } = render(<ErrorBanner error={warningError} />);
      const iconSpans = container.querySelectorAll('[aria-hidden="true"]');
      const hasWarnIcon = Array.from(iconSpans).some((s) => s.textContent?.includes('⚠️'));
      expect(hasWarnIcon).toBe(true);
    });

    it('shows warning message', () => {
      render(<ErrorBanner error={warningError} />);
      expect(screen.getByText(warningError.message)).toBeDefined();
    });
  });

  describe('Dismiss button', () => {
    it('shows a dismiss button when onDismiss is provided', () => {
      render(<ErrorBanner error={baseError} onDismiss={vi.fn()} />);
      // The ✕ button
      const btn = screen.getAllByRole('button').find(
        (b) => b.getAttribute('aria-label')?.includes('Dismiss')
      );
      expect(btn).toBeDefined();
    });

    it('does NOT show dismiss button when onDismiss is absent', () => {
      render(<ErrorBanner error={baseError} />);
      const btns = screen.queryAllByRole('button');
      const dismissBtn = btns.find((b) => b.getAttribute('aria-label')?.includes('Dismiss'));
      expect(dismissBtn).toBeUndefined();
    });

    it('calls onDismiss when the button is clicked', () => {
      const onDismiss = vi.fn();
      render(<ErrorBanner error={baseError} onDismiss={onDismiss} />);
      const btn = screen.getAllByRole('button').find(
        (b) => b.getAttribute('aria-label')?.includes('Dismiss')
      );
      expect(btn).toBeDefined();
      fireEvent.click(btn!);
      expect(onDismiss).toHaveBeenCalledOnce();
    });
  });

  describe('Error code mapping — human titles', () => {
    const codes: Array<{ code: AppError['code']; expectedTitle: string }> = [
      { code: 'MISSING_DOCUMENT', expectedTitle: 'Missing document' },
      { code: 'UNSUPPORTED_FORMAT', expectedTitle: 'Unsupported file format' },
      { code: 'FILE_TOO_LARGE', expectedTitle: 'File too large' },
      { code: 'FILE_UNREADABLE', expectedTitle: 'File could not be read' },
      { code: 'PII_BLOCKED', expectedTitle: 'Personal information detected' },
      { code: 'AI_CALL_FAILED', expectedTitle: 'AI analysis failed' },
      { code: 'AGREEMENT_REQUIRED', expectedTitle: 'Agreement required' },
      { code: 'UNKNOWN_SESSION', expectedTitle: 'Session not found' },
      { code: 'RATE_LIMITED', expectedTitle: 'Too many requests' },
    ];

    codes.forEach(({ code, expectedTitle }) => {
      it(`maps code "${code}" to title "${expectedTitle}"`, () => {
        const err: AppError = { code, message: 'Test message', resolution: 'Test resolution' };
        render(<ErrorBanner error={err} />);
        expect(screen.getByText(expectedTitle)).toBeDefined();
      });
    });
  });

  describe('Accessible label', () => {
    it('aria-label on the alert contains the title', () => {
      render(<ErrorBanner error={baseError} />);
      const alert = screen.getByRole('alert');
      expect(alert.getAttribute('aria-label')).toContain('Invalid API key');
    });

    it('aria-label contains "error" for hard errors', () => {
      render(<ErrorBanner error={baseError} />);
      const alert = screen.getByRole('alert');
      expect(alert.getAttribute('aria-label')?.toLowerCase()).toContain('error');
    });

    it('aria-label contains "warning" for warn-only codes', () => {
      render(<ErrorBanner error={warningError} />);
      const alert = screen.getByRole('alert');
      expect(alert.getAttribute('aria-label')?.toLowerCase()).toContain('warning');
    });
  });
});

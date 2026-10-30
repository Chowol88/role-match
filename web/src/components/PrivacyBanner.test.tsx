// @vitest-environment jsdom
/**
 * Tests for PrivacyBanner component.
 *
 * Verifies: accessible role/label, correct copy, keyboard/screen-reader access
 * (Requirements 1.2, 1.5, 4.9).
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PrivacyBanner } from './PrivacyBanner';

describe('PrivacyBanner', () => {
  describe('Start variant (default)', () => {
    it('renders as an <aside> with role="note"', () => {
      render(<PrivacyBanner />);
      const banner = screen.getByRole('note');
      expect(banner).toBeDefined();
    });

    it('has aria-label containing "Privacy"', () => {
      render(<PrivacyBanner />);
      const banner = screen.getByRole('note');
      expect(banner.getAttribute('aria-label')).toContain('Privacy');
    });

    it('contains the "Privacy-first by design" heading', () => {
      render(<PrivacyBanner />);
      expect(screen.getByText(/privacy-first by design/i)).toBeDefined();
    });

    it('states the preview does not take the visitor\'s own CV', () => {
      render(<PrivacyBanner />);
      expect(screen.getByText(/does not take or process your own cv/i)).toBeDefined();
    });

    it('is reachable in the accessibility tree', () => {
      render(<PrivacyBanner />);
      // role="note" makes it reachable
      const el = screen.getByRole('note');
      expect(el).not.toBeNull();
    });

    it('has a non-colour-only indicator (lock icon)', () => {
      const { container } = render(<PrivacyBanner />);
      // The lock icon span is aria-hidden
      const hiddenSpans = container.querySelectorAll('[aria-hidden="true"]');
      expect(hiddenSpans.length).toBeGreaterThan(0);
    });
  });

  describe('Upload variant', () => {
    it('renders as role="note"', () => {
      render(<PrivacyBanner variant="upload" />);
      expect(screen.getByRole('note')).toBeDefined();
    });

    it('mentions that the preview does not take the visitor\'s own CV', () => {
      render(<PrivacyBanner variant="upload" />);
      expect(screen.getByText(/does not take your own cv/i)).toBeDefined();
    });

    it('shows the word "Reminder"', () => {
      render(<PrivacyBanner variant="upload" />);
      expect(screen.getByText(/reminder/i)).toBeDefined();
    });
  });

  describe('Accessibility', () => {
    it('does not have any role="alert" (it is informational, not an error)', () => {
      const { container } = render(<PrivacyBanner />);
      const alerts = container.querySelectorAll('[role="alert"]');
      expect(alerts.length).toBe(0);
    });
  });
});

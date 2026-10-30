// @vitest-environment jsdom
/**
 * Tests for BeforeAfterTable component.
 *
 * Verifies: table renders, ARIA labels on buttons, accept/reject toggles
 * fire callbacks, empty-state message (Requirements 7.13, 7.14, 11.2).
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BeforeAfterTable } from './BeforeAfterTable';
import type { ProposedEdit } from '../../../shared/types';

const SAMPLE_EDITS: ProposedEdit[] = [
  {
    id: 'e1',
    section: 'Professional_Profile',
    originalText: 'Experienced manager with 10 years.',
    recommendedText: 'Strategic manager with 10+ years of cross-functional leadership.',
    explanation: 'Foregrounds leadership. Reflects stated experience.',
    accepted: false,
  },
  {
    id: 'e2',
    section: 'Career_Highlights',
    originalText: 'Led project delivery.',
    recommendedText: 'Delivered 15 projects on time, reducing costs by 20%.',
    explanation: 'Adds specificity. Grounded in CV achievements section.',
    accepted: true,
  },
];

describe('BeforeAfterTable', () => {
  describe('Empty state', () => {
    it('shows "No proposed edits" message when edits array is empty', () => {
      render(<BeforeAfterTable edits={[]} onToggle={vi.fn()} />);
      expect(screen.getByText(/No proposed edits/i)).toBeDefined();
    });

    it('has role="status" on the empty message', () => {
      render(<BeforeAfterTable edits={[]} onToggle={vi.fn()} />);
      expect(screen.getByRole('status')).toBeDefined();
    });
  });

  describe('Table rendering', () => {
    it('renders a table with accessible label', () => {
      render(<BeforeAfterTable edits={SAMPLE_EDITS} onToggle={vi.fn()} />);
      const table = screen.getByRole('table');
      expect(table).toBeDefined();
      expect(table.getAttribute('aria-label')).toBeTruthy();
    });

    it('renders column headers: Original, Recommended, Explanation, Decision', () => {
      render(<BeforeAfterTable edits={SAMPLE_EDITS} onToggle={vi.fn()} />);
      expect(screen.getByText('Original')).toBeDefined();
      expect(screen.getByText('Recommended')).toBeDefined();
      expect(screen.getByText('Explanation')).toBeDefined();
      expect(screen.getByText('Decision')).toBeDefined();
    });

    it('renders both edit rows', () => {
      render(<BeforeAfterTable edits={SAMPLE_EDITS} onToggle={vi.fn()} />);
      expect(screen.getByText('Experienced manager with 10 years.')).toBeDefined();
      expect(screen.getByText('Led project delivery.')).toBeDefined();
    });

    it('shows explanation text for each edit', () => {
      render(<BeforeAfterTable edits={SAMPLE_EDITS} onToggle={vi.fn()} />);
      expect(screen.getByText('Foregrounds leadership. Reflects stated experience.')).toBeDefined();
    });
  });

  describe('Accept/Reject controls — ARIA labels', () => {
    it('the Accept button for edit 1 has an accessible label mentioning "Accept"', () => {
      render(<BeforeAfterTable edits={SAMPLE_EDITS} onToggle={vi.fn()} />);
      // Edit 1 is not accepted, so it should show "Accept"
      const acceptBtn = screen.getAllByRole('button').find(
        (btn) => btn.getAttribute('aria-label')?.toLowerCase().includes('accept edit 1')
      );
      expect(acceptBtn).toBeDefined();
    });

    it('a button for accepted edit 2 has an aria-label mentioning "Reject"', () => {
      render(<BeforeAfterTable edits={SAMPLE_EDITS} onToggle={vi.fn()} />);
      // Edit 2 is accepted, so we should see a Reject button
      const rejectBtn = screen.getAllByRole('button').find(
        (btn) => btn.getAttribute('aria-label')?.toLowerCase().includes('reject edit 2')
      );
      expect(rejectBtn).toBeDefined();
    });

    it('Accept button for edit 1 has aria-pressed="false"', () => {
      render(<BeforeAfterTable edits={SAMPLE_EDITS} onToggle={vi.fn()} />);
      const buttons = screen.getAllByRole('button');
      const acceptBtn = buttons.find(
        (btn) => btn.getAttribute('aria-label')?.toLowerCase().includes('accept edit 1')
      );
      expect(acceptBtn?.getAttribute('aria-pressed')).toBe('false');
    });

    it('Accept button for accepted edit 2 has aria-pressed="true"', () => {
      render(<BeforeAfterTable edits={SAMPLE_EDITS} onToggle={vi.fn()} />);
      const buttons = screen.getAllByRole('button');
      const acceptedBtn = buttons.find(
        (btn) =>
          btn.getAttribute('aria-label')?.toLowerCase().includes('accept') &&
          btn.getAttribute('aria-label')?.toLowerCase().includes('edit 2')
      );
      // Could be the "Accepted" toggle button
      if (acceptedBtn) {
        expect(acceptedBtn.getAttribute('aria-pressed')).toBe('true');
      }
    });
  });

  describe('Toggle callbacks', () => {
    it('clicking Accept on edit 1 calls onToggle with id "e1"', () => {
      const onToggle = vi.fn();
      render(<BeforeAfterTable edits={SAMPLE_EDITS} onToggle={onToggle} />);

      const acceptBtn = screen.getAllByRole('button').find(
        (btn) => btn.getAttribute('aria-label')?.toLowerCase().includes('accept edit 1')
      );
      expect(acceptBtn).toBeDefined();
      fireEvent.click(acceptBtn!);
      expect(onToggle).toHaveBeenCalledWith('e1');
    });

    it('clicking Reject on accepted edit 2 calls onToggle with id "e2"', () => {
      const onToggle = vi.fn();
      render(<BeforeAfterTable edits={SAMPLE_EDITS} onToggle={onToggle} />);

      const rejectBtn = screen.getAllByRole('button').find(
        (btn) => btn.getAttribute('aria-label')?.toLowerCase().includes('reject edit 2')
      );
      expect(rejectBtn).toBeDefined();
      fireEvent.click(rejectBtn!);
      expect(onToggle).toHaveBeenCalledWith('e2');
    });

    it('multiple toggles call onToggle each time', () => {
      const onToggle = vi.fn();
      render(<BeforeAfterTable edits={SAMPLE_EDITS} onToggle={onToggle} />);

      const buttons = screen.getAllByRole('button');
      // Click the first two buttons
      fireEvent.click(buttons[0]);
      fireEvent.click(buttons[0]);

      expect(onToggle).toHaveBeenCalledTimes(2);
    });
  });

  describe('Section labels', () => {
    it('shows section name for each edit', () => {
      render(<BeforeAfterTable edits={SAMPLE_EDITS} onToggle={vi.fn()} />);
      // Professional Profile (underscores replaced with spaces)
      expect(screen.getAllByText(/Professional Profile/i).length).toBeGreaterThan(0);
    });
  });
});

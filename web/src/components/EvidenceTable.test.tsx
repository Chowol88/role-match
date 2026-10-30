// @vitest-environment jsdom
/**
 * Tests for EvidenceTable component.
 *
 * Verifies: three sections render, "none found" fallback in each section,
 * accessible region/labels (Requirements 6.3–6.5, 11.2).
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { EvidenceTable } from './EvidenceTable';
import type { EvidenceItem } from '../../../shared/types';

const directItem: EvidenceItem = {
  type: 'direct',
  requirementId: 'req-1',
  requirementText: 'TypeScript experience',
  cvEvidence: '5+ years building TypeScript applications',
  section: 'Professional_Experience',
};

const transferableItem: EvidenceItem = {
  type: 'transferable',
  requirementId: 'req-2',
  requirementText: 'Team leadership',
  cvEvidence: 'Led cross-functional project teams',
  section: 'Career_Highlights',
};

const gapItem: EvidenceItem = {
  type: 'gap',
  requirementId: 'req-3',
  requirementText: 'Machine learning expertise',
};

describe('EvidenceTable', () => {
  describe('Structure and accessibility', () => {
    it('renders a region with accessible label', () => {
      render(
        <EvidenceTable direct={[]} transferable={[]} gaps={[]} />
      );
      const region = screen.getByRole('region', { name: /evidence breakdown/i });
      expect(region).toBeDefined();
    });

    it('renders three section headings', () => {
      render(
        <EvidenceTable direct={[]} transferable={[]} gaps={[]} />
      );
      expect(screen.getByRole('heading', { name: /Direct Evidence/i })).toBeDefined();
      expect(screen.getByRole('heading', { name: /Transferable Evidence/i })).toBeDefined();
      expect(screen.getByRole('heading', { name: /Gaps/i })).toBeDefined();
    });
  });

  describe('"none found" fallback', () => {
    it('shows "none found" message for Direct Evidence when empty', () => {
      render(<EvidenceTable direct={[]} transferable={[directItem]} gaps={[gapItem]} />);
      expect(screen.getByText(/No direct evidence found/i)).toBeDefined();
    });

    it('shows "none found" message for Transferable Evidence when empty', () => {
      render(<EvidenceTable direct={[directItem]} transferable={[]} gaps={[gapItem]} />);
      expect(screen.getByText(/No transferable evidence found/i)).toBeDefined();
    });

    it('shows "none found" message for Gaps when empty', () => {
      render(<EvidenceTable direct={[directItem]} transferable={[transferableItem]} gaps={[]} />);
      expect(screen.getByText(/No gaps identified/i)).toBeDefined();
    });

    it('"none found" messages have role="status" for AT', () => {
      render(<EvidenceTable direct={[]} transferable={[]} gaps={[]} />);
      const statuses = screen.getAllByRole('status');
      // At least 3 "none found" statuses (one per section)
      expect(statuses.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('With items', () => {
    it('shows requirement text for a direct item', () => {
      render(<EvidenceTable direct={[directItem]} transferable={[]} gaps={[]} />);
      expect(screen.getByText('TypeScript experience')).toBeDefined();
    });

    it('shows CV evidence for a direct item', () => {
      render(<EvidenceTable direct={[directItem]} transferable={[]} gaps={[]} />);
      expect(screen.getByText(/5\+ years building TypeScript/i)).toBeDefined();
    });

    it('shows requirement text for a transferable item', () => {
      render(<EvidenceTable direct={[]} transferable={[transferableItem]} gaps={[]} />);
      expect(screen.getByText('Team leadership')).toBeDefined();
    });

    it('shows requirement text for a gap item', () => {
      render(<EvidenceTable direct={[]} transferable={[]} gaps={[gapItem]} />);
      expect(screen.getByText('Machine learning expertise')).toBeDefined();
    });

    it('does NOT show "none found" for Direct Evidence when there are items', () => {
      render(<EvidenceTable direct={[directItem]} transferable={[]} gaps={[]} />);
      expect(screen.queryByText(/No direct evidence found/i)).toBeNull();
    });

    it('shows item count badge for each section', () => {
      render(<EvidenceTable direct={[directItem]} transferable={[transferableItem]} gaps={[gapItem]} />);
      // Each section header should show a count of 1
      const countBadges = screen.getAllByText('1');
      expect(countBadges.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Section labels (non-colour-only)', () => {
    it('Direct Evidence section header includes an icon', () => {
      render(<EvidenceTable direct={[directItem]} transferable={[]} gaps={[]} />);
      const heading = screen.getByRole('heading', { name: /Direct Evidence/i });
      // Icon span is aria-hidden
      const parent = heading;
      const iconSpan = parent.querySelector('[aria-hidden="true"]');
      expect(iconSpan).not.toBeNull();
    });
  });
});

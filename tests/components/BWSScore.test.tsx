// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import BWSScore from '../../src/components/BWSScore';

function mockAnalytics(overrides: Record<string, unknown> = {}) {
  const defaults = {
    bwsScore:        0,
    weightDelta7d:   null,
    avgCalories7d:   0,
    avgProtein7d:    0,
    avgSteps7d:      0,
    workoutsLast7d:  0,
    workoutsLast30d: 0,
    streak:          0,
    currentWeight:   null,
    weightDelta30d:  null,
    breakdown: { weightProgress: 0, nutritionScore: 0, proteinScore: 0, activityScore: 0 },
    targets:   { calories: 1850, protein: 180, steps: 10_000 },
    ...overrides,
  };

  global.fetch = vi.fn().mockResolvedValue({
    ok:   true,
    json: () => Promise.resolve(defaults),
  } as unknown as Response);
}

describe('BWSScore', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the Performance Score header immediately', () => {
    mockAnalytics();
    render(<BWSScore />);
    expect(screen.getByText('Performance Score')).toBeInTheDocument();
  });

  it('displays the BWS score after loading', async () => {
    mockAnalytics({ bwsScore: 78 });
    render(<BWSScore />);
    const score = await screen.findByText('78');
    expect(score).toBeInTheDocument();
  });

  it('shows a perfect score of 100', async () => {
    mockAnalytics({ bwsScore: 100 });
    render(<BWSScore />);
    await screen.findByText('100');
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  it('displays weight delta when available', async () => {
    mockAnalytics({ bwsScore: 80, weightDelta7d: -0.4, currentWeight: 84.1 });
    render(<BWSScore />);
    // Weight delta should appear somewhere in the rendered output
    await screen.findByText('80');
    expect(screen.getByText(/84\.1/)).toBeInTheDocument();
  });

  it('shows streak count with "d" suffix', async () => {
    mockAnalytics({ bwsScore: 60, streak: 5 });
    render(<BWSScore />);
    await screen.findByText('60');
    // Streak is displayed as "5d" (see BWSScore.tsx line 303)
    expect(screen.getByText('5d')).toBeInTheDocument();
  });
});

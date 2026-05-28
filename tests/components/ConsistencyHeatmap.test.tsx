// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ConsistencyHeatmap from '../../src/components/ConsistencyHeatmap';

// ── Mock fetch ────────────────────────────────────────────────────────────────

function makeLogs(overrides: { date: string; caloriesIn?: number; steps?: number }[]) {
  return overrides;
}

function mockFetch(logs: ReturnType<typeof makeLogs>) {
  global.fetch = vi.fn().mockResolvedValue({
    json: () => Promise.resolve(logs),
  } as unknown as Response);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ConsistencyHeatmap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders "Consistency" header after loading', async () => {
    mockFetch([]);
    render(<ConsistencyHeatmap />);
    // Loading state shows skeleton divs; header appears after fetch resolves
    const header = await screen.findByText('Consistency');
    expect(header).toBeInTheDocument();
  });

  it('shows "0 days streak" when no data', async () => {
    mockFetch([]); // no logs → all empty
    render(<ConsistencyHeatmap />);
    // Text: "0 days streak" (streak=0 → streak !== 1 → "days")
    const streak = await screen.findByText(/0 days streak/i);
    expect(streak).toBeInTheDocument();
  });

  it('shows "Start today" hint when streak is 0', async () => {
    mockFetch([]);
    render(<ConsistencyHeatmap />);
    const hint = await screen.findByText('Start today');
    expect(hint).toBeInTheDocument();
  });

  it('displays non-zero streak when recent days are ideal', async () => {
    const today     = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    mockFetch([
      { date: today.toISOString().slice(0, 10),     caloriesIn: 1700, steps: 11_000 },
      { date: yesterday.toISOString().slice(0, 10), caloriesIn: 1800, steps: 10_500 },
    ]);

    render(<ConsistencyHeatmap />);
    // Text: "2 days streak"
    const streak = await screen.findByText(/2 days streak/i);
    expect(streak).toBeInTheDocument();
  });
});

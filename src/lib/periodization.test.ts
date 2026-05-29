import { describe, it, expect } from 'vitest';
import { isDeloadWeek, deloadSetCount, MESOCYCLE_WEEKS, MESOCYCLE_WORK_WEEKS } from './periodization';

describe('isDeloadWeek', () => {
  it('week 8 (index 7) is deload', () => {
    expect(isDeloadWeek(MESOCYCLE_WORK_WEEKS)).toBe(true);
    expect(MESOCYCLE_WORK_WEEKS).toBe(7);
    expect(MESOCYCLE_WEEKS).toBe(8);
  });

  it('early weeks are not deload', () => {
    expect(isDeloadWeek(0)).toBe(false);
    expect(isDeloadWeek(3)).toBe(false);
  });
});

describe('deloadSetCount', () => {
  it('reduces ~40% (3 → 2, 4 → 2)', () => {
    expect(deloadSetCount(3)).toBe(2);
    expect(deloadSetCount(4)).toBe(2);
  });

  it('keeps at least 1 set', () => {
    expect(deloadSetCount(1)).toBe(1);
    expect(deloadSetCount(2)).toBe(1);
  });
});

import { describe, it, expect } from 'vitest';
import { validateLogPatch } from './logValidation';

describe('validateLogPatch', () => {
  it('accepts valid fields', () => {
    const r = validateLogPatch({ weight_kg: 85.5, steps: 8000, calories_in: 1800 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.patch.weightKg).toBe(85.5);
      expect(r.patch.steps).toBe(8000);
    }
  });

  it('rejects negative calories', () => {
    const r = validateLogPatch({ calories_in: -100 });
    expect(r.ok).toBe(false);
  });

  it('rejects zero reps-style invalid weight', () => {
    const r = validateLogPatch({ weight_kg: 10 });
    expect(r.ok).toBe(false);
  });
});

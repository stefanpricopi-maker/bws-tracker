import { describe, it, expect } from 'vitest';
import { validateSetPayload } from './workoutValidation';

describe('validateSetPayload', () => {
  it('accepts valid set', () => {
    const r = validateSetPayload({
      exercise_name: 'Dumbbell Row',
      weight: 32.5,
      reps: 8,
      set_number: 2,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.weight).toBe(32.5);
      expect(r.data.reps).toBe(8);
    }
  });

  it('rejects negative weight', () => {
    const r = validateSetPayload({
      exercise_name: 'Curl',
      weight: -5,
      reps: 8,
      set_number: 1,
    });
    expect(r.ok).toBe(false);
  });

  it('rejects zero reps', () => {
    const r = validateSetPayload({
      exercise_name: 'Curl',
      weight: 10,
      reps: 0,
      set_number: 1,
    });
    expect(r.ok).toBe(false);
  });

  it('rejects empty exercise name', () => {
    const r = validateSetPayload({
      exercise_name: '  ',
      weight: 10,
      reps: 5,
      set_number: 1,
    });
    expect(r.ok).toBe(false);
  });
});

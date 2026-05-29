import { describe, it, expect } from 'vitest';
import {
  isBandedExercise,
  formatBandLevel,
  formatExerciseLoad,
  isValidBandLevel,
} from './exerciseKind';

describe('isBandedExercise', () => {
  it('detects banded naming patterns', () => {
    expect(isBandedExercise('Banded Lat Pulldown')).toBe(true);
    expect(isBandedExercise('Banded Hammer Curl')).toBe(true);
    expect(isBandedExercise('Dumbbell Floor Press')).toBe(false);
  });
});

describe('formatBandLevel', () => {
  it('maps levels 1–3', () => {
    expect(formatBandLevel(1)).toBe('Light');
    expect(formatBandLevel(2)).toBe('Medium');
    expect(formatBandLevel(3)).toBe('Heavy');
  });
});

describe('formatExerciseLoad', () => {
  it('formats bands vs kg', () => {
    expect(formatExerciseLoad(2, 'Banded Face Pulls')).toBe('Medium');
    expect(formatExerciseLoad(80, 'Dumbbell Row')).toBe('80 kg');
  });
});

describe('isValidBandLevel', () => {
  it('accepts 1–3 only', () => {
    expect(isValidBandLevel(2)).toBe(true);
    expect(isValidBandLevel(4)).toBe(false);
    expect(isValidBandLevel(2.5)).toBe(false);
  });
});

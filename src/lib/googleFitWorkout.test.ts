import { describe, it, expect } from 'vitest';
import { googleFitDayType, parseGoogleFitSessionId, displayDayType } from './googleFitWorkout';

describe('googleFitWorkout', () => {
  it('round-trips session id in dayType', () => {
    const dayType = googleFitDayType('abc-123', 'Running');
    expect(parseGoogleFitSessionId(dayType)).toBe('abc-123');
    expect(displayDayType(dayType)).toBe('Cardio · Running');
  });
});

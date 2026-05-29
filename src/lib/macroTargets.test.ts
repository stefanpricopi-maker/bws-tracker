import { describe, it, expect } from 'vitest';
import { proteinGramsForWeight, resolveDietTargets } from './macroTargets';

describe('macroTargets', () => {
  it('protein scales with body weight', () => {
    expect(proteinGramsForWeight(80)).toBe(144);
    expect(proteinGramsForWeight(100)).toBe(180);
  });

  it('uses profile goals when set', () => {
    const t = resolveDietTargets(
      { targetCaloriesKcal: 2000, targetProteinG: 160, targetCarbsG: 150, targetFatG: 70 },
      90,
    );
    expect(t.calories).toBe(2000);
    expect(t.protein).toBe(160);
  });
});

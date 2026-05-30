import { describe, it, expect } from 'vitest';
import { parseLocaleNumber } from './parseLocaleNumber';

describe('parseLocaleNumber', () => {
  it('parses dot decimals', () => {
    expect(parseLocaleNumber('92.9')).toBe(92.9);
  });

  it('parses comma decimals (RO locale)', () => {
    expect(parseLocaleNumber('92,9')).toBe(92.9);
  });

  it('parses numbers and rejects garbage', () => {
    expect(parseLocaleNumber(85.5)).toBe(85.5);
    expect(parseLocaleNumber('abc')).toBeNull();
  });
});

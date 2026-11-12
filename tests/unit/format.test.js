import { describe, it, expect } from 'vitest';
import { formatMetres } from '../../src/ui/format.js';

describe('formatMetres', () => {
  it('(8, 4, 1,5) → « 12,0 × 6,0 m »', () => {
    expect(formatMetres(8, 4, 1.5)).toBe('12,0 × 6,0 m');
  });
  it('(8, 4, 1) → « 8,0 × 4,0 m » (virgule, une décimale)', () => {
    expect(formatMetres(8, 4, 1)).toBe('8,0 × 4,0 m');
  });
  it('bornes d\'échelle 0,5 et 2', () => {
    expect(formatMetres(8, 4, 0.5)).toBe('4,0 × 2,0 m');
    expect(formatMetres(8, 4, 2)).toBe('16,0 × 8,0 m');
  });
});

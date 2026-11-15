import { describe, it, expect } from 'vitest';
import { formatMetres } from '../../src/ui/format.js';

describe('formatMetres', () => {
  it('(8, 4, 1,5) → « 12,00 × 6,00 m »', () => {
    expect(formatMetres(8, 4, 1.5)).toBe('12,00 × 6,00 m');
  });
  it('(8, 4, 1) → « 8,00 × 4,00 m » (virgule, deux décimales, format de la maquette)', () => {
    expect(formatMetres(8, 4, 1)).toBe('8,00 × 4,00 m');
  });
  it('bornes d\'échelle 0,5 et 2', () => {
    expect(formatMetres(8, 4, 0.5)).toBe('4,00 × 2,00 m');
    expect(formatMetres(8, 4, 2)).toBe('16,00 × 8,00 m');
  });
});

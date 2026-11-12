import { describe, it, expect } from 'vitest';
import { coverRect } from '../../src/core/capture.js';

// API supposée : coverRect(srcW, srcH, dstW, dstH) → { sx, sy, sw, sh } (recadrage source, comme object-fit: cover).
describe('coverRect', () => {
  it('16/9 vers 9/19,5 : recadrage centré au bon ratio', () => {
    const r = coverRect(1920, 1080, 900, 1950);
    expect(r.sh).toBeCloseTo(1080, 5);
    expect(r.sy).toBeCloseTo(0, 5);
    expect(r.sw / r.sh).toBeCloseTo(9 / 19.5, 5);
    expect(r.sw).toBeCloseTo((1080 * 9) / 19.5, 5);
    expect(r.sx).toBeCloseTo((1920 - r.sw) / 2, 5);
  });

  it('source plus haute que la destination : recadrage vertical centré', () => {
    const r = coverRect(1000, 2000, 1600, 900);
    expect(r.sw).toBeCloseTo(1000, 5);
    expect(r.sx).toBeCloseTo(0, 5);
    expect(r.sh / r.sw).toBeCloseTo(900 / 1600, 5);
    expect(r.sy).toBeCloseTo((2000 - r.sh) / 2, 5);
  });

  it('même ratio : pas de recadrage', () => {
    expect(coverRect(1600, 900, 800, 450)).toEqual({ sx: 0, sy: 0, sw: 1600, sh: 900 });
  });
});

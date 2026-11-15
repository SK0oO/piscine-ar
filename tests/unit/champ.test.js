import { describe, it, expect } from 'vitest';
import { champVertical, CHAMP_CAMERA_LONG } from '../../src/core/champ.js';

// Lot V4b (plan §12.2 / §12.3). Noms fixés par le plan : champVertical({ videoL, videoH, ecranL, ecranH, champLong }), CHAMP_CAMERA_LONG = 67.
const deg = (rad) => (rad * 180) / Math.PI;
const champCourt = (champLong, grand, petit) =>
  deg(2 * Math.atan((petit / grand) * Math.tan((champLong * Math.PI) / 360)));

describe('CHAMP_CAMERA_LONG', () => {
  it('vaut 67 degrés', () => {
    expect(CHAMP_CAMERA_LONG).toBe(67);
  });
});

describe('champVertical', () => {
  it('écran portrait 390 × 844, vidéo 1080 × 1920, champ long 67 → ≈ 67° (hauteur pleine)', () => {
    const c = champVertical({ videoL: 1080, videoH: 1920, ecranL: 390, ecranH: 844, champLong: 67 });
    expect(c).toBeCloseTo(67, 1);
  });

  it('écran portrait 390 × 844, vidéo paysage 1920 × 1080 → recadrée en largeur, champ vertical = champ court ≈ 41,0°', () => {
    const c = champVertical({ videoL: 1920, videoH: 1080, ecranL: 390, ecranH: 844, champLong: 67 });
    expect(c).toBeCloseTo(champCourt(67, 1920, 1080), 1);
    expect(c).toBeCloseTo(41.0, 0);
  });

  it('écran paysage 844 × 390, vidéo 1920 × 1080 → hauteur recadrée, champ vertical < champ court', () => {
    const c = champVertical({ videoL: 1920, videoH: 1080, ecranL: 844, ecranH: 390, champLong: 67 });
    expect(c).toBeLessThan(champCourt(67, 1920, 1080));
    expect(c).toBeGreaterThan(0);
  });

  it('le résultat reste dans ]0 ; 180[ pour des cas variés', () => {
    const cas = [
      { videoL: 1080, videoH: 1920, ecranL: 390, ecranH: 844 },
      { videoL: 1920, videoH: 1080, ecranL: 390, ecranH: 844 },
      { videoL: 1920, videoH: 1080, ecranL: 844, ecranH: 390 },
      { videoL: 640, videoH: 480, ecranL: 1000, ecranH: 100 },
      { videoL: 640, videoH: 480, ecranL: 100, ecranH: 1000 },
    ];
    for (const c of cas) {
      const v = champVertical({ ...c, champLong: 67 });
      expect(v, JSON.stringify(c)).toBeGreaterThan(0);
      expect(v, JSON.stringify(c)).toBeLessThan(180);
    }
  });

  it('entrée nulle ou négative → null', () => {
    const ok = { videoL: 1080, videoH: 1920, ecranL: 390, ecranH: 844, champLong: 67 };
    // garde-fou : avec des entrées valides, la fonction ne renvoie pas null (évite un faux vert si elle renvoie toujours null)
    expect(champVertical(ok)).not.toBeNull();
    for (const cle of Object.keys(ok)) {
      expect(champVertical({ ...ok, [cle]: 0 }), `${cle} = 0`).toBeNull();
      expect(champVertical({ ...ok, [cle]: -1 }), `${cle} < 0`).toBeNull();
    }
  });
});

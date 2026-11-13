import { describe, it, expect } from 'vitest';
import { createPoseStore, decalerSelonDirection, ECHELLE_MIN, ECHELLE_MAX, POSE_DEPART } from '../../src/core/pose.js';

describe('constantes de pose', () => {
  it('bornes et pose de départ conformes au contrat', () => {
    expect(ECHELLE_MIN).toBe(0.5);
    expect(ECHELLE_MAX).toBe(2);
    expect(POSE_DEPART).toEqual({ position: { x: 0, y: 0, z: -6 }, rotationY: 0, scale: 1 });
  });
});

describe('createPoseStore', () => {
  it('démarre sur POSE_DEPART par défaut', () => {
    const s = createPoseStore({ echelleLibre: true });
    expect(s.get()).toEqual(POSE_DEPART);
  });

  it('l\'échelle est bornée à 0,5 et 2 (sous, pile, au-dessus)', () => {
    const s = createPoseStore({ echelleLibre: true });
    s.scaleBy(0.1);
    expect(s.get().scale).toBe(0.5);
    s.scaleBy(1); // pile sur la borne basse
    expect(s.get().scale).toBe(0.5);
    s.scaleBy(100);
    expect(s.get().scale).toBe(2);
    s.scaleBy(1); // pile sur la borne haute
    expect(s.get().scale).toBe(2);
    s.scaleBy(1.01); // juste au-dessus
    expect(s.get().scale).toBe(2);
  });

  it('scaleBy multiplie l\'échelle courante', () => {
    const s = createPoseStore({ echelleLibre: true });
    s.scaleBy(1.5);
    expect(s.get().scale).toBeCloseTo(1.5, 10);
  });

  it('scaleBy ne fait rien si echelleLibre vaut false', () => {
    const s = createPoseStore({ echelleLibre: false });
    s.scaleBy(1.5);
    s.scaleBy(0.1);
    expect(s.get().scale).toBe(1);
  });

  it('rotationY est normalisée dans [-π, π[ (3π → -π)', () => {
    const s = createPoseStore({ echelleLibre: true });
    s.rotateBy(3 * Math.PI);
    expect(s.get().rotationY).toBeCloseTo(-Math.PI, 10);
    const t = createPoseStore({ echelleLibre: true });
    t.rotateBy(Math.PI); // π exclu : devient -π
    expect(t.get().rotationY).toBeCloseTo(-Math.PI, 10);
    const u = createPoseStore({ echelleLibre: true });
    u.rotateBy(-Math.PI); // -π inclus
    expect(u.get().rotationY).toBeCloseTo(-Math.PI, 10);
    const v = createPoseStore({ echelleLibre: true });
    v.rotateBy(Math.PI - 0.001);
    expect(v.get().rotationY).toBeCloseTo(Math.PI - 0.001, 10);
    for (const r of [s, t, u, v].map((x) => x.get().rotationY)) {
      expect(r).toBeGreaterThanOrEqual(-Math.PI);
      expect(r).toBeLessThan(Math.PI);
    }
  });

  it('setPosition écrit la position', () => {
    const s = createPoseStore({ echelleLibre: true });
    s.setPosition({ x: 1, y: 0, z: -3 });
    expect(s.get().position).toEqual({ x: 1, y: 0, z: -3 });
  });

  it('get() renvoie une copie (profonde)', () => {
    const s = createPoseStore({ echelleLibre: true });
    const a = s.get();
    a.position.x = 99;
    a.scale = 99;
    a.rotationY = 1;
    expect(s.get()).toEqual(POSE_DEPART);
    expect(s.get()).not.toBe(s.get());
    expect(s.get().position).not.toBe(s.get().position);
  });

  it('prend la pose initiale fournie', () => {
    const s = createPoseStore({ echelleLibre: true, initiale: { position: { x: 2, y: 0, z: -1 }, rotationY: 0.5, scale: 1.2 } });
    expect(s.get()).toEqual({ position: { x: 2, y: 0, z: -1 }, rotationY: 0.5, scale: 1.2 });
  });
});

describe('decalerSelonDirection', () => {
  const proche = (d, x, z) => {
    expect(d.x).toBeCloseTo(x, 6);
    expect(d.z).toBeCloseTo(z, 6);
  };

  it('regard vers -Z : avant = -Z, latéral positif = +X (droite de l\'écran)', () => {
    proche(decalerSelonDirection({ x: 0, z: -1 }, { avant: 0.25 }), 0, -0.25);
    proche(decalerSelonDirection({ x: 0, z: -1 }, { lateral: 0.25 }), 0.25, 0);
  });

  it('regard vers +X : avant = +X, droite de l\'écran = +Z', () => {
    proche(decalerSelonDirection({ x: 1, z: 0 }, { avant: 0.25 }), 0.25, 0);
    proche(decalerSelonDirection({ x: 1, z: 0 }, { lateral: 0.25 }), 0, 0.25);
  });

  it('normalise la direction (inclinaison du regard) : la distance reste 0,25 m', () => {
    const d = decalerSelonDirection({ x: 0.3, z: -0.4 }, { avant: 0.25 });
    expect(Math.hypot(d.x, d.z)).toBeCloseTo(0.25, 6);
  });

  it('regard à la verticale (direction nulle) : retombe sur -Z sans NaN', () => {
    proche(decalerSelonDirection({ x: 0, z: 0 }, { avant: 0.25 }), 0, -0.25);
  });
});

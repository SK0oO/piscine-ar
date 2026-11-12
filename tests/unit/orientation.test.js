import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { orientationToQuaternion } from '../../src/adapters/orientation.js';

// API supposée : orientationToQuaternion(alpha, beta, gamma, angleEcran, alphaRef), angles en degrés,
// renvoie un quaternion {x,y,z,w} (formule de DeviceOrientationControls).
const regard = (...args) => {
  const q = orientationToQuaternion(...args);
  return new THREE.Vector3(0, 0, -1).applyQuaternion(new THREE.Quaternion(q.x, q.y, q.z, q.w));
};
const proche = (v, [x, y, z]) => {
  expect(v.x).toBeCloseTo(x, 5);
  expect(v.y).toBeCloseTo(y, 5);
  expect(v.z).toBeCloseTo(z, 5);
};

describe('orientationToQuaternion', () => {
  it('beta = 90 : regard ≈ (0, 0, -1)', () => {
    proche(regard(0, 90, 0, 0, 0), [0, 0, -1]);
  });
  it('beta = 0 : regard ≈ (0, -1, 0)', () => {
    proche(regard(0, 0, 0, 0, 0), [0, -1, 0]);
  });
  it('alpha = 200 au premier événement (alphaRef = 200) : regard toujours ≈ (0, 0, -1)', () => {
    proche(regard(200, 90, 0, 0, 200), [0, 0, -1]);
  });
  it('le quaternion est unitaire', () => {
    const q = orientationToQuaternion(30, 70, 10, 90, 30);
    expect(Math.hypot(q.x, q.y, q.z, q.w)).toBeCloseTo(1, 6);
  });
});

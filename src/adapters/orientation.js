import * as THREE from 'three';

const RAD = Math.PI / 180;
const Z = new THREE.Vector3(0, 0, 1);
const MOINS_90_X = new THREE.Quaternion(-Math.SQRT1_2, 0, 0, Math.SQRT1_2);

// Formule de DeviceOrientationControls. Angles en degrés.
export function orientationToQuaternion(alpha, beta, gamma, angleEcran, alphaRef) {
  const euler = new THREE.Euler(beta * RAD, (alpha - alphaRef) * RAD, -gamma * RAD, 'YXZ');
  const q = new THREE.Quaternion().setFromEuler(euler);
  q.multiply(MOINS_90_X);
  q.multiply(new THREE.Quaternion().setFromAxisAngle(Z, -angleEcran * RAD));
  return { x: q.x, y: q.y, z: q.z, w: q.w };
}

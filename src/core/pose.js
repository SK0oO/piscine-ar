export const ECHELLE_MIN = 0.5;
export const ECHELLE_MAX = 2;
export const POSE_DEPART = Object.freeze({
  position: Object.freeze({ x: 0, y: 0, z: -6 }),
  rotationY: 0,
  scale: 1,
});

const copie = (p) => ({ position: { x: p.position.x, y: p.position.y, z: p.position.z }, rotationY: p.rotationY, scale: p.scale });

const normaliser = (r) => {
  const t = 2 * Math.PI;
  return ((((r + Math.PI) % t) + t) % t) - Math.PI;
};

export function createPoseStore({ echelleLibre, initiale = POSE_DEPART } = {}) {
  const pose = copie(initiale);
  return {
    get: () => copie(pose),
    setPosition(p) {
      pose.position = { x: p.x, y: p.y, z: p.z };
    },
    rotateBy(dRad) {
      pose.rotationY = normaliser(pose.rotationY + dRad);
    },
    scaleBy(facteur) {
      if (!echelleLibre) return;
      pose.scale = Math.min(ECHELLE_MAX, Math.max(ECHELLE_MIN, pose.scale * facteur));
    },
  };
}

import * as THREE from 'three';

export function createStage() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 200);
  camera.position.set(0, 1.5, 0);
  const pivot = new THREE.Group();
  pivot.name = 'pivot';
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8a8a, 1.6));
  const soleil = new THREE.DirectionalLight(0xffffff, 1.4);
  soleil.position.set(3, 8, 4);
  scene.add(soleil);
  scene.add(pivot);

  const appliquerPose = ({ position, rotationY, scale }) => {
    pivot.position.set(position.x, position.y, position.z);
    pivot.rotation.set(0, rotationY, 0);
    pivot.scale.setScalar(scale);
  };

  return { scene, camera, pivot, appliquerPose };
}

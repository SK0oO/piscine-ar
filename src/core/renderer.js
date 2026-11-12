import { WebGLRenderer, PCFSoftShadowMap } from 'three';

// Rendu WebGL transparent (la vidéo passe derrière). preserveDrawingBuffer reste à false :
// la capture redessine le canvas dans la même tâche (voir composePhoto).
export function createRenderer() {
  const renderer = new WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: false });
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true; // ombre douce sur le plan d'ombre (occludeur, Android)
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2));
  return renderer;
}

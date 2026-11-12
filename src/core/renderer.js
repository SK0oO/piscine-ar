import { WebGLRenderer, PCFShadowMap } from 'three';

// Rendu WebGL transparent (la vidéo passe derrière). preserveDrawingBuffer reste à false :
// la capture redessine le canvas dans la même tâche (voir composePhoto).
export function createRenderer() {
  const renderer = new WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: false });
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = false; // activé par l'élément en mode RA seulement
  renderer.shadowMap.type = PCFShadowMap;
  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2));
  return renderer;
}

import { WebGLRenderer, PCFShadowMap, ACESFilmicToneMapping, PMREMGenerator } from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// Rendu WebGL transparent (la vidéo passe derrière). preserveDrawingBuffer reste à false :
// la capture redessine le canvas dans la même tâche (voir composePhoto).
export function createRenderer() {
  const renderer = new WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: false });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.shadowMap.enabled = false; // activé par l'élément en mode RA seulement
  renderer.shadowMap.type = PCFShadowMap;
  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2));
  return renderer;
}

// Environnement de reflets (PMREM de RoomEnvironment), en attendant la `light-estimation`.
// Mis en cache par renderer ; la texture disparaît avec le contexte WebGL (le composant appelle forceContextLoss).
const environnements = new WeakMap();
export function creerEnvironnement(renderer) {
  let env = environnements.get(renderer);
  if (!env) {
    const pmrem = new PMREMGenerator(renderer);
    const salle = new RoomEnvironment();
    env = pmrem.fromScene(salle, 0.04).texture;
    salle.dispose();
    pmrem.dispose();
    environnements.set(renderer, env);
  }
  return env;
}

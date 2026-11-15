import { createStage } from '../../../src/core/stage.js';
import { createPoseStore } from '../../../src/core/pose.js';

// Faux environnement pour l'adaptateur caméra-gyro (vitest, environnement node, sans DOM).
// Noms fixés ici : deps = { renderer, stage, pose, hote, calque, video, env, rendre, surFin }.
// Les appels sont consignés dans `journal` avec un numéro d'ordre pour vérifier la synchronicité.

export function creerElementFactice() {
  const el = {
    children: [],
    style: {},
    attributs: {},
    ecouteurs: {},
    textContent: '',
    appendChild(c) { el.children.push(c); return c; },
    append(...cs) { el.children.push(...cs); },
    replaceChildren(...cs) { el.children = [...cs]; },
    remove() {},
    setAttribute(k, v) { el.attributs[k] = v; },
    addEventListener(t, f) { (el.ecouteurs[t] ??= []).push(f); },
    removeEventListener(t, f) { el.ecouteurs[t] = (el.ecouteurs[t] ?? []).filter((x) => x !== f); },
  };
  return el;
}

// V4 : `dimsVideo` = { largeur, hauteur } de la fausse vidéo (0 = inconnues, comme avant loadedmetadata) ;
// `sansVideo: true` = mode « sans caméra » (deps.video = null). Le fake renvoie aussi `stage`.
export function creerDepsCameraGyro({ permission = 'granted', permissionAbsente = false, getUserMedia, play, dimsVideo, sansVideo = false } = {}) {
  const journal = [];
  const pistes = [{ stoppee: false, stop() { this.stoppee = true; } }];
  const flux = { getTracks: () => pistes };

  const nav = {
    mediaDevices: {
      getUserMedia: (contraintes) => {
        journal.push({ nom: 'getUserMedia', contraintes });
        return getUserMedia ? getUserMedia(contraintes) : Promise.resolve(flux);
      },
    },
  };

  const ecouteursWindow = {};
  const win = {
    devicePixelRatio: 1,
    screen: { orientation: { angle: 0 } },
    addEventListener(t, f) { (ecouteursWindow[t] ??= []).push(f); },
    removeEventListener(t, f) { ecouteursWindow[t] = (ecouteursWindow[t] ?? []).filter((x) => x !== f); },
    emettre(type, evt) { for (const f of [...(ecouteursWindow[type] ?? [])]) f({ type, ...evt }); },
    nbEcouteurs: (type) => (ecouteursWindow[type] ?? []).length,
  };
  if (!permissionAbsente) {
    win.DeviceOrientationEvent = {
      requestPermission: () => {
        journal.push({ nom: 'requestPermission' });
        return Promise.resolve(permission);
      },
    };
  } else {
    win.DeviceOrientationEvent = {};
  }

  const video = {
    srcObject: null,
    videoWidth: dimsVideo ? dimsVideo.largeur : 1280,
    videoHeight: dimsVideo ? dimsVideo.hauteur : 720,
    ...creerElementFactice(),
    play: () => {
      journal.push({ nom: 'play' });
      return play ? play() : Promise.resolve();
    },
    pause() {},
  };

  const boucle = { cb: null, nulls: 0 };
  const renderer = {
    domElement: { width: 390, height: 844 },
    setAnimationLoop(cb) { if (cb === null) boucle.nulls++; boucle.cb = cb; },
    setSize() {},
    setPixelRatio() {},
    render() {},
    // Simule une image : le test appelle tick() pour que l'adaptateur mette sa caméra à jour.
    tick(time = 0) { boucle.cb?.(time); },
    boucle,
  };

  const document = { createElement: () => creerElementFactice() };
  const hote = { clientWidth: 390, clientHeight: 844, getBoundingClientRect: () => ({ left: 0, top: 0, width: 390, height: 844 }) };
  const stage = createStage();
  const pose = createPoseStore({ echelleLibre: true });
  const surFin = [];

  const deps = {
    renderer, stage, pose, hote, calque: creerElementFactice(), video: sansVideo ? null : video,
    env: { navigator: nav, window: win, document },
    rendre: () => {}, surFin: (raison) => surFin.push(raison),
  };
  return { deps, journal, pistes, flux, win, renderer, video, pose, surFin, stage };
}

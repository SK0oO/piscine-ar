import * as THREE from 'three';
import { createStage } from '../../../src/core/stage.js';
import { createPoseStore } from '../../../src/core/pose.js';

// Faux WebXR pour l'adaptateur webxr (vitest, environnement node, sans WebGL ni DOM).
// Noms fixés ici (le code de production doit s'y conformer) :
// - deps = { renderer, stage, pose, hote, calque, video:null, env:{navigator, window, document}, rendre, surFin }
// - renderer.xr = { setSession, getReferenceSpace, setReferenceSpaceType, getCamera } ; renderer.setAnimationLoop(cb)
//   garde cb ; renderer.tick(time, frame) appelle cb(time, frame) comme le ferait three.js en session.
// - session : enabledFeatures, requestReferenceSpace('viewer'), requestHitTestSource({space}),
//   requestHitTestSourceForTransientInput({profile:'generic-touchscreen'}), addEventListener/removeEventListener
//   ('end', 'select'), end().
// - hit (XRHitTestResult) : getPose(base) → { transform:{position, orientation, matrix} } ; createAnchor() → Promise<ancre>
//   (absent si ancres:false).
// - ancre : { anchorSpace, delete() } ; frame.getPose(ancre.anchorSpace, base) donne la position courante de l'ancre,
//   frame.trackedAnchors est l'ensemble des ancres vivantes.
// - réticule : objet de stage.scene nommé 'reticule' (propriété visible).
// - messages : éléments créés par env.document.createElement et rattachés à calque (textContent) ; est « masqué »
//   un élément détaché (remove()), `hidden` vrai, attribut hidden, style.display 'none' ou style.visibility 'hidden'.

export function creerElementFactice() {
  const el = {
    children: [], parent: null, style: {}, attributs: {}, ecouteurs: {}, textContent: '', hidden: false,
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    appendChild(c) { c.parent?.retirer(c); c.parent = el; el.children.push(c); return c; },
    append(...cs) { cs.forEach((c) => el.appendChild(c)); },
    replaceChildren(...cs) { el.children.forEach((c) => { c.parent = null; }); el.children = []; cs.forEach((c) => el.appendChild(c)); },
    retirer(c) { el.children = el.children.filter((x) => x !== c); },
    remove() { el.parent?.retirer(el); el.parent = null; },
    setAttribute(k, v) { el.attributs[k] = v; },
    removeAttribute(k) { delete el.attributs[k]; },
    toggleAttribute(k, force) { if (force === false) delete el.attributs[k]; else el.attributs[k] = ''; },
    addEventListener(t, f) { (el.ecouteurs[t] ??= []).push(f); },
    removeEventListener(t, f) { el.ecouteurs[t] = (el.ecouteurs[t] ?? []).filter((x) => x !== f); },
    cliquer() { for (const f of [...(el.ecouteurs.click ?? [])]) f({ type: 'click', preventDefault() {} }); },
  };
  return el;
}

const masque = (el) =>
  el.hidden === true || el.attributs.hidden !== undefined || el.style.display === 'none' || el.style.visibility === 'hidden';

// Textes non vides des éléments visibles (eux-mêmes et ancêtres jusqu'au calque) rattachés à `racine`.
export function textesVisibles(racine) {
  const sortie = [];
  const visite = (el) => {
    if (masque(el)) return;
    if (el.textContent) sortie.push(el.textContent);
    el.children.forEach(visite);
  };
  racine.children.forEach(visite);
  return sortie;
}

export const boutonsVisibles = (racine) => {
  const sortie = [];
  const visite = (el) => {
    if (masque(el)) return;
    if (el.ecouteurs.click?.length) sortie.push(el);
    el.children.forEach(visite);
  };
  racine.children.forEach(visite);
  return sortie;
};

export const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };

// Maillage `margelle` de test : contour extérieur (liste de [x, z]) extrudé, face haute à y = dessusY.
// `trous` = contours intérieurs (le bassin). Le contour extérieur n'est PAS convexe si on le donne en C.
export function fabriquerMargelle(contour, { trous = [], dessusY = 0, epaisseur = 0.1 } = {}) {
  const v = ([x, z]) => new THREE.Vector2(x, -z);
  const forme = new THREE.Shape(contour.map(v));
  for (const t of trous) forme.holes.push(new THREE.Path(t.map(v)));
  const geo = new THREE.ExtrudeGeometry(forme, { depth: epaisseur, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2); // (x, y, z) → (x, z, −y) : la forme est posée à plat, la face haute à y = épaisseur
  geo.translate(0, dessusY - epaisseur, 0);
  const margelle = new THREE.Mesh(geo, new THREE.MeshBasicMaterial());
  margelle.name = 'margelle';
  return margelle;
}

export const CONTOUR_RECT = [[-4.5, -2.5], [4.5, -2.5], [4.5, 2.5], [-4.5, 2.5]];
export const BASSIN_RECT = [[-4, -2], [4, -2], [4, 2], [-4, 2]];
// C : encoche (vide) en x ∈ ]1, 5[, z ∈ ]−1, 1[ ouverte vers +x.
export const CONTOUR_C = [[-5, -3], [5, -3], [5, -1], [1, -1], [1, 1], [5, 1], [5, 3], [-5, 3]];

export function fabriquerRacine(contour = CONTOUR_RECT, options = { trous: [BASSIN_RECT] }) {
  const racine = new THREE.Group();
  const eau = new THREE.Mesh(new THREE.BoxGeometry(8, 0.1, 4), new THREE.MeshBasicMaterial());
  eau.name = 'eau';
  racine.add(eau, fabriquerMargelle(contour, options));
  return racine;
}

export function creerDepsWebxr({ ancres = true, features, requestSession } = {}) {
  const journal = [];
  const toutesAncres = [];
  const ecouteurs = { end: [], select: [] };
  const espaceRef = { type: 'local' };
  const sourceReticule = { nom: 'reticule', annulee: false, cancel() { this.annulee = true; } };
  const sourceTactile = { nom: 'tactile', annulee: false, cancel() { this.annulee = true; } };

  const session = {
    enabledFeatures: features ?? ['local', 'hit-test', 'dom-overlay', ...(ancres ? ['anchors'] : [])],
    termine: false,
    sourceReticule,
    sourceTactile,
    renderState: {},
    inputSources: [],
    updateRenderState() {},
    requestReferenceSpace(type) { journal.push({ nom: 'requestReferenceSpace', type }); return Promise.resolve({ type }); },
    requestHitTestSource(options) { journal.push({ nom: 'requestHitTestSource', options }); return Promise.resolve(sourceReticule); },
    requestHitTestSourceForTransientInput(options) {
      journal.push({ nom: 'requestHitTestSourceForTransientInput', options });
      return Promise.resolve(sourceTactile);
    },
    addEventListener(t, f) { (ecouteurs[t] ??= []).push(f); },
    removeEventListener(t, f) { ecouteurs[t] = (ecouteurs[t] ?? []).filter((x) => x !== f); },
    nbEcouteurs: (t) => (ecouteurs[t] ?? []).length,
    emettre(type) { for (const f of [...(ecouteurs[type] ?? [])]) f({ type, preventDefault() {} }); },
    end() {
      if (session.termine) return Promise.resolve();
      session.termine = true;
      journal.push({ nom: 'end' });
      session.emettre('end');
      return Promise.resolve();
    },
  };

  const xr = {
    isSessionSupported: async () => true,
    requestSession(mode, init) {
      journal.push({ nom: 'requestSession', mode, init });
      return requestSession ? requestSession(mode, init) : Promise.resolve(session);
    },
  };

  let sessionRenderer = null;
  const boucle = { cb: null, nulls: 0 };
  const stage = createStage();
  const renderer = {
    domElement: { width: 390, height: 844 },
    xr: {
      enabled: true,
      setReferenceSpaceType(type) { journal.push({ nom: 'setReferenceSpaceType', type }); },
      setSession(s) { journal.push({ nom: 'setSession', session: s }); sessionRenderer = s; return Promise.resolve(); },
      getReferenceSpace: () => (sessionRenderer ? espaceRef : null),
      getCamera: () => stage.camera,
    },
    setAnimationLoop(cb) { if (cb === null) boucle.nulls++; boucle.cb = cb; },
    setSize() {}, setPixelRatio() {}, render() {},
    tick(time = 0, frame) { boucle.cb?.(time, frame); },
    boucle,
  };

  const hote = { clientWidth: 390, clientHeight: 844, getBoundingClientRect: () => ({ left: 0, top: 0, width: 390, height: 844 }) };
  const calque = creerElementFactice();
  const pose = createPoseStore({ echelleLibre: false });
  const surFin = [];
  const env = {
    navigator: { xr },
    window: {},
    document: { createElement: () => creerElementFactice() },
  };
  const deps = { renderer, stage, pose, hote, calque, video: null, env, rendre: () => {}, surFin: (r) => surFin.push(r) };

  // Une ancre : sa position courante se déplace avec `deplacer` (le suivi de la RA).
  const creerAncre = (position) => {
    const ancre = {
      position: { ...position }, supprimee: false,
      delete() { ancre.supprimee = true; },
      deplacer(x, y, z) { ancre.position = { x, y, z }; },
    };
    ancre.anchorSpace = { ancre };
    toutesAncres.push(ancre);
    return ancre;
  };

  const poseDe = ({ x, y, z }) => ({
    transform: {
      position: { x, y, z, w: 1 },
      orientation: { x: 0, y: 0, z: 0, w: 1 },
      matrix: new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]),
    },
  });

  // Un résultat de hit-test à (x, y, z) dans l'espace de référence.
  const hit = (x, y, z) => {
    const r = { position: { x, y, z }, getPose: () => poseDe(r.position) };
    if (ancres) {
      r.createAnchor = () => {
        journal.push({ nom: 'createAnchor' });
        return Promise.resolve(creerAncre(r.position));
      };
    }
    return r;
  };

  // Une image : `reticule` = résultats du hit-test du centre de l'écran ; `tactile` = résultats du hit-test « transient input ».
  const image = ({ reticule = [], tactile = null, time = 0 } = {}) => {
    const frame = {
      session,
      trackedAnchors: new Set(toutesAncres.filter((a) => !a.supprimee)),
      getHitTestResults: (source) => (source === sourceReticule ? reticule : []),
      getHitTestResultsForTransientInput: (source) =>
        source === sourceTactile && tactile
          ? [{ inputSource: { targetRayMode: 'screen', profile: 'generic-touchscreen' }, results: tactile }]
          : [],
      getPose: (espace) => (espace?.ancre ? poseDe(espace.ancre.position) : poseDe({ x: 0, y: 0, z: 0 })),
      getViewerPose: () => null,
    };
    renderer.tick(time, frame);
    return frame;
  };

  return { deps, journal, xr, session, renderer, stage, pose, hote, calque, surFin, ancres: toutesAncres, hit, image };
}

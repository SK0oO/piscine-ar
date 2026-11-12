// Page tournante : lit models/out/<id>.glb et les couleurs d'eau de models/params/<id>.json.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const IDS = ['rectangulaire-8x4', 'haricot-7x3-5', 'ovale-5x3'];
const NOMS_EAUX = { 'bleu-clair': 'Bleu clair', 'bleu-profond': 'Bleu profond', 'gris-sable': 'Gris sable' };
const query = new URLSearchParams(location.search);
const shot = query.get('shot') === '1';
document.body.classList.toggle('shot', shot);

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: shot });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#e8eef2');
scene.fog = new THREE.Fog('#e8eef2', 18, 45);

const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.autoRotate = !shot;
controls.autoRotateSpeed = 1.2;
controls.maxPolarAngle = Math.PI / 2 - 0.05;
controls.minDistance = 4;
controls.maxDistance = 24;

scene.add(new THREE.HemisphereLight('#ffffff', '#b8c0c4', 1.1));
const soleil = new THREE.DirectionalLight('#fff4e0', 2.4);
soleil.position.set(6, 10, 5);
soleil.castShadow = true;
soleil.shadow.mapSize.set(2048, 2048);
Object.assign(soleil.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 30 });
soleil.shadow.bias = -0.0005;
scene.add(soleil);

let courant = null; // { id, params, groupe, sol }
let eauChoisie = null;
let chargement = 0;

const selecteur = document.getElementById('modele');
const zoneEaux = document.getElementById('eaux');

function redimensionne() {
  const w = shot ? 512 : innerWidth, h = shot ? 512 : innerHeight;
  renderer.setSize(w, h, !shot ? false : true);
  if (!shot) { renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%'; }
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', redimensionne);

// Sol gris : un grand plan percé à la forme du bassin (relevée sur le haut des parois du GLB).
function construitSol(groupe) {
  const bassin = groupe.getObjectByName('bassin');
  const pos = bassin.geometry.attributes.position;
  const trou = [];
  let haut = -Infinity;
  for (let i = 0; i < pos.count; i++) haut = Math.max(haut, pos.getY(i));
  for (let i = 0; i < pos.count; i++) if (Math.abs(pos.getY(i) - haut) < 1e-6) trou.push(new THREE.Vector2(pos.getX(i), -pos.getZ(i)));
  const forme = new THREE.Shape([[-40, -40], [40, -40], [40, 40], [-40, 40]].map(([x, y]) => new THREE.Vector2(x, y)));
  forme.holes.push(new THREE.Path(trou));
  const geo = new THREE.ShapeGeometry(forme);
  geo.rotateX(-Math.PI / 2);
  const sol = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#b4b8bb', roughness: 1 }));
  sol.position.y = -0.01;
  sol.receiveShadow = true;
  return sol;
}

function appliqueEau(nom) {
  eauChoisie = nom;
  const hex = courant.params.eaux[nom];
  const c = new THREE.Color(hex);
  courant.groupe.traverse((o) => {
    if (!o.isMesh) return;
    if (o.material.name === 'eau' || o.material.name === 'liner') o.material.color.copy(c);
    if (o.material.name === 'liner-clair') o.material.color.copy(c).lerp(new THREE.Color('#ffffff'), 0.35);
  });
  for (const b of zoneEaux.children) b.setAttribute('aria-pressed', String(b.dataset.eau === nom));
  const url = new URL(location.href);
  url.searchParams.set('eau', nom);
  history.replaceState(null, '', url);
}

async function charge(id, eau) {
  const mon = ++chargement;
  const [params, gltf] = await Promise.all([
    fetch(`../models/params/${id}.json`).then((r) => r.json()),
    new GLTFLoader().loadAsync(`../models/out/${id}.glb`),
  ]);
  if (mon !== chargement) return;
  if (courant) { scene.remove(courant.groupe, courant.sol); }
  const groupe = gltf.scene;
  groupe.traverse((o) => { if (o.isMesh) { o.castShadow = o.name !== 'eau'; o.receiveShadow = true; o.material = o.material.clone(); } });
  const sol = construitSol(groupe);
  scene.add(groupe, sol);
  courant = { id, params, groupe, sol };

  zoneEaux.replaceChildren();
  for (const [nom, hex] of Object.entries(params.eaux)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.eau = nom;
    b.innerHTML = `<i style="background:${hex}"></i>${NOMS_EAUX[nom] || nom}`;
    b.addEventListener('click', () => appliqueEau(nom));
    zoneEaux.append(b);
  }
  appliqueEau(params.eaux[eau] ? eau : params.eauParDefaut);

  // vue de trois quarts, cadrée sur la taille de la piscine
  const taille = Math.max(params.longueur, params.largeur) + 2 * params.margelle.largeur;
  const d = taille * 1.2;
  controls.target.set(0, -0.3, 0);
  camera.position.set(d * 0.62, d * 0.6, d * 0.78);
  controls.update();
  selecteur.value = id;
  const url = new URL(location.href);
  url.searchParams.set('id', id);
  history.replaceState(null, '', url);
  window.__pret = true;
}

for (const id of IDS) {
  const o = document.createElement('option');
  o.value = id;
  o.textContent = { 'rectangulaire-8x4': 'Rectangulaire 8 × 4 m', 'haricot-7x3-5': 'Forme libre 7 × 3,5 m', 'ovale-5x3': 'Ovale 5 × 3 m' }[id];
  selecteur.append(o);
}
selecteur.addEventListener('change', () => charge(selecteur.value, eauChoisie));

redimensionne();
renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
const idDemande = IDS.includes(query.get('id')) ? query.get('id') : IDS[0];
charge(idDemande, query.get('eau')).catch((e) => { console.error(e.message); document.getElementById('titre').textContent = 'Modèle introuvable. Lancez npm run generate.'; });

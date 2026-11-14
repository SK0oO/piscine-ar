// Page tournante : lit models/out/<id>.glb et les couleurs d'eau de models/params/<id>.json.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { creerEnvironnement } from '../src/core/renderer.js';
import { animerEau } from '../src/core/models.js';

const IDS = ['rectangulaire-8x4', 'haricot-7x3-5', 'ovale-5x3'];
const NOMS_EAUX = { 'bleu-clair': 'Bleu clair', 'bleu-profond': 'Bleu profond', 'gris-sable': 'Gris sable' };
const query = new URLSearchParams(location.search);
const shot = query.get('shot') === '1';
const TAILLE_SHOT = [512, 1024].includes(Number(query.get('taille'))) ? Number(query.get('taille')) : 512;
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
scene.environment = creerEnvironnement(renderer); // reflets sur l'eau et la pierre
scene.environmentIntensity = 0.7;

const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.autoRotate = !shot;
controls.autoRotateSpeed = 1.2;
controls.maxPolarAngle = Math.PI / 2 - 0.05;
controls.minDistance = 4;
controls.maxDistance = 24;

scene.add(new THREE.HemisphereLight('#ffffff', '#b8c0c4', 0.6));
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
  const w = shot ? TAILLE_SHOT : innerWidth, h = shot ? TAILLE_SHOT : innerHeight;
  renderer.setSize(w, h, !shot ? false : true);
  if (!shot) { renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%'; }
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', redimensionne);

// Herbe : bruit procédural dessiné une fois (canvas 2D, 256 px = 2 m), sans fichier téléchargé.
function textureHerbe() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(256, 256);
  let a = 12345;
  const alea = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  for (let i = 0; i < 256 * 256; i++) {
    const v = alea();
    img.data.set([62 + v * 30, 118 + v * 50, 44 + v * 24, 255], i * 4);
  }
  ctx.putImageData(img, 0, 0);
  for (let i = 0; i < 1400; i++) { // brins plus clairs ou plus sombres, qui débordent pour rester tuilables
    const x = alea() * 256, y = alea() * 256, l = 4 + alea() * 8, d = alea() < 0.5;
    ctx.strokeStyle = d ? 'rgba(30,80,28,0.35)' : 'rgba(150,200,80,0.3)';
    ctx.lineWidth = 1;
    for (const dx of [-256, 0, 256]) for (const dy of [-256, 0, 256]) {
      ctx.beginPath(); ctx.moveTo(x + dx, y + dy); ctx.lineTo(x + dx + (alea() - 0.5) * 4, y + dy - l); ctx.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.repeat.set(0.5, 0.5); // UV en mètres (ShapeGeometry) : 1 / 2 m
  return t;
}

// Sol d'herbe : un grand plan percé à la forme du bassin (relevée sur le haut des parois du GLB).
const herbe = textureHerbe();
function construitSol(groupe) {
  const bassin = groupe.getObjectByName('bassin');
  const pos = bassin.geometry.attributes.position;
  const trou = [];
  let haut = -Infinity;
  for (let i = 0; i < pos.count; i++) haut = Math.max(haut, pos.getY(i));
  for (let i = 0; i < pos.count; i++) {
    if (Math.abs(pos.getY(i) - haut) >= 1e-6) continue;
    const p = new THREE.Vector2(pos.getX(i), -pos.getZ(i));
    if (!trou.some((q) => q.distanceTo(p) < 1e-6)) trou.push(p); // la couture du contour est dupliquée
  }
  const forme = new THREE.Shape([[-40, -40], [40, -40], [40, 40], [-40, 40]].map(([x, y]) => new THREE.Vector2(x, y)));
  forme.holes.push(new THREE.Path(trou));
  const geo = new THREE.ShapeGeometry(forme);
  geo.rotateX(-Math.PI / 2);
  const sol = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: herbe, roughness: 1 }));
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
    if (o.material.name === 'fond') o.material.color.copy(c).lerp(new THREE.Color('#000000'), 0.6);
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
    const pastille = document.createElement('i');
    pastille.style.background = hex;
    b.append(pastille, document.createTextNode(NOMS_EAUX[nom] || nom));
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
const horloge = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = horloge.getDelta();
  if (!shot && courant) animerEau(courant.groupe, Math.min(dt, 0.1));
  controls.update();
  renderer.render(scene, camera);
});
const idDemande = IDS.includes(query.get('id')) ? query.get('id') : IDS[0];
charge(idDemande, query.get('eau')).catch((e) => { console.error(e.message); document.getElementById('titre').textContent = 'Modèle introuvable. Lancez npm run generate.'; });

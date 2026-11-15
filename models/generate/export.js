// Page d'export (Chromium) : GLTFExporter et USDZExporter encodent les textures avec un canvas, absent de Node.
// window.exporter(params, { eau }) → { glb, usdz, usdzSol } en base64. Aucun appel réseau.
import { Scene } from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { USDZExporter } from 'three/addons/exporters/USDZExporter.js';
import { buildPool } from './pool.js';

const base64 = (octets) => new Promise((resolve, reject) => {
  const lecteur = new FileReader();
  lecteur.onerror = () => reject(new Error('lecture du fichier exporté impossible'));
  lecteur.onload = () => resolve(String(lecteur.result).split(',')[1]);
  lecteur.readAsDataURL(new Blob([octets]));
});

// Les exporteurs redessinent les images avec drawImage (normal maps, ORM) : un DataTexture brut n'est pas dessinable.
// On remplace donc, ici seulement, les octets bruts par un canvas 2D (buildPool reste sans canvas pour Node).
const canvasDe = new Map();
function versCanvas(texture) {
  const image = texture.image;
  if (!image || image.data === undefined) return;
  if (!canvasDe.has(image)) {
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(image.data), image.width, image.height), 0, 0);
    canvasDe.set(image, canvas);
  }
  texture.image = canvasDe.get(image);
}

// USDZ : USDZExporter range la géométrie d'un maillage à matériau unique dans un fichier geometries/ à part,
// et n'écrit dans model.usda (avec subdivisionScheme = "none" et sous-ensembles de faces) que les maillages à
// plusieurs matériaux. Les extrusions (margelle, plage) ont deux groupes natifs (dessus/dessous, côtés) :
// on leur donne le même matériau pour chaque groupe, rendu identique.
function groupesDansLeModele(groupe) {
  groupe.traverse((o) => {
    if (!o.isMesh || Array.isArray(o.material) || o.geometry.groups.length < 2) return;
    const n = Math.max(...o.geometry.groups.map((g) => g.materialIndex)) + 1;
    o.material = Array.from({ length: n }, () => o.material);
  });
  return groupe;
}

// Cartes sans transparence utile (relief, occlusion/rugosité) : en USDZ on les encode en JPEG, bien plus léger qu'un PNG de bruit.
const CARTES_EN_JPEG = new Set(['normalMap', 'roughnessMap', 'metalnessMap', 'aoMap']);

// Les textures sont partagées entre les piscines : on note les changements pour les défaire après l'export USDZ.
const mimeModifies = new Map();
const rendrePng = () => {
  for (const [texture, ancien] of mimeModifies) {
    if (ancien === undefined) delete texture.userData.mimeType;
    else texture.userData.mimeType = ancien;
  }
  mimeModifies.clear();
};

const scene = (groupe, { jpeg = false } = {}) => {
  const s = new Scene();
  s.add(groupe);
  s.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of [].concat(o.material)) {
      for (const [cle, valeur] of Object.entries(m)) {
        if (!valeur || !valeur.isTexture) continue;
        versCanvas(valeur);
        if (jpeg && CARTES_EN_JPEG.has(cle)) {
          if (!mimeModifies.has(valeur)) mimeModifies.set(valeur, valeur.userData.mimeType);
          valeur.userData.mimeType = 'image/jpeg';
        }
      }
    }
  });
  return s;
};

const OPTIONS_USDZ = { quickLookCompatible: true, maxTextureSize: 512 };

window.exporter = async (params, { eau = params.eauParDefaut } = {}) => {
  const glb = await new GLTFExporter().parseAsync(scene(buildPool(params, { eau })), { binary: true, maxTextureSize: 1024 });
  let usdz;
  let usdzSol;
  try {
    usdz = await new USDZExporter().parseAsync(scene(groupesDansLeModele(buildPool(params, { eau })), { jpeg: true }), OPTIONS_USDZ);
    usdzSol = await new USDZExporter().parseAsync(scene(groupesDansLeModele(buildPool(params, { eau, dalle: true })), { jpeg: true }), OPTIONS_USDZ);
  } finally {
    rendrePng();
  }
  return { glb: await base64(glb), usdz: await base64(usdz), usdzSol: await base64(usdzSol) };
};
window.__pret = true;

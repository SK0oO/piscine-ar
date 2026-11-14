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

const scene = (groupe) => {
  const s = new Scene();
  s.add(groupe);
  s.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of [].concat(o.material)) for (const valeur of Object.values(m)) if (valeur && valeur.isTexture) versCanvas(valeur);
  });
  return s;
};

const OPTIONS_USDZ = { quickLookCompatible: true, maxTextureSize: 1024 };

window.exporter = async (params, { eau = params.eauParDefaut } = {}) => {
  const glb = await new GLTFExporter().parseAsync(scene(buildPool(params, { eau })), { binary: true, maxTextureSize: 1024 });
  const usdz = await new USDZExporter().parseAsync(scene(groupesDansLeModele(buildPool(params, { eau }))), OPTIONS_USDZ);
  const usdzSol = await new USDZExporter().parseAsync(scene(groupesDansLeModele(buildPool(params, { eau, dalle: true }))), OPTIONS_USDZ);
  return { glb: await base64(glb), usdz: await base64(usdz), usdzSol: await base64(usdzSol) };
};
window.__pret = true;

// Matières PBR du bassin (plan §11) : DataTexture construites depuis models/generate/textures.js (pas de canvas : utilisable en Node).
// Les textures sont mises en cache par matière ; la taille physique passe par texture.repeat = 1 / tailleEnMètres.
import * as THREE from 'three';
import { pierre, mosaique, ondulations } from './textures.js';

const TAILLE_PIERRE_M = 1;
const TAILLE_MOSAIQUE_M = 0.5;
const TAILLE_EAU_M = 2;

const cache = new Map();

function texture(image, { couleur = false, jpeg = false, metres }) {
  const t = new THREE.DataTexture(image.data, image.largeur, image.hauteur, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 4;
  t.colorSpace = couleur ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.repeat.set(1 / metres, 1 / metres);
  t.userData.mimeType = jpeg ? 'image/jpeg' : 'image/png';
  t.needsUpdate = true;
  return t;
}

function jeu(nom, fabrique, metres, avecCouleur = true) {
  if (!cache.has(nom)) {
    const r = fabrique();
    const t = { normalMap: texture(r.normale, { metres }) };
    if (avecCouleur) {
      t.map = texture(r.couleur, { couleur: true, jpeg: true, metres });
      t.orm = texture(r.orm, { metres });
    }
    cache.set(nom, t);
  }
  return cache.get(nom);
}

// Matériau de surface : couleur de base × texture ; AO, roughness et métal (R, G, B) lus dans la même texture ORM
// (une seule texture : GLTFExporter l'écrit tel quel en metallicRoughness au lieu de recomposer une image).
function surface(nom, t, color) {
  return new THREE.MeshStandardMaterial({
    name: nom, color, map: t.map, normalMap: t.normalMap, roughnessMap: t.orm, metalnessMap: t.orm, aoMap: t.orm,
    roughness: 1, metalness: 0, side: THREE.FrontSide,
  });
}

export function creerMateriaux(params, couleurEauHex) {
  const eauCouleur = new THREE.Color(couleurEauHex);
  const pi = jeu('pierre', () => pierre(1024), TAILLE_PIERRE_M);
  const mo = jeu('mosaique', () => mosaique(512), TAILLE_MOSAIQUE_M);
  const ea = jeu('ondulations', () => ondulations(512), TAILLE_EAU_M, false);

  return {
    margelle: surface('margelle', pi, new THREE.Color(params.margelle.couleur)),
    mosaique: surface('liner', mo, eauCouleur.clone()),
    mosaiqueClaire: surface('liner-clair', mo, eauCouleur.clone().lerp(new THREE.Color('#ffffff'), 0.35)),
    fond: surface('fond', mo, eauCouleur.clone().lerp(new THREE.Color('#000000'), 0.6)),
    eau: new THREE.MeshStandardMaterial({
      name: 'eau', color: eauCouleur.clone(), normalMap: ea.normalMap, roughness: 0.08, metalness: 0,
      transparent: true, opacity: 0.65, side: THREE.FrontSide,
    }),
  };
}

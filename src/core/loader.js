import { LoadingManager } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PiscineArError } from './erreurs.js';

const DELAI_MS = 30_000;
const TAILLE_MAX = 8 * 1024 * 1024; // le contrat vise < 4 Mo : marge x2

// Un GLB doit être autonome : toute ressource référencée (image, tampon) ne peut être
// qu'embarquée (data: ou blob:). Une URL http(s) ferait charger un serveur tiers = traceur.
export function creerGestionnaireFerme() {
  const manager = new LoadingManager();
  manager.setURLModifier((url) => {
    if (typeof url === 'string' && (url.startsWith('data:') || url.startsWith('blob:'))) return url;
    throw new PiscineArError('modele-invalide', 'modèle avec ressource externe');
  });
  return manager;
}

// Lit la réponse en flux et s'arrête dès que le plafond est dépassé.
async function lireAvecPlafond(reponse, max) {
  if (!reponse.body) {
    const tampon = await reponse.arrayBuffer();
    if (tampon.byteLength > max) throw new PiscineArError('modele-invalide', 'modèle trop lourd');
    return tampon;
  }
  const lecteur = reponse.body.getReader();
  const morceaux = [];
  let total = 0;
  for (;;) {
    const { done, value } = await lecteur.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await lecteur.cancel();
      throw new PiscineArError('modele-invalide', 'modèle trop lourd');
    }
    morceaux.push(value);
  }
  const sortie = new Uint8Array(total);
  let offset = 0;
  for (const m of morceaux) { sortie.set(m, offset); offset += m.byteLength; }
  return sortie.buffer;
}

// Lit le chunk JSON d'un GLB et refuse toute ressource (image, tampon) qui ne serait pas embarquée.
export function verifierRessources(tampon) {
  const dv = new DataView(tampon);
  if (tampon.byteLength < 20 || dv.getUint32(0, true) !== 0x46546c67) {
    throw new PiscineArError('modele-invalide', 'modèle illisible');
  }
  const longueurJson = dv.getUint32(12, true);
  if (dv.getUint32(16, true) !== 0x4e4f534a || 20 + longueurJson > tampon.byteLength) {
    throw new PiscineArError('modele-invalide', 'modèle illisible');
  }
  let json;
  try {
    json = JSON.parse(new TextDecoder().decode(new Uint8Array(tampon, 20, longueurJson)));
  } catch {
    throw new PiscineArError('modele-invalide', 'modèle illisible');
  }
  for (const liste of [json.images, json.buffers]) {
    for (const r of liste ?? []) {
      const uri = r?.uri;
      if (uri === undefined) continue;
      if (typeof uri !== 'string' || !(uri.startsWith('data:') || uri.startsWith('blob:'))) {
        throw new PiscineArError('modele-invalide', 'modèle avec ressource externe');
      }
    }
  }
}

// Analyse un GLB déjà en mémoire (exporté pour les tests).
export async function analyserGlb(tampon) {
  verifierRessources(tampon);
  try {
    const gltf = await new GLTFLoader(creerGestionnaireFerme()).parseAsync(tampon, '');
    return gltf.scene;
  } catch (e) {
    if (e instanceof PiscineArError) throw e;
    throw new PiscineArError('modele-invalide', 'modèle illisible');
  }
}

// Couche mince sur GLTFLoader, sans cache. GET seulement, sans cookie, sans redirection, avec délai maximum.
export async function chargerGlb(url) {
  let reponse;
  try {
    reponse = await fetch(url, { credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(DELAI_MS) });
    if (!reponse.ok) throw new Error('http');
  } catch {
    throw new PiscineArError('modele-introuvable', 'modèle injoignable');
  }
  const tampon = await lireAvecPlafond(reponse, TAILLE_MAX);
  return analyserGlb(tampon);
}

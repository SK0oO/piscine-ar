import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PiscineArError } from './erreurs.js';

const DELAI_MS = 30_000;
const TAILLE_MAX = 8 * 1024 * 1024; // le contrat vise < 4 Mo : marge x2

// Couche mince sur GLTFLoader, sans cache. GET seulement, sans cookie, avec délai maximum.
export async function chargerGlb(url) {
  let tampon;
  try {
    const reponse = await fetch(url, { credentials: 'omit', signal: AbortSignal.timeout(DELAI_MS) });
    if (!reponse.ok) throw new Error('http');
    tampon = await reponse.arrayBuffer();
  } catch {
    throw new PiscineArError('modele-introuvable', 'modèle injoignable');
  }
  if (tampon.byteLength > TAILLE_MAX) throw new PiscineArError('modele-invalide', 'modèle trop lourd');
  try {
    const gltf = await new GLTFLoader().parseAsync(tampon, '');
    return gltf.scene;
  } catch {
    throw new PiscineArError('modele-invalide', 'modèle illisible');
  }
}

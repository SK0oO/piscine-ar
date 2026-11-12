import * as THREE from 'three';
import { PiscineArError } from './erreurs.js';

const liberer = (racine) => {
  racine.traverse((n) => {
    n.geometry?.dispose();
    const mats = Array.isArray(n.material) ? n.material : n.material ? [n.material] : [];
    for (const m of mats) {
      for (const v of Object.values(m)) if (v && v.isTexture) v.dispose();
      m.dispose();
    }
  });
};

const dimensionsDe = (racine) => {
  racine.updateMatrixWorld(true);
  const cible = racine.getObjectByName('eau') ?? racine;
  const taille = new THREE.Box3().setFromObject(cible).getSize(new THREE.Vector3());
  return { longueur: taille.x, largeur: taille.z };
};

export function createModelSwitcher({ pivot, charger }) {
  let courant = null; // { id, dimensions, racine }
  let jeton = 0;

  const publique = () => (courant ? { id: courant.id, dimensions: { ...courant.dimensions } } : null);

  async function selectionner(modele) {
    if (courant && courant.id === modele.id) {
      jeton++; // le dernier appel gagne : un chargement en vol est jeté
      return publique();
    }
    const moi = ++jeton;
    let racine;
    try {
      racine = await charger(modele.glb);
    } catch {
      if (moi !== jeton) return null;
      throw new PiscineArError('modele-introuvable', `modèle introuvable : ${modele.id}`);
    }
    if (moi !== jeton) {
      liberer(racine);
      return null;
    }
    const dimensions = dimensionsDe(racine);
    if (courant) {
      pivot.remove(courant.racine);
      liberer(courant.racine);
    }
    pivot.add(racine);
    courant = { id: modele.id, dimensions, racine };
    return publique();
  }

  return { selectionner, courant: publique };
}

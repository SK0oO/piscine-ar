import * as THREE from 'three';

// Construit un modèle factice au contrat E1 : nœud `eau` (longueur × largeur) et nœud `margelle`.
export function fabriquerModele({ longueur = 8, largeur = 4 } = {}) {
  const racine = new THREE.Group();
  const eau = new THREE.Mesh(new THREE.BoxGeometry(longueur, 0.1, largeur), new THREE.MeshBasicMaterial());
  eau.name = 'eau';
  const margelle = new THREE.Mesh(new THREE.BoxGeometry(longueur + 1, 0.1, largeur + 1), new THREE.MeshBasicMaterial());
  margelle.name = 'margelle';
  racine.add(eau, margelle);
  racine.userData.libere = { geometrie: 0, materiau: 0 };
  for (const m of [eau, margelle]) {
    const g = m.geometry.dispose.bind(m.geometry);
    m.geometry.dispose = () => { racine.userData.libere.geometrie++; g(); };
    const mat = m.material.dispose.bind(m.material);
    m.material.dispose = () => { racine.userData.libere.materiau++; mat(); };
  }
  return racine;
}

export const estLibere = (racine) => racine.userData.libere.geometrie > 0;

// Chargeur factice contrôlable : charger(url) renvoie une promesse que le test résout ou rejette à la main.
export function creerChargeurFactice() {
  const appels = [];
  const charger = (url) => {
    let resolve, reject;
    const promesse = new Promise((res, rej) => { resolve = res; reject = rej; });
    appels.push({ url, resolve, reject });
    return promesse;
  };
  const dernier = (url) => [...appels].reverse().find((a) => a.url === url);
  return { charger, appels, dernier };
}

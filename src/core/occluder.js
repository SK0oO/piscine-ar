import * as THREE from 'three';
import { PiscineArError } from './erreurs.js';

const TAILLE_PLAN = 40; // m
const Y_PLAN = -0.001; // m : juste sous le niveau de la margelle
const TOLERANCE_Y = 1e-3; // m : « à y ≈ 0 »
const ECHELLE_CLE = 1e4; // quantification des sommets (0,1 mm)

const invalide = () => new PiscineArError('modele-invalide', 'margelle introuvable ou inexploitable');

// Boucles fermées formées par les arêtes de bord des triangles de la face haute (y ≈ 0).
function bouclesDeBord(geometrie, matrice) {
  const pos = geometrie.getAttribute('position');
  if (!pos) return [];
  const index = geometrie.getIndex();
  const nbSommets = index ? index.count : pos.count;
  const sommet = (i) => new THREE.Vector3().fromBufferAttribute(pos, index ? index.getX(i) : i).applyMatrix4(matrice);
  const cle = (v) => `${Math.round(v.x * ECHELLE_CLE)},${Math.round(v.z * ECHELLE_CLE)}`;

  const points = new Map(); // clé → [x, z]
  const aretes = new Map(); // "a|b" (ordonné) → { a, b, n }
  for (let i = 0; i + 2 < nbSommets; i += 3) {
    const tri = [sommet(i), sommet(i + 1), sommet(i + 2)];
    if (!tri.every((v) => Math.abs(v.y) <= TOLERANCE_Y)) continue; // pas la face haute
    const cles = tri.map(cle);
    tri.forEach((v, k) => points.set(cles[k], [v.x, v.z]));
    for (let k = 0; k < 3; k++) {
      const a = cles[k];
      const b = cles[(k + 1) % 3];
      if (a === b) continue;
      const id = a < b ? `${a}|${b}` : `${b}|${a}`;
      const e = aretes.get(id) ?? { a, b, n: 0 };
      e.n++;
      aretes.set(id, e);
    }
  }

  const voisins = new Map();
  for (const { a, b, n } of aretes.values()) {
    if (n !== 1) continue; // arête intérieure (partagée par deux triangles)
    (voisins.get(a) ?? voisins.set(a, []).get(a)).push(b);
    (voisins.get(b) ?? voisins.set(b, []).get(b)).push(a);
  }

  const utilisees = new Set();
  const id = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const boucles = [];
  for (const depart of voisins.keys()) {
    for (const premier of voisins.get(depart)) {
      if (utilisees.has(id(depart, premier))) continue;
      const boucle = [depart];
      let precedent = depart;
      let courant = premier;
      utilisees.add(id(depart, premier));
      while (courant !== depart) {
        boucle.push(courant);
        const suivant = voisins.get(courant).find((c) => c !== precedent && !utilisees.has(id(courant, c)));
        if (suivant === undefined) break;
        utilisees.add(id(courant, suivant));
        precedent = courant;
        courant = suivant;
      }
      if (courant === depart && boucle.length >= 3) boucles.push(boucle.map((c) => points.get(c)));
    }
  }
  return boucles;
}

const aire = (pts) => {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, z1] = pts[i];
    const [x2, z2] = pts[(i + 1) % pts.length];
    s += x1 * z2 - x2 * z1;
  }
  return Math.abs(s) / 2;
};

// Plan de 40 × 40 m percé du contour extérieur de la margelle : il cache la vraie pelouse hors
// de la piscine (occludeur, invisible mais écrit en profondeur) et reçoit l'ombre (ombre).
export function buildOccluder(racine) {
  const margelle = racine?.getObjectByName?.('margelle');
  if (!margelle?.geometry) throw invalide();
  racine.updateMatrixWorld(true);
  const relative = new THREE.Matrix4().copy(racine.matrixWorld).invert().multiply(margelle.matrixWorld);
  const boucles = bouclesDeBord(margelle.geometry, relative);
  if (boucles.length === 0) throw invalide();
  const brut = boucles.reduce((meilleur, b) => (aire(b) > aire(meilleur) ? b : meilleur));
  // Départ canonique (sommet le plus à gauche puis le plus en arrière) : la découpe ne dépend pas de l'ordre des triangles du modèle.
  const premier = brut.reduce((m, p, i) => (p[0] < brut[m][0] || (p[0] === brut[m][0] && p[1] < brut[m][1]) ? i : m), 0);
  const depart = [...brut.slice(premier), ...brut.slice(0, premier)];
  // Un sommet au milieu de chaque arête : évite qu'une diagonale de la découpe passe pile par le milieu d'une encoche
  // (un rayon y toucherait alors deux triangles à la fois).
  const contour = depart.flatMap((p, i) => {
    const q = depart[(i + 1) % depart.length];
    return [p, [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]];
  });

  const demi = TAILLE_PLAN / 2;
  // ShapeGeometry vit dans le plan XY ; rotateX(−π/2) envoie (x, y) sur (x, −y) en z : on donne donc y = −z.
  const forme = new THREE.Shape([[-demi, -demi], [demi, -demi], [demi, demi], [-demi, demi]].map(([x, y]) => new THREE.Vector2(x, y)));
  forme.holes.push(new THREE.Path(contour.map(([x, z]) => new THREE.Vector2(x, -z))));
  const geometrie = new THREE.ShapeGeometry(forme);
  geometrie.rotateX(-Math.PI / 2);
  geometrie.translate(0, Y_PLAN, 0);

  const occludeur = new THREE.Mesh(geometrie, new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true }));
  occludeur.renderOrder = -1;
  occludeur.name = 'occludeur';
  const ombre = new THREE.Mesh(geometrie, new THREE.ShadowMaterial({ opacity: 0.25 }));
  ombre.receiveShadow = true;
  ombre.name = 'ombre';
  return { occludeur, ombre };
}

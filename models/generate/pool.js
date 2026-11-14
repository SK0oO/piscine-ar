import * as THREE from 'three';
import { creerMateriaux } from './materiaux.js';

const SEG = 96; // points par contour : assez lisse, bien sous 20 000 triangles
const NIVEAU_EAU = -0.15;
// Dalle à ras du sol (Quick Look) : Apple pose le point le plus bas sur le sol détecté.
const DALLE_EAU = -0.02;
const DALLE_FOND = -0.05;

// ---- contours (liste de points {x, z}, sens trigonométrique en vue de dessus) ----

function rectangleArrondi(L, W, r) {
  const rr = Math.min(r || 0, L / 2, W / 2);
  const pts = [];
  const n = 12;
  const centres = [
    [L / 2 - rr, W / 2 - rr, 0],
    [-L / 2 + rr, W / 2 - rr, Math.PI / 2],
    [-L / 2 + rr, -W / 2 + rr, Math.PI],
    [L / 2 - rr, -W / 2 + rr, 1.5 * Math.PI],
  ];
  for (const [cx, cz, a0] of centres) {
    for (let i = 0; i <= n; i++) {
      const a = a0 + (i / n) * (Math.PI / 2);
      pts.push({ x: cx + rr * Math.cos(a), z: cz + rr * Math.sin(a) });
    }
  }
  return pts;
}

function ovale(L, W) {
  const pts = [];
  for (let i = 0; i < SEG; i++) {
    const t = (i / SEG) * Math.PI * 2;
    pts.push({ x: (L / 2) * Math.cos(t), z: (W / 2) * Math.sin(t) });
  }
  return pts;
}

// Haricot : ellipse creusée au milieu d'un long côté, puis recalée sur L x W exactement.
function haricot(L, W) {
  const brut = [];
  for (let i = 0; i < SEG; i++) {
    const t = (i / SEG) * Math.PI * 2;
    const dt = Math.atan2(Math.sin(t + Math.PI / 2), Math.cos(t + Math.PI / 2));
    const r = 1 - 0.32 * Math.exp(-(dt * dt) / 0.5); // creux sur un long côté
    brut.push({ x: r * Math.cos(t), z: r * Math.sin(t) });
  }
  const xs = brut.map((p) => p.x);
  const zs = brut.map((p) => p.z);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const z0 = Math.min(...zs), z1 = Math.max(...zs);
  return brut.map((p) => ({
    x: ((p.x - x0) / (x1 - x0) - 0.5) * L,
    z: ((p.z - z0) / (z1 - z0) - 0.5) * W,
  }));
}

function contour(params) {
  const { forme, longueur: L, largeur: W } = params;
  if (forme === 'rectangle') return rectangleArrondi(L, W, params.rayonAngle);
  if (forme === 'ovale') return ovale(L, W);
  if (forme === 'haricot') return haricot(L, W);
  throw new Error(`forme inconnue : ${forme}`);
}

function aireSignee(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    a += p.x * q.z - q.x * p.z;
  }
  return a / 2;
}

function decale(pts, d) {
  const sens = aireSignee(pts) > 0 ? 1 : -1;
  const n = pts.length;
  return pts.map((p, i) => {
    const a = pts[(i + n - 1) % n], b = pts[(i + 1) % n];
    const tx = b.x - a.x, tz = b.z - a.z;
    const l = Math.hypot(tx, tz) || 1;
    // normale sortante (contour dans l'espace x, z)
    return { x: p.x + (sens * tz / l) * d, z: p.z - (sens * tx / l) * d };
  });
}

function coupeX(pts, xmin) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    const pin = p.x >= xmin, qin = q.x >= xmin;
    if (pin) out.push(p);
    if (pin !== qin) {
      const t = (xmin - p.x) / (q.x - p.x);
      out.push({ x: xmin, z: p.z + t * (q.z - p.z) });
    }
  }
  return out;
}

// ---- géométries ----

// Shape en (x, y) ; rotateX(+90°) : y -> z. Extrusion vers le bas (y de -ep à 0).
function shapeDessus(pts) {
  return new THREE.Shape(pts.map((p) => new THREE.Vector2(p.x, p.z)));
}

function margelleGeo(interieur, exterieur, ep) {
  const shape = shapeDessus(exterieur);
  shape.holes.push(new THREE.Path(interieur.map((p) => new THREE.Vector2(p.x, p.z))));
  const g = new THREE.ExtrudeGeometry(shape, { depth: ep, bevelEnabled: false, steps: 1 });
  g.rotateX(Math.PI / 2);
  return g;
}

// Parois seules (de sous la margelle à -prof). UV en mètres : u = longueur d'arc le long du contour, v = y.
// La couture du contour est dupliquée (u = périmètre) pour que la texture ne s'étire pas sur le dernier pan.
function bassinGeo(pts, prof, ep) {
  const pos = [];
  const uv = [];
  const idx = [];
  const n = pts.length;
  let arc = 0;
  for (let i = 0; i <= n; i++) {
    const p = pts[i % n];
    if (i > 0) { const q = pts[i - 1]; arc += Math.hypot(p.x - q.x, p.z - q.z); }
    pos.push(p.x, -ep, p.z, p.x, -prof, p.z); // haut (sous la margelle) puis bas, dans l'ordre du contour
    uv.push(arc, -ep, arc, -prof);
  }
  for (let i = 0; i < n; i++) {
    const a = i * 2, b = (i + 1) * 2;
    idx.push(a, a + 1, b, b, a + 1, b + 1); // faces vers l'intérieur du bassin
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Disque plat horizontal à la hauteur y (normale vers le haut).
function planGeo(pts, y) {
  const g = new THREE.ShapeGeometry(new THREE.Shape(pts.map((p) => new THREE.Vector2(p.x, -p.z))));
  g.rotateX(-Math.PI / 2);
  g.translate(0, y, 0);
  return g;
}

function plageGeo(pts, longueur, haut, prof) {
  const zone = coupeX(pts, longueur / 2 - haut.longueur);
  const shape = new THREE.Shape(zone.map((p) => new THREE.Vector2(p.x, -p.z)));
  const hauteur = prof - haut.profondeur;
  const g = new THREE.ExtrudeGeometry(shape, { depth: hauteur, bevelEnabled: false, steps: 1 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, -prof, 0);
  return g;
}

// UV en mètres sur chaque face : dessus/dessous (u = x, v = z), côtés (u = y, v = horizontale).
function uvBoite(geo) {
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const vertical = Math.abs(nor.getY(i)) > 0.5;
    if (vertical) { uv[i * 2] = pos.getX(i); uv[i * 2 + 1] = pos.getZ(i); }
    else {
      uv[i * 2] = pos.getY(i);
      uv[i * 2 + 1] = Math.abs(nor.getX(i)) > 0.5 ? pos.getZ(i) : pos.getX(i);
    }
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

function escalierGroupe(params, matMarche) {
  const { longueur: L, largeur: W, profondeur: prof } = params;
  const n = params.escalier.marches;
  const r = params.rayonAngle || 0;
  const retrait = r * (1 - Math.SQRT1_2); // reste dans l'arrondi de l'angle
  const cx = L / 2 - retrait, cz = W / 2 - retrait;
  const haut = Math.min(0.3, (prof * 0.7) / n);
  const groupe = new THREE.Group();
  groupe.name = 'escalier';
  for (let i = 0; i < n; i++) {
    const top = -haut * (i + 1);
    const taille = 0.5 * (i + 1);
    const h = prof + top;
    const box = uvBoite(new THREE.BoxGeometry(taille, h, taille));
    const m = new THREE.Mesh(box, matMarche);
    m.name = `marche-${i + 1}`;
    m.position.set(cx - taille / 2, top - h / 2, cz - taille / 2);
    groupe.add(m);
  }
  return groupe;
}

// ---- assemblage ----

export function buildPool(params, { eau, dalle = false } = {}) {
  const couleurEau = params.eaux && params.eaux[eau];
  if (!couleurEau) throw new Error(`couleur d'eau inconnue : ${eau}`);

  const interieur = contour(params);
  const exterieur = decale(interieur, params.margelle.largeur);
  const prof = params.profondeur;

  const mat = creerMateriaux(params, couleurEau);

  const groupe = new THREE.Group();
  groupe.name = params.id;

  if (dalle) {
    // Margelle (dessus à y = 0) + eau + fond sombre : pas de parois ni de fond profond, point le plus bas à -0,05.
    const margelleDalle = new THREE.Mesh(margelleGeo(interieur, exterieur, params.margelle.epaisseur), mat.margelle);
    margelleDalle.name = 'margelle';
    const fond = new THREE.Mesh(planGeo(interieur, DALLE_FOND), mat.fond);
    fond.name = 'fond';
    const eauDalle = new THREE.Mesh(planGeo(interieur, DALLE_EAU), mat.eau);
    eauDalle.name = 'eau';
    groupe.add(margelleDalle, fond, eauDalle);
    groupe.traverse((o) => { if (o.isMesh) { o.castShadow = o.name !== 'eau'; o.receiveShadow = true; } });
    return groupe;
  }

  const margelle = new THREE.Mesh(margelleGeo(interieur, exterieur, params.margelle.epaisseur), mat.margelle);
  margelle.name = 'margelle';
  const bassin = new THREE.Mesh(bassinGeo(interieur, prof, params.margelle.epaisseur), mat.mosaique);
  bassin.name = 'bassin';
  const fond = new THREE.Mesh(planGeo(interieur, -prof), mat.fond);
  fond.name = 'fond';
  const plan = new THREE.Mesh(planGeo(interieur, NIVEAU_EAU), mat.eau);
  plan.name = 'eau';
  groupe.add(margelle, bassin, fond);

  if (params.escalier) groupe.add(escalierGroupe(params, mat.mosaiqueClaire));
  if (params.plageImmergee) {
    const plage = new THREE.Mesh(plageGeo(interieur, params.longueur, params.plageImmergee, prof), mat.mosaiqueClaire);
    plage.name = 'plage';
    groupe.add(plage);
  }
  groupe.add(plan); // l'eau en dernier : transparente, dessinée après le reste

  groupe.traverse((o) => { if (o.isMesh) { o.castShadow = o.name !== 'eau'; o.receiveShadow = true; } });
  return groupe;
}


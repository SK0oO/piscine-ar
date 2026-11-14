// Textures procédurales (plan §11) : pur JavaScript, sans Three ni canvas, déterministe (graine fixe).
// Chaque image = { largeur, hauteur, data: Uint8Array RGBA }. Les lignes de `data` suivent v vers le haut
// (convention DataTexture, flipY = false). Toutes les images sont tuilables.

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const octet = (v) => Math.round(clamp01(v) * 255);
const lisse = (t) => t * t * (3 - 2 * t);
const etape = (a, b, x) => lisse(clamp01((x - a) / (b - a)));

// PRNG mulberry32.
function prng(graine) {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Bruit de valeur tuilable : grille periode × periode, interpolation lissée avec retour à zéro.
function bruitDeValeur(taille, rng, periode) {
  const p = Math.max(1, Math.min(periode, taille));
  const grille = new Float32Array(p * p);
  for (let i = 0; i < grille.length; i++) grille[i] = rng();
  const out = new Float32Array(taille * taille);
  const pas = p / taille;
  for (let y = 0; y < taille; y++) {
    const gy = y * pas;
    const y0 = Math.floor(gy);
    const fy = lisse(gy - y0);
    const y1 = (y0 + 1) % p;
    for (let x = 0; x < taille; x++) {
      const gx = x * pas;
      const x0 = Math.floor(gx);
      const fx = lisse(gx - x0);
      const x1 = (x0 + 1) % p;
      const a = grille[y0 * p + x0] + (grille[y0 * p + x1] - grille[y0 * p + x0]) * fx;
      const b = grille[y1 * p + x0] + (grille[y1 * p + x1] - grille[y1 * p + x0]) * fx;
      out[y * taille + x] = a + (b - a) * fy;
    }
  }
  return out;
}

// Bruit fractal tuilable, valeurs 0..1. `periode` en cycles par texture ; cellule minimale de 4 px.
function fbm(taille, rng, periode, octaves, gain = 0.5) {
  const out = new Float32Array(taille * taille);
  let amp = 1, somme = 0, p = Math.max(1, Math.min(periode, taille / 4));
  for (let o = 0; o < octaves; o++) {
    if (taille / p < 4) break;
    const b = bruitDeValeur(taille, rng, p);
    for (let i = 0; i < out.length; i++) out[i] += b[i] * amp;
    somme += amp;
    amp *= gain;
    p *= 2;
  }
  for (let i = 0; i < out.length; i++) out[i] /= somme || 1;
  return out;
}

const champ = (taille, f) => new Float32Array(taille * taille).fill(f);

const nouvelleImage = (taille) => ({ largeur: taille, hauteur: taille, data: new Uint8Array(taille * taille * 4) });

// ---- briques publiques ----

// Hauteur (0..1) → normal map RGBA, convention OpenGL (Y vers le haut), différences finies avec retour (tuilable).
export function hauteurVersNormale(h, force = 1) {
  const { largeur: w, hauteur: ht, data } = h;
  const out = { largeur: w, hauteur: ht, data: new Uint8Array(w * ht * 4) };
  for (let y = 0; y < ht; y++) {
    const ym = (y + ht - 1) % ht, yp = (y + 1) % ht;
    for (let x = 0; x < w; x++) {
      const xm = (x + w - 1) % w, xp = (x + 1) % w;
      const dx = (data[y * w + xp] - data[y * w + xm]) * 0.5 * w;
      const dy = (data[yp * w + x] - data[ym * w + x]) * 0.5 * ht;
      let nx = -dx * force / w * 8, ny = -dy * force / ht * 8, nz = 1;
      const l = Math.hypot(nx, ny, nz);
      nx /= l; ny /= l; nz /= l;
      const o = (y * w + x) * 4;
      out.data[o] = octet(nx * 0.5 + 0.5);
      out.data[o + 1] = octet(ny * 0.5 + 0.5);
      out.data[o + 2] = octet(nz * 0.5 + 0.5);
      out.data[o + 3] = 255;
    }
  }
  return out;
}

// AO en R, roughness en G, métal en B (convention glTF ORM), alpha opaque.
export function empaqueterORM(ao, rough, metal) {
  const { largeur, hauteur } = ao;
  const data = new Uint8Array(largeur * hauteur * 4);
  for (let i = 0; i < largeur * hauteur; i++) {
    data[i * 4] = octet(ao.data[i]);
    data[i * 4 + 1] = octet(rough.data[i]);
    data[i * 4 + 2] = octet(metal.data[i]);
    data[i * 4 + 3] = 255;
  }
  return { largeur, hauteur, data };
}

const carte = (taille, data) => ({ largeur: taille, hauteur: taille, data });

// Distance (en unités de période) à la ligne la plus proche d'une famille de lignes périodiques.
const distancePeriodique = (u, lignes) => {
  let d = 1;
  for (const l of lignes) {
    const e = Math.abs(u - l);
    d = Math.min(d, e, 1 - e);
  }
  return d;
};

// ---- pierre : margelle, période physique 1 m ----

export function pierre(taille = 512, graine = 11) {
  const rng = prng(graine);
  const grain = fbm(taille, rng, 32, 4, 0.55);
  const nuage = fbm(taille, rng, 4, 3, 0.5);
  const pores = fbm(taille, rng, 32, 2, 0.5);
  const veine = fbm(taille, rng, 6, 3, 0.5);
  const dalleAlea = fbm(taille, rng, 2, 1);
  const metre = 1 / taille;
  const LIGNES = [0.3, 0.9]; // dalles de 0,6 m et 0,4 m
  const DEMI_JOINT = 0.004; // joint de 8 mm
  const hauteur = new Float32Array(taille * taille);
  const ao = champ(taille, 1);
  const rugosite = new Float32Array(taille * taille);
  const couleur = nouvelleImage(taille);
  for (let y = 0; y < taille; y++) {
    for (let x = 0; x < taille; x++) {
      const i = y * taille + x;
      const u = (x + 0.5) * metre, v = (y + 0.5) * metre;
      const d = Math.min(distancePeriodique(u, LIGNES), distancePeriodique(v, LIGNES));
      const joint = 1 - etape(DEMI_JOINT - 0.002, DEMI_JOINT + 0.002, d); // 1 dans le joint
      const pore = etape(0.7, 0.85, pores[i]); // taches creuses
      const trait = 1 - etape(0.0, 0.05, Math.abs(veine[i] - 0.5)); // veines fines et claires
      hauteur[i] = 0.55 + (grain[i] - 0.5) * 0.35 + (nuage[i] - 0.5) * 0.2 - pore * 0.25 - joint * 0.5;
      ao[i] = 1 - joint * 0.45 - pore * 0.2;
      rugosite[i] = clamp01(0.84 + (grain[i] - 0.5) * 0.4 + (nuage[i] - 0.5) * 0.2 + joint * 0.1 + pore * 0.05);
      const lumi = 0.88 + (nuage[i] - 0.5) * 0.16 + (grain[i] - 0.5) * 0.08 + (dalleAlea[i] - 0.5) * 0.04 - pore * 0.1 - trait * 0.05 - joint * 0.2;
      const o = i * 4;
      couleur.data[o] = octet(lumi * 0.99);
      couleur.data[o + 1] = octet(lumi * 0.97);
      couleur.data[o + 2] = octet(lumi * 0.93);
      couleur.data[o + 3] = 255;
    }
  }
  const normale = hauteurVersNormale(carte(taille, hauteur), 0.9);
  const orm = empaqueterORM(carte(taille, ao), carte(taille, rugosite), carte(taille, champ(taille, 0)));
  return { couleur, normale, orm };
}

// ---- mosaïque : carreaux de 5 cm, joints de 4 mm, période physique 0,5 m (10 carreaux) ----

export function mosaique(taille = 512, graine = 22) {
  const rng = prng(graine);
  const CARREAUX = 10;
  const variation = new Float32Array(CARREAUX * CARREAUX);
  for (let i = 0; i < variation.length; i++) variation[i] = rng();
  const reflet = fbm(taille, rng, 8, 3, 0.5);
  const fin = fbm(taille, rng, 32, 2, 0.5);
  const hauteur = new Float32Array(taille * taille);
  const ao = champ(taille, 1);
  const rugosite = new Float32Array(taille * taille);
  const couleur = nouvelleImage(taille);
  const DEMI_JOINT_MM = 2;
  const BISEAU_MM = 1.5;
  for (let y = 0; y < taille; y++) {
    const v = ((y + 0.5) / taille) * CARREAUX + 0.5; // joints décalés : le bord de l'image tombe au centre d'un carreau
    const cy = Math.floor(v) % CARREAUX;
    const dv = Math.min(v - Math.floor(v), Math.ceil(v) - v) * 50; // mm au bord le plus proche
    for (let x = 0; x < taille; x++) {
      const i = y * taille + x;
      const u = ((x + 0.5) / taille) * CARREAUX + 0.5;
      const cx = Math.floor(u) % CARREAUX;
      const du = Math.min(u - Math.floor(u), Math.ceil(u) - u) * 50;
      const d = Math.min(du, dv);
      const joint = d < DEMI_JOINT_MM ? 1 : 0;
      const biseau = etape(DEMI_JOINT_MM, DEMI_JOINT_MM + BISEAU_MM, d);
      const t = variation[cy * CARREAUX + cx];
      hauteur[i] = biseau * 0.6 + (fin[i] - 0.5) * 0.04;
      ao[i] = joint ? 0.65 : 0.92 + biseau * 0.08;
      rugosite[i] = joint ? 0.9 + (fin[i] - 0.5) * 0.08 : 0.25 + (reflet[i] - 0.5) * 0.12 + t * 0.06;
      // quasi neutre : seule la luminance varie (±4 % par carreau), la teinte vient de material.color
      const lumi = joint ? 0.7 + (fin[i] - 0.5) * 0.04 : 0.9 + (t - 0.5) * 0.08 + (reflet[i] - 0.5) * 0.04;
      const g = octet(lumi);
      const o = i * 4;
      couleur.data[o] = g;
      couleur.data[o + 1] = g;
      couleur.data[o + 2] = g;
      couleur.data[o + 3] = 255;
    }
  }
  const normale = hauteurVersNormale(carte(taille, hauteur), 1.4);
  const orm = empaqueterORM(carte(taille, ao), carte(taille, rugosite), carte(taille, champ(taille, 0)));
  return { couleur, normale, orm };
}

// ---- ondulations : normal map de rides, période physique 2 m ----

export function ondulations(taille = 512, graine = 33) {
  const rng = prng(graine);
  const large = fbm(taille, rng, 4, 2, 0.5);
  const rides = fbm(taille, rng, 8, 3, 0.55);
  const hauteur = new Float32Array(taille * taille);
  for (let i = 0; i < hauteur.length; i++) {
    const crete = 1 - Math.abs(rides[i] * 2 - 1); // rides à crêtes marquées
    hauteur[i] = crete * 0.7 + large[i] * 0.3;
  }
  return { normale: hauteurVersNormale(carte(taille, hauteur), 0.9) };
}

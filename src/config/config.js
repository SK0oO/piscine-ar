import { PiscineArError } from '../core/erreurs.js';

// Clés de texte connues (les autres sont ignorées).
export const CLES_TEXTES = Object.freeze([
  'titre', 'explication', 'autoriser', 'reessayer', 'voirSansCamera', 'lancerCamera',
  'figer', 'enregistrer', 'reprendre', 'recentrer', 'balayerSol', 'viserContraste', 'voirEnRA',
]);

const ID = /^[a-z0-9-]+$/;
const COULEUR = /^#[0-9a-fA-F]{6}$/;
const MAX_TEXTE = 200;

const invalide = (champ, raison) => new PiscineArError('config-invalide', `${champ} : ${raison}`);
const objet = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function texte(v, champ) {
  if (typeof v !== 'string' || v.trim() === '' || v.length > MAX_TEXTE) throw invalide(champ, 'texte attendu (1 à 200 caractères)');
  return v;
}

function url(v, champ, { configUrl, originesAutorisees }) {
  if (typeof v !== 'string' || v === '') throw invalide(champ, 'URL attendue');
  let u;
  try {
    u = new URL(v, configUrl);
  } catch {
    throw invalide(champ, 'URL illisible');
  }
  if ((u.protocol !== 'https:' && u.protocol !== 'http:') || !originesAutorisees.includes(u.origin)) {
    throw invalide(champ, 'origine non autorisée');
  }
  return u.href;
}

export function parseConfig(json, { configUrl, originesAutorisees }) {
  const ctx = { configUrl, originesAutorisees };
  if (!objet(json)) throw invalide('config', 'objet attendu');
  if (json.version !== 1) throw invalide('version', 'doit valoir 1');

  if (!objet(json.pisciniste)) throw invalide('pisciniste', 'objet attendu');
  const pisciniste = {
    nom: texte(json.pisciniste.nom, 'pisciniste.nom'),
    logo: json.pisciniste.logo == null ? null : url(json.pisciniste.logo, 'pisciniste.logo', ctx),
  };

  const couleurs = {};
  if (json.couleurs !== undefined) {
    if (!objet(json.couleurs)) throw invalide('couleurs', 'objet attendu');
    if (json.couleurs.accent !== undefined) {
      if (typeof json.couleurs.accent !== 'string' || !COULEUR.test(json.couleurs.accent)) {
        throw invalide('couleurs.accent', 'couleur #rrggbb attendue');
      }
      couleurs.accent = json.couleurs.accent;
    }
  }

  const textes = {};
  if (json.textes !== undefined) {
    if (!objet(json.textes)) throw invalide('textes', 'objet attendu');
    for (const cle of CLES_TEXTES) {
      if (Object.hasOwn(json.textes, cle)) textes[cle] = texte(json.textes[cle], `textes.${cle}`);
    }
  }

  if (!Array.isArray(json.modeles) || json.modeles.length === 0) throw invalide('modeles', 'au moins un modèle attendu');
  const ids = new Set();
  const modeles = json.modeles.map((m, i) => {
    const p = `modeles[${i}]`;
    if (!objet(m)) throw invalide(p, 'objet attendu');
    if (typeof m.id !== 'string' || !ID.test(m.id)) throw invalide(`${p}.id`, 'id attendu (a-z, 0-9, tiret)');
    if (ids.has(m.id)) throw invalide(`${p}.id`, 'id en double');
    ids.add(m.id);
    const sortie = {
      id: m.id,
      nom: texte(m.nom, `${p}.nom`),
      glb: url(m.glb, `${p}.glb`, ctx),
      vignette: url(m.vignette, `${p}.vignette`, ctx),
    };
    if (m.usdz != null) sortie.usdz = url(m.usdz, `${p}.usdz`, ctx);
    return sortie;
  });

  let modeleParDefaut = modeles[0].id;
  if (json.modeleParDefaut !== undefined) {
    if (typeof json.modeleParDefaut !== 'string' || !ids.has(json.modeleParDefaut)) {
      throw invalide('modeleParDefaut', 'id inconnu');
    }
    modeleParDefaut = json.modeleParDefaut;
  }

  return { version: 1, pisciniste, couleurs, textes, modeles, modeleParDefaut };
}

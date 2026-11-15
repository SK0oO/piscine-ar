import { describe, it, expect } from 'vitest';
import { parseConfig } from '../../src/config/config.js';
import { PiscineArError } from '../../src/core/erreurs.js';

const ORIGINE = 'https://piscinier.example.invalid';
const OPTS = { configUrl: `${ORIGINE}/config/piscinier.json`, originesAutorisees: [ORIGINE] };

const valide = () => ({
  version: 1,
  pisciniste: { nom: 'Piscines Test', logo: '../logo.png' },
  couleurs: { accent: '#1e90ff' },
  textes: { inconnue_xyz: 'ignoré' },
  modeles: [
    { id: 'rect-8x4', nom: 'Rectangulaire', glb: '../models/a.glb', usdz: '../models/a.usdz', vignette: '../models/a.png' },
    { id: 'ovale-5x3', nom: 'Ovale', glb: '../models/b.glb', vignette: '../models/b.png' },
  ],
});

const erreur = (json, opts = OPTS) => {
  try { parseConfig(json, opts); } catch (e) { return e; }
  return null;
};
const refuse = (json, champ) => {
  const e = erreur(json);
  expect(e).toBeInstanceOf(PiscineArError);
  expect(e.code).toBe('config-invalide');
  expect(e.message).toContain(champ);
};

describe('parseConfig', () => {
  it('la config valide est normalisée (URL résolues, défaut = premier modèle)', () => {
    const c = parseConfig(valide(), OPTS);
    expect(c.version).toBe(1);
    expect(c.pisciniste.nom).toBe('Piscines Test');
    expect(c.pisciniste.logo).toBe(`${ORIGINE}/logo.png`);
    expect(c.couleurs.accent).toBe('#1e90ff');
    expect(c.modeles).toHaveLength(2);
    expect(c.modeles[0].glb).toBe(`${ORIGINE}/models/a.glb`);
    expect(c.modeles[0].usdz).toBe(`${ORIGINE}/models/a.usdz`);
    expect(c.modeles[0].vignette).toBe(`${ORIGINE}/models/a.png`);
    expect(c.modeleParDefaut).toBe('rect-8x4');
  });

  it('respecte un modeleParDefaut connu', () => {
    const j = valide();
    j.modeleParDefaut = 'ovale-5x3';
    expect(parseConfig(j, OPTS).modeleParDefaut).toBe('ovale-5x3');
  });

  it('un GLB d\'une autre origine est refusé (message avec le champ)', () => {
    const j = valide();
    j.modeles[1].glb = 'https://autre.example.invalid/b.glb';
    refuse(j, 'glb');
  });

  it('un id en double est refusé', () => {
    const j = valide();
    j.modeles[1].id = 'rect-8x4';
    refuse(j, 'id');
  });

  it('un id hors de /^[a-z0-9-]+$/ est refusé', () => {
    const j = valide();
    j.modeles[0].id = 'Rect 8x4';
    refuse(j, 'id');
  });

  it('modeles vide est refusé', () => {
    const j = valide();
    j.modeles = [];
    refuse(j, 'modeles');
  });

  it('un modeleParDefaut inconnu est refusé', () => {
    const j = valide();
    j.modeleParDefaut = 'nexiste-pas';
    refuse(j, 'modeleParDefaut');
  });

  it('version différente de 1 est refusée (0 et 2)', () => {
    for (const v of [0, 2]) {
      const j = valide();
      j.version = v;
      refuse(j, 'version');
    }
  });

  it('les clés de texte inconnues sont ignorées', () => {
    const c = parseConfig(valide(), OPTS);
    expect(Object.keys(c.textes ?? {})).not.toContain('inconnue_xyz');
  });

  it('une accent invalide est refusée', () => {
    for (const a of ['bleu', '#12345', '#gggggg', 'red']) {
      const j = valide();
      j.couleurs.accent = a;
      refuse(j, 'accent');
    }
  });
  // Lot V5 (plan §13.2) : palette complète et forme facultative.
  it.each(['water', 'deep', 'sand', 'onAccent'])('couleurs.%s est acceptée en #rrggbb', (cle) => {
    const j = valide();
    j.couleurs[cle] = '#19b5c8';
    expect(parseConfig(j, OPTS).couleurs[cle]).toBe('#19b5c8');
  });

  it.each(['water', 'deep', 'sand', 'onAccent'])('couleurs.%s est refusée si ce n\'est pas #rrggbb', (cle) => {
    for (const v of ['bleu', '#12345', '#gggggg', 'red', 42]) {
      const j = valide();
      j.couleurs[cle] = v;
      refuse(j, cle);
    }
  });

  it.each(['rectangle', 'ovale', 'haricot'])('modeles[i].forme « %s » est acceptée', (forme) => {
    const j = valide();
    j.modeles[0].forme = forme;
    expect(parseConfig(j, OPTS).modeles[0].forme).toBe(forme);
  });

  it('modeles[i].forme est facultative', () => {
    expect(() => parseConfig(valide(), OPTS)).not.toThrow();
  });

  it('modeles[i].forme inconnue est refusée', () => {
    for (const v of ['carre', 'Rectangle', '', 3]) {
      const j = valide();
      j.modeles[1].forme = v;
      refuse(j, 'forme');
    }
  });
});

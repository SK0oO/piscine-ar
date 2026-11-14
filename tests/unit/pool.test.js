import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import * as THREE from 'three';

const PARAMS_DIR = resolve(import.meta.dirname, '../../models/params');
const allParams = readdirSync(PARAMS_DIR)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(resolve(PARAMS_DIR, f), 'utf8')));

// Import dynamique : si le module manque, chaque test échoue (au lieu d'un fichier non compté).
const load = () => import('../../models/generate/pool.js');

function triangles(group) {
  let n = 0;
  group.traverse((o) => {
    if (o.isMesh) {
      const g = o.geometry;
      n += (g.index ? g.index.count : g.attributes.position.count) / 3;
    }
  });
  return n;
}
const box = (group) => {
  group.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(group);
};

describe('buildPool : les 3 formes', () => {
  it('il y a 3 fichiers de paramètres (rectangle, haricot, ovale)', () => {
    expect(allParams.map((p) => p.forme).sort()).toEqual(['haricot', 'ovale', 'rectangle']);
  });

  for (const params of allParams) {
    describe(params.id, () => {
      it('produit un THREE.Group', async () => {
        const { buildPool } = await load();
        const g = buildPool(params, { eau: params.eauParDefaut });
        expect(g).toBeInstanceOf(THREE.Group);
      });

      it('longueur X et largeur Z = dimensions + 2 x margelle (1 cm près)', async () => {
        const { buildPool } = await load();
        const size = box(buildPool(params, { eau: params.eauParDefaut })).getSize(new THREE.Vector3());
        expect(Math.abs(size.x - (params.longueur + 2 * params.margelle.largeur))).toBeLessThanOrEqual(0.01);
        expect(Math.abs(size.z - (params.largeur + 2 * params.margelle.largeur))).toBeLessThanOrEqual(0.01);
      });

      it('Y max = 0 (1 cm près) et Y min = -profondeur (2 cm près)', async () => {
        const { buildPool } = await load();
        const b = box(buildPool(params, { eau: params.eauParDefaut }));
        expect(Math.abs(b.max.y)).toBeLessThanOrEqual(0.01);
        expect(Math.abs(b.min.y + params.profondeur)).toBeLessThanOrEqual(0.02);
      });

      it('moins de 20 000 triangles', async () => {
        const { buildPool } = await load();
        const n = triangles(buildPool(params, { eau: params.eauParDefaut }));
        expect(n).toBeGreaterThan(0);
        expect(n).toBeLessThan(20000);
      });

      it('maillages nommés margelle, bassin, eau (+ escalier / plage si prévu)', async () => {
        const { buildPool } = await load();
        const g = buildPool(params, { eau: params.eauParDefaut });
        for (const nom of ['margelle', 'bassin', 'eau']) {
          expect(g.getObjectByName(nom), nom).toBeTruthy();
        }
        if (params.escalier) expect(g.getObjectByName('escalier')).toBeTruthy();
        if (params.plageImmergee) expect(g.getObjectByName('plage')).toBeTruthy();
      });

      it('chaque couleur d\'eau donne une couleur différente sur le maillage eau', async () => {
        const { buildPool } = await load();
        const couleurs = Object.keys(params.eaux).map((eau) =>
          buildPool(params, { eau }).getObjectByName('eau').material.color.getHexString(),
        );
        expect(couleurs).toHaveLength(3);
        expect(new Set(couleurs).size).toBe(3);
      });

      it('mode dalle : maillages margelle, eau, fond ; ni bassin ni escalier ; Y max = 0 et Y min = -0,05 (1 cm près)', async () => {
        const { buildPool } = await load();
        const g = buildPool(params, { eau: params.eauParDefaut, dalle: true });
        for (const nom of ['margelle', 'eau', 'fond']) expect(g.getObjectByName(nom), nom).toBeTruthy();
        expect(g.getObjectByName('bassin')).toBeFalsy();
        expect(g.getObjectByName('escalier')).toBeFalsy();
        const b = box(g);
        expect(Math.abs(b.max.y)).toBeLessThanOrEqual(0.01);
        expect(Math.abs(b.min.y + 0.05)).toBeLessThanOrEqual(0.01);
      });

      it('un nom d\'eau inconnu lève une erreur', async () => {
        const { buildPool } = await load();
        expect(() => buildPool(params, { eau: 'rose-bonbon' })).toThrow();
      });
    });
  }
});

// ---- Lot M1 : UV en mètres, parois vers l'intérieur, plus de DoubleSide (plan §11.3) ----
const rect = allParams.find((p) => p.forme === 'rectangle');

function etendue(geo, nom) {
  const a = geo.attributes[nom];
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < a.count; i++) { const v = a.getX(i); min = Math.min(min, v); max = Math.max(max, v); }
  let minV = Infinity, maxV = -Infinity;
  for (let i = 0; i < a.count; i++) { const v = a.getY(i); minV = Math.min(minV, v); maxV = Math.max(maxV, v); }
  return { minU: min, maxU: max, minV, maxV };
}
// Sommets de paroi : normale presque horizontale.
const sommetsParoi = (geo) => {
  const n = geo.attributes.normal;
  const out = [];
  for (let i = 0; i < n.count; i++) if (Math.abs(n.getY(i)) < 0.5) out.push(i);
  return out;
};

describe('buildPool : matières (M1)', () => {
  for (const params of allParams) {
    describe(`${params.id} (M1)`, () => {
      it('tous les maillages ont un attribut uv (2 composantes, une par sommet)', async () => {
        const { buildPool } = await load();
        const g = buildPool(params, { eau: params.eauParDefaut });
        let n = 0;
        g.traverse((o) => {
          if (!o.isMesh) return;
          n++;
          const uv = o.geometry.attributes.uv;
          expect(uv, o.name).toBeTruthy();
          expect(uv.itemSize, o.name).toBe(2);
          expect(uv.count, o.name).toBe(o.geometry.attributes.position.count);
        });
        expect(n).toBeGreaterThan(3);
      });

      it('mode dalle : tous les maillages ont aussi un attribut uv', async () => {
        const { buildPool } = await load();
        const g = buildPool(params, { eau: params.eauParDefaut, dalle: true });
        g.traverse((o) => { if (o.isMesh) expect(o.geometry.attributes.uv, o.name).toBeTruthy(); });
      });

      it('aucun matériau en DoubleSide, aucune couleur de sommet', async () => {
        const { buildPool } = await load();
        const g = buildPool(params, { eau: params.eauParDefaut });
        g.traverse((o) => {
          if (!o.isMesh) return;
          expect(o.material.side, o.name).not.toBe(THREE.DoubleSide);
          expect(o.material.vertexColors, o.name).toBe(false);
          expect(o.geometry.attributes.color, o.name).toBeUndefined();
        });
      });

      it('les matériaux portent une normalMap (sauf aucun maillage sans matière)', async () => {
        const { buildPool } = await load();
        const g = buildPool(params, { eau: params.eauParDefaut });
        for (const nom of ['margelle', 'bassin', 'eau']) {
          expect(g.getObjectByName(nom).material.normalMap, nom).toBeTruthy();
        }
      });

      it('bassin : u va de 0 au périmètre du contour (5 %), v de −profondeur à −épaisseur (5 % de la profondeur) sur les parois', async () => {
        const { buildPool } = await load();
        const geo = buildPool(params, { eau: params.eauParDefaut }).getObjectByName('bassin').geometry;
        const uv = geo.attributes.uv;
        const pos = geo.attributes.position;
        const ep = params.margelle.epaisseur;
        // Périmètre mesuré sur l'anneau haut des parois (y = -épaisseur), dans l'ordre des sommets.
        const anneau = [];
        for (let i = 0; i < pos.count; i++) if (Math.abs(pos.getY(i) + ep) < 1e-4) anneau.push(i);
        let perimetre = 0;
        for (let i = 0; i < anneau.length; i++) {
          const a = anneau[i], b = anneau[(i + 1) % anneau.length];
          perimetre += Math.hypot(pos.getX(a) - pos.getX(b), pos.getZ(a) - pos.getZ(b));
        }
        const parois = sommetsParoi(geo);
        const us = parois.map((i) => uv.getX(i));
        const vs = parois.map((i) => uv.getY(i));
        expect(Math.min(...us)).toBeCloseTo(0, 1);
        expect(Math.abs(Math.max(...us) - perimetre) / perimetre).toBeLessThanOrEqual(0.05);
        expect(Math.abs(Math.min(...vs) + params.profondeur)).toBeLessThanOrEqual(0.05 * params.profondeur);
        expect(Math.abs(Math.max(...vs) + ep)).toBeLessThanOrEqual(0.05 * params.profondeur);
      });
    });
  }

  it('rectangle : étendue des UV de la margelle ≈ 8,6 × 4,6 m (5 % près)', async () => {
    const { buildPool } = await load();
    const geo = buildPool(rect, { eau: rect.eauParDefaut }).getObjectByName('margelle').geometry;
    const e = etendue(geo, 'uv');
    expect(Math.abs((e.maxU - e.minU) - 8.6) / 8.6).toBeLessThanOrEqual(0.05);
    expect(Math.abs((e.maxV - e.minV) - 4.6) / 4.6).toBeLessThanOrEqual(0.05);
  });

  it('rectangle : u du bassin va de 0 à ≈ 23,3 m (périmètre analytique 2(L+l) − 8r + 2πr, 5 % près)', async () => {
    const { buildPool } = await load();
    const geo = buildPool(rect, { eau: rect.eauParDefaut }).getObjectByName('bassin').geometry;
    const attendu = 2 * (rect.longueur + rect.largeur) - 8 * rect.rayonAngle + 2 * Math.PI * rect.rayonAngle;
    const us = sommetsParoi(geo).map((i) => geo.attributes.uv.getX(i));
    expect(Math.abs(Math.max(...us) - attendu) / attendu).toBeLessThanOrEqual(0.05);
  });

  // Rectangle et ovale (convexes) : le centre de la boîte est dans le bassin. Le haricot (concave) n'est pas testé ainsi.
  for (const forme of ['rectangle', 'ovale']) {
    it(`${forme} : normales des parois du bassin vers l'intérieur (> 95 % des sommets)`, async () => {
      const { buildPool } = await load();
      const p = allParams.find((x) => x.forme === forme);
      const geo = buildPool(p, { eau: p.eauParDefaut }).getObjectByName('bassin').geometry;
      geo.computeBoundingBox();
      const c = geo.boundingBox.getCenter(new THREE.Vector3());
      const pos = geo.attributes.position, nor = geo.attributes.normal;
      const parois = sommetsParoi(geo);
      expect(parois.length).toBeGreaterThan(10);
      let bons = 0;
      for (const i of parois) {
        const dot = nor.getX(i) * (c.x - pos.getX(i)) + nor.getZ(i) * (c.z - pos.getZ(i));
        if (dot > 0) bons++;
      }
      expect(bons / parois.length).toBeGreaterThan(0.95);
    });
  }

  it('escalier : UV en mètres, l\'étendue en u de chaque marche ≈ sa plus grande dimension (5 % près)', async () => {
    const { buildPool } = await load();
    const esc = buildPool(rect, { eau: rect.eauParDefaut }).getObjectByName('escalier');
    expect(esc.children.length).toBeGreaterThan(0);
    for (const marche of esc.children) {
      marche.geometry.computeBoundingBox();
      const s = marche.geometry.boundingBox.getSize(new THREE.Vector3());
      const attendu = Math.max(s.x, s.y, s.z);
      const e = etendue(marche.geometry, 'uv');
      expect(Math.abs((e.maxU - e.minU) - attendu) / attendu, marche.name).toBeLessThanOrEqual(0.05);
    }
  });
});

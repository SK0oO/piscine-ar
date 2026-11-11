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

      it('un nom d\'eau inconnu lève une erreur', async () => {
        const { buildPool } = await load();
        expect(() => buildPool(params, { eau: 'rose-bonbon' })).toThrow();
      });
    });
  }
});

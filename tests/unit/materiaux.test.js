import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const params = JSON.parse(readFileSync(resolve(import.meta.dirname, '../../models/params/rectangulaire-8x4.json'), 'utf8'));
const EAU = params.eaux['bleu-profond']; // '#1f6f9f'
// creerMateriaux(params, couleurEau) : couleurEau = chaîne hex du JSON.
const load = async () => (await import('../../models/generate/materiaux.js')).creerMateriaux(params, EAU);
const SURFACES = ['margelle', 'mosaique', 'mosaiqueClaire', 'fond'];

describe('creerMateriaux', () => {
  it('renvoie margelle, mosaique, mosaiqueClaire, fond, eau (MeshStandardMaterial)', async () => {
    const m = await load();
    for (const k of [...SURFACES, 'eau']) expect(m[k], k).toBeInstanceOf(THREE.MeshStandardMaterial);
  });

  for (const k of SURFACES) {
    it(`${k} : map, normalMap, roughnessMap présentes (DataTexture, répétition active)`, async () => {
      const m = (await load())[k];
      for (const t of ['map', 'normalMap', 'roughnessMap']) {
        expect(m[t], t).toBeInstanceOf(THREE.DataTexture);
        expect(m[t].wrapS, t).toBe(THREE.RepeatWrapping);
        expect(m[t].wrapT, t).toBe(THREE.RepeatWrapping);
      }
    });

    it(`${k} : map en SRGBColorSpace, normalMap et roughnessMap en NoColorSpace`, async () => {
      const m = (await load())[k];
      expect(m.map.colorSpace).toBe(THREE.SRGBColorSpace);
      expect(m.normalMap.colorSpace).toBe(THREE.NoColorSpace);
      expect(m.roughnessMap.colorSpace).toBe(THREE.NoColorSpace);
    });

    it(`${k} : map.userData.mimeType = image/jpeg`, async () => {
      expect((await load())[k].map.userData.mimeType).toBe('image/jpeg');
    });
  }

  it('l\'eau : normalMap seulement (pas de map), transparente, opacity ∈ [0,55 ; 0,75], roughness ≤ 0,15, metalness 0', async () => {
    const e = (await load()).eau;
    expect(e.normalMap).toBeInstanceOf(THREE.DataTexture);
    expect(e.map).toBeNull();
    expect(e.transparent).toBe(true);
    expect(e.opacity).toBeGreaterThanOrEqual(0.55);
    expect(e.opacity).toBeLessThanOrEqual(0.75);
    expect(e.roughness).toBeLessThanOrEqual(0.15);
    expect(e.metalness).toBe(0);
    expect(e.normalMap.colorSpace).toBe(THREE.NoColorSpace);
    expect(e.normalMap.wrapS).toBe(THREE.RepeatWrapping);
  });

  it('repeat = 1 / taille physique : pierre 1 m → 1, mosaïque 0,5 m → 2, eau 2 m → 0,5', async () => {
    const m = await load();
    for (const t of ['map', 'normalMap', 'roughnessMap']) {
      expect(m.margelle[t].repeat.toArray(), `margelle ${t}`).toEqual([1, 1]);
      for (const k of ['mosaique', 'mosaiqueClaire', 'fond']) expect(m[k][t].repeat.toArray(), `${k} ${t}`).toEqual([2, 2]);
    }
    expect(m.eau.normalMap.repeat.toArray()).toEqual([0.5, 0.5]);
  });

  it('aucun matériau en DoubleSide', async () => {
    const m = await load();
    for (const [k, mat] of Object.entries(m)) expect(mat.side, k).not.toBe(THREE.DoubleSide);
  });

  it('mosaique.color = la couleur d\'eau passée', async () => {
    const m = await load();
    expect(m.mosaique.color.getHexString()).toBe(new THREE.Color(EAU).getHexString());
  });

  it('une autre couleur d\'eau change mosaique.color et eau.color', async () => {
    const { creerMateriaux } = await import('../../models/generate/materiaux.js');
    const autre = creerMateriaux(params, params.eaux['gris-sable']);
    expect(autre.mosaique.color.getHexString()).toBe(new THREE.Color(params.eaux['gris-sable']).getHexString());
    expect(autre.eau.color.getHexString()).toBe(new THREE.Color(params.eaux['gris-sable']).getHexString());
  });

  it('textures mises en cache par matière : deux appels partagent la même texture', async () => {
    const { creerMateriaux } = await import('../../models/generate/materiaux.js');
    const a = creerMateriaux(params, EAU);
    const b = creerMateriaux(params, params.eaux['gris-sable']);
    expect(b.margelle.map).toBe(a.margelle.map);
    expect(b.mosaique.normalMap).toBe(a.mosaique.normalMap);
    expect(b.eau.normalMap).toBe(a.eau.normalMap);
  });
});

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createModelSwitcher } from '../../src/core/models.js';
import { PiscineArError } from '../../src/core/erreurs.js';
import { creerChargeurFactice, fabriquerModele, estLibere } from './fakes/chargeur.js';

// API supposée : selectionner(modele) appelle charger(modele.glb) ; courant() renvoie { id, dimensions }.
const A = { id: 'rect-8x4', nom: 'Rectangulaire', glb: 'https://exemple.invalid/a.glb' };
const B = { id: 'ovale-5x3', nom: 'Ovale', glb: 'https://exemple.invalid/b.glb' };

const setup = () => {
  const pivot = new THREE.Group();
  const ch = creerChargeurFactice();
  const sw = createModelSwitcher({ pivot, charger: ch.charger });
  return { pivot, ch, sw };
};
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('createModelSwitcher', () => {
  it('attache le modèle chargé comme enfant du pivot et donne ses dimensions (nœud eau : 8 × 4)', async () => {
    const { pivot, ch, sw } = setup();
    const p = sw.selectionner(A);
    const racineA = fabriquerModele({ longueur: 8, largeur: 4 });
    ch.dernier(A.glb).resolve(racineA);
    const res = await p;
    expect(res.id).toBe('rect-8x4');
    expect(res.dimensions.longueur).toBeCloseTo(8, 5);
    expect(res.dimensions.largeur).toBeCloseTo(4, 5);
    expect(pivot.children).toEqual([racineA]);
    expect(sw.courant().id).toBe('rect-8x4');
  });

  it('la pose du pivot est identique avant et après le changement', async () => {
    const { pivot, ch, sw } = setup();
    const pa = sw.selectionner(A);
    ch.dernier(A.glb).resolve(fabriquerModele());
    await pa;
    pivot.position.set(1.5, 0, -7);
    pivot.rotation.y = 0.9;
    pivot.scale.setScalar(1.3);
    const avant = { p: pivot.position.toArray(), r: pivot.rotation.y, s: pivot.scale.toArray() };
    const pb = sw.selectionner(B);
    ch.dernier(B.glb).resolve(fabriquerModele({ longueur: 5, largeur: 3 }));
    await pb;
    expect({ p: pivot.position.toArray(), r: pivot.rotation.y, s: pivot.scale.toArray() }).toEqual(avant);
    expect(pivot.children).toHaveLength(1);
  });

  it('l\'ancien modèle est libéré (dispose)', async () => {
    const { ch, sw } = setup();
    const racineA = fabriquerModele();
    const pa = sw.selectionner(A);
    ch.dernier(A.glb).resolve(racineA);
    await pa;
    const pb = sw.selectionner(B);
    ch.dernier(B.glb).resolve(fabriquerModele({ longueur: 5, largeur: 3 }));
    await pb;
    expect(estLibere(racineA)).toBe(true);
  });

  it('même id que le courant : charger n\'est pas rappelé', async () => {
    const { ch, sw } = setup();
    const pa = sw.selectionner(A);
    ch.dernier(A.glb).resolve(fabriquerModele());
    await pa;
    expect(ch.appels).toHaveLength(1);
    await sw.selectionner({ ...A });
    expect(ch.appels).toHaveLength(1);
  });

  it('A puis B, A plus lent : B est attaché, A est libéré et renvoie null', async () => {
    const { pivot, ch, sw } = setup();
    const pA = sw.selectionner(A);
    const pB = sw.selectionner(B);
    const racineB = fabriquerModele({ longueur: 5, largeur: 3 });
    const racineA = fabriquerModele({ longueur: 8, largeur: 4 });
    ch.dernier(B.glb).resolve(racineB);
    const resB = await pB;
    ch.dernier(A.glb).resolve(racineA); // A arrive en retard
    const resA = await pA;
    await tick();
    expect(resA).toBeNull();
    expect(resB.id).toBe('ovale-5x3');
    expect(pivot.children).toEqual([racineB]);
    expect(estLibere(racineA)).toBe(true);
    expect(estLibere(racineB)).toBe(false);
    expect(sw.courant().id).toBe('ovale-5x3');
  });

  it('en cas d\'échec : erreur modele-introuvable et le modèle précédent reste', async () => {
    const { pivot, ch, sw } = setup();
    const racineA = fabriquerModele();
    const pa = sw.selectionner(A);
    ch.dernier(A.glb).resolve(racineA);
    await pa;
    const pb = sw.selectionner(B);
    ch.dernier(B.glb).reject(new Error('404'));
    const err = await pb.then(() => null, (e) => e);
    expect(err).toBeInstanceOf(PiscineArError);
    expect(err.code).toBe('modele-introuvable');
    expect(pivot.children).toEqual([racineA]);
    expect(estLibere(racineA)).toBe(false);
    expect(sw.courant().id).toBe('rect-8x4');
  });

  it('sans nœud eau, les dimensions viennent de la racine', async () => {
    const { ch, sw } = setup();
    const racine = new THREE.Group();
    racine.add(new THREE.Mesh(new THREE.BoxGeometry(6, 1, 2), new THREE.MeshBasicMaterial()));
    const p = sw.selectionner(A);
    ch.dernier(A.glb).resolve(racine);
    const res = await p;
    expect(res.dimensions.longueur).toBeCloseTo(6, 5);
    expect(res.dimensions.largeur).toBeCloseTo(2, 5);
  });
});

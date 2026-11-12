import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { buildOccluder } from '../../src/core/occluder.js';
import { PiscineArError } from '../../src/core/erreurs.js';
import { fabriquerRacine, CONTOUR_C } from './fakes/xr.js';

// API supposée (plan §1 « Occludeur ») : buildOccluder(racine) → { occludeur, ombre } (deux Mesh),
// plan de 40 × 40 m à y = −0,001, percé du contour extérieur de la face haute du maillage `margelle`.
// Margelle de test : 9 × 5 m, bande de 0,5 m autour d'un bassin de 8 × 4 m, face haute à y = 0.
// Les rayons descendent à la verticale depuis y = 5. On force side = DoubleSide : on teste la géométrie, pas le sens des faces.
const touche = (mesh, x, z) => {
  mesh.updateMatrixWorld(true);
  const m = mesh.material;
  const cote = m.side;
  m.side = THREE.DoubleSide;
  const rc = new THREE.Raycaster(new THREE.Vector3(x, 5, z), new THREE.Vector3(0, -1, 0));
  const res = rc.intersectObject(mesh, false);
  m.side = cote;
  return res;
};

describe('buildOccluder', () => {
  const { occludeur, ombre } = buildOccluder(fabriquerRacine());

  it('rayon vers le bas au centre du bassin : rien ne le coupe', () => {
    expect(touche(occludeur, 0, 0)).toHaveLength(0);
  });

  it('rayon à 15 m de la piscine : touché, à y ≈ −0,001', () => {
    const res = touche(occludeur, 15, 0);
    expect(res).toHaveLength(1);
    expect(res[0].point.y).toBeCloseTo(-0.001, 4);
  });

  it('juste hors de la margelle (1 cm) : touché', () => {
    expect(touche(occludeur, 4.51, 0)).toHaveLength(1);
    expect(touche(occludeur, 0, 2.51)).toHaveLength(1);
  });

  it('sur la margelle (1 cm en dedans, et au milieu de la bande) : pas touché', () => {
    expect(touche(occludeur, 4.49, 0)).toHaveLength(0);
    expect(touche(occludeur, 4.25, 0)).toHaveLength(0);
    expect(touche(occludeur, 0, 2.25)).toHaveLength(0);
  });

  it('le plan fait 40 × 40 m : touché à 19,99 m, pas à 20,01 m', () => {
    expect(touche(occludeur, 19.99, 0)).toHaveLength(1);
    expect(touche(occludeur, 0, -19.99)).toHaveLength(1);
    expect(touche(occludeur, 20.01, 0)).toHaveLength(0);
    expect(touche(occludeur, 0, 20.01)).toHaveLength(0);
  });

  it('margelle en C : l\'encoche est couverte (pas d\'enveloppe convexe), le corps ne l\'est pas', () => {
    const c = buildOccluder(fabriquerRacine(CONTOUR_C, {}));
    expect(touche(c.occludeur, 3, 0)).toHaveLength(1); // au cœur de l'encoche, dans l'enveloppe convexe
    expect(touche(c.occludeur, 3, 2)).toHaveLength(0); // branche haute de la margelle
    expect(touche(c.occludeur, -2, 0)).toHaveLength(0); // dos du C
    expect(touche(c.occludeur, 5.5, 0)).toHaveLength(1); // hors du C, à côté de l'encoche
  });

  it('occludeur : colorWrite false, depthWrite true, renderOrder −1', () => {
    expect(occludeur.material.colorWrite).toBe(false);
    expect(occludeur.material.depthWrite).toBe(true);
    expect(occludeur.renderOrder).toBe(-1);
  });

  it('ombre : ShadowMaterial d\'opacité 0,25, même découpe que l\'occludeur', () => {
    expect(ombre.material).toBeInstanceOf(THREE.ShadowMaterial);
    expect(ombre.material.opacity).toBeCloseTo(0.25, 5);
    expect(touche(ombre, 0, 0)).toHaveLength(0);
    expect(touche(ombre, 4.25, 0)).toHaveLength(0);
    expect(touche(ombre, 15, 0)).toHaveLength(1);
  });

  it('sans margelle → PiscineArError modele-invalide', () => {
    const racine = new THREE.Group();
    racine.add(new THREE.Mesh(new THREE.BoxGeometry(8, 0.1, 4), new THREE.MeshBasicMaterial()));
    let erreur;
    try { buildOccluder(racine); } catch (e) { erreur = e; }
    expect(erreur).toBeInstanceOf(PiscineArError);
    expect(erreur.code).toBe('modele-invalide');
  });
});

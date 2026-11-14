import { test, expect } from '@playwright/test';
import { installerOrientation } from './fakes/orientation.js';
import { installerMedia } from './fakes/media.js';
import { bouton, attendre, evenements } from './helpers.js';

// Page dédiée : même composant que PAGE, plus un observateur du renderer (voir pages/matieres.html).
const PAGE_MATIERES = '/tests/browser/pages/matieres.html';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(installerMedia, {});
  await page.addInitScript(installerOrientation, {});
  await page.goto(PAGE_MATIERES);
  await page.waitForFunction(() => window.__chargement !== undefined, null, { timeout: 10_000 });
  const etat = await page.evaluate(() => window.__chargement);
  if (etat !== 'ok') throw new Error(`chargement de /src/index.js impossible (${etat})`);
  await bouton(page, 'Activer la caméra').click();
  await attendre(page, 'ready');
  await page.waitForFunction(() => window.__rendu !== undefined, null, { timeout: 10_000 });
});

test('le composant charge le vrai GLB texturé : ready, aucune erreur, eau avec normalMap', async ({ page }) => {
  expect(await evenements(page, 'error')).toHaveLength(0);
  const a = await page.evaluate(() => {
    const eau = window.__rendu.scene.getObjectByName('eau');
    const marg = window.__rendu.scene.getObjectByName('margelle');
    return { eau: !!eau?.material?.normalMap, margelle: !!marg?.material?.map && !!marg?.material?.normalMap };
  });
  expect(a.eau, 'eau.material.normalMap').toBe(true);
  expect(a.margelle, 'margelle.material.map et normalMap').toBe(true);
});

test('renderer.toneMapping = ACESFilmic', async ({ page }) => {
  const ok = await page.evaluate(() => window.__rendu.renderer.toneMapping === window.__THREE_ACES);
  expect(ok).toBe(true);
});

test('scene.environment non nul en mode caméra', async ({ page }) => {
  const [evt] = await evenements(page, 'ready');
  expect(evt.mode).toBe('camera-gyro');
  expect(await page.evaluate(() => window.__rendu.scene.environment !== null)).toBe(true);
});

test('l\'offset de la normalMap de l\'eau change entre deux images', async ({ page }) => {
  const lire = () => page.evaluate(() => {
    const t = window.__rendu.scene.getObjectByName('eau')?.material?.normalMap;
    return t ? [t.offset.x, t.offset.y] : null;
  });
  const avant = await lire();
  expect(avant, 'normalMap de l\'eau présente').not.toBeNull();
  await page.waitForTimeout(600);
  const apres = await lire();
  expect(apres).not.toBeNull();
  expect(apres[0] !== avant[0] && apres[1] !== avant[1]).toBe(true);
});

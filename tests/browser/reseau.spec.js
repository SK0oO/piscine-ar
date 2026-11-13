import { test, expect } from '@playwright/test';
import { demarrer, bouton, regarderLeSol, pointeur, centre, vignette, attendre, IDS } from './helpers.js';

test('session complète : uniquement des GET de même origine, aucun cookie posé', async ({ page, baseURL }) => {
  const requetes = [];
  page.on('request', (r) => requetes.push({ url: r.url(), methode: r.method(), corps: r.postData() }));

  await demarrer(page);
  await regarderLeSol(page);
  const c = await centre(page);
  await pointeur(page, 'pointerdown', 1, c.x, c.y + 60);
  await pointeur(page, 'pointermove', 1, c.x + 30, c.y + 100);
  await pointeur(page, 'pointerup', 1, c.x + 30, c.y + 100);
  await vignette(page, IDS[1]).click();
  await attendre(page, 'model-changed');
  await bouton(page, 'Photo').click();
  await attendre(page, 'photo');

  const reseau = requetes.filter((r) => /^https?:/.test(r.url));
  expect(reseau.length).toBeGreaterThan(3);
  expect(reseau.filter((r) => r.methode !== 'GET')).toEqual([]);
  expect(reseau.filter((r) => r.corps)).toEqual([]);
  const origine = new URL(baseURL).origin;
  expect(reseau.filter((r) => new URL(r.url).origin !== origine).map((r) => r.url)).toEqual([]);
  expect(await page.context().cookies()).toEqual([]);
});

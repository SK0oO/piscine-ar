import { test, expect } from '@playwright/test';
import { demarrer, regarderLeSol, pointeur, centre, pose, vignette, hote, evenements, attendre, IDS } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await demarrer(page);
});

test('3 vignettes', async ({ page }) => {
  await expect(hote(page).locator('button[data-modele]')).toHaveCount(3);
});

test('après un glisser, la vignette 2 → model-changed haricot-7x3-5, même pose, un seul getUserMedia', async ({ page }) => {
  await regarderLeSol(page);
  const c = await centre(page);
  await pointeur(page, 'pointerdown', 1, c.x, c.y + 60);
  await pointeur(page, 'pointermove', 1, c.x + 40, c.y + 120);
  await pointeur(page, 'pointerup', 1, c.x + 40, c.y + 120);
  const avant = await pose(page);
  await vignette(page, IDS[1]).click();
  await attendre(page, 'model-changed');
  const [ev] = await evenements(page, 'model-changed');
  expect(ev.modele).toBe('haricot-7x3-5');
  expect(ev.pose).toEqual(avant);
  expect(await pose(page)).toEqual(avant);
  expect(await page.evaluate(() => window.__media.appels)).toBe(1);
});

test('appuis rapides sur la vignette 2 puis 3 → le dernier événement est ovale-5x3', async ({ page }) => {
  await vignette(page, IDS[1]).click();
  await vignette(page, IDS[2]).click();
  await expect.poll(async () => (await evenements(page, 'model-changed')).at(-1)?.modele, { timeout: 10_000 }).toBe('ovale-5x3');
});

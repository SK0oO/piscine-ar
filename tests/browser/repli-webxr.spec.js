import { test, expect } from '@playwright/test';
import { ouvrir, bouton, attendre, evenements } from './helpers.js';

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== 'android', 'scénario Android : RA supportée puis session refusée');
});

test('RA supportée mais requestSession rejeté → erreur webxr-echec, puis ready en camera-gyro', async ({ page }) => {
  await ouvrir(page, { xr: true });
  await bouton(page, 'Activer la caméra').click();
  await attendre(page, 'error');
  await attendre(page, 'ready');
  expect((await evenements(page, 'error'))[0].code).toBe('webxr-echec');
  const prets = await evenements(page, 'ready');
  expect(prets[0].mode).toBe('camera-gyro');
  expect(await page.evaluate(() => window.__xr.demandes)).toEqual(['immersive-ar']);
});

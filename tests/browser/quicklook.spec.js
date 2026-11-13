import { test, expect } from '@playwright/test';
import { demarrer, bouton, hote, vignette, attendre, evenements, IDS } from './helpers.js';

// Quick Look (lot C). Sous Chromium, relList.supports('ar') est faux : on le force à vrai AVANT le chargement.
// (relList est un accesseur de HTMLAnchorElement.prototype ; `supports` vit sur DOMTokenList.prototype, c'est lui qu'on remplace.)
// Noms fixés : lien = a[rel~="ar"] dans le Shadow DOM, texte visible « Fixer au sol », une seule <img> dedans.
const FRAGMENT = '#allowsContentScaling=0&callToAction=Revenir%20au%20site&checkoutTitle=';
const lien = (page) => hote(page).locator('a[rel~="ar"]');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const original = DOMTokenList.prototype.supports;
    DOMTokenList.prototype.supports = function (jeton) {
      return jeton === 'ar' ? true : original.call(this, jeton);
    };
  });
});

test('le lien « Fixer au sol » est visible en camera-gyro', async ({ page }) => {
  await demarrer(page);
  expect((await evenements(page, 'ready'))[0].mode).toBe('camera-gyro');
  await expect(lien(page)).toHaveCount(1);
  await expect(lien(page)).toBeVisible();
  await expect(lien(page)).toContainText('Fixer au sol');
  await expect(lien(page).locator('img')).toHaveCount(1);
});

test('le href se termine par #allowsContentScaling=0… et le titre du modèle encodé', async ({ page }) => {
  await demarrer(page);
  const href = await lien(page).getAttribute('href');
  expect(href).toContain('/models/out/rectangulaire-8x4-sol.usdz');
  expect(href.endsWith(`${FRAGMENT}${encodeURIComponent('Rectangulaire 8 × 4')}`)).toBe(true);
});

test('le href change après un changement de modèle', async ({ page }) => {
  await demarrer(page);
  const avant = await lien(page).getAttribute('href');
  await vignette(page, IDS[1]).click();
  await attendre(page, 'model-changed');
  await expect.poll(() => lien(page).getAttribute('href')).not.toBe(avant);
  const apres = await lien(page).getAttribute('href');
  expect(apres).toContain('/models/out/haricot-7x3-5-sol.usdz');
  expect(apres.endsWith(`${FRAGMENT}${encodeURIComponent('Forme libre 7 × 3,5')}`)).toBe(true);
});

test('en camera-gyro avec Quick Look, le bouton principal est le lien « Fixer au sol » ; « Photo » est secondaire', async ({ page }) => {
  await demarrer(page);
  const principaux = hote(page).locator('.bas:not(.photo) .principal');
  await expect(principaux).toHaveCount(1);
  await expect(principaux).toHaveAttribute('rel', 'ar');
  await expect(principaux).toContainText('Fixer au sol');
  await expect(bouton(page, 'Photo')).not.toHaveClass(/principal/);
});

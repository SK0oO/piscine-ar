import { test, expect } from '@playwright/test';
import { ouvrir, bouton, hote, vignette, attendre, evenements, IDS } from './helpers.js';

// Quick Look (lot C). Sous Chromium, relList.supports('ar') est faux : on le force à vrai AVANT le chargement.
// (relList est un accesseur de HTMLAnchorElement.prototype ; `supports` vit sur DOMTokenList.prototype, c'est lui qu'on remplace.)
// Noms fixés : lien = a[rel~="ar"] dans le Shadow DOM, texte visible « Fixer au sol », une seule <img> dedans.
const FRAGMENT = '#callToAction=Revenir%20au%20site&checkoutTitle=';
const lien = (page) => hote(page).locator('a[rel~="ar"]');

// Avec Quick Look supporté, l'accueil est l'écran Quick Look ; l'aperçu caméra se lance par le lien secondaire.
async function demarrer(page) {
  await ouvrir(page);
  await bouton(page, 'Aperçu caméra').click();
  await expect.poll(async () => (await evenements(page, 'ready')).some((e) => e.mode === 'camera-gyro')).toBe(true);
}

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
  expect((await evenements(page, 'ready')).at(-1).mode).toBe('camera-gyro');
  await expect(lien(page)).toHaveCount(1);
  await expect(lien(page)).toBeVisible();
  await expect(lien(page)).toContainText('Fixer au sol');
  await expect(lien(page).locator('img')).toHaveCount(1);
});

test('le href se termine par #callToAction=… et le titre du modèle encodé, sans allowsContentScaling (échelle libre)', async ({ page }) => {
  await demarrer(page);
  const href = await lien(page).getAttribute('href');
  expect(href).toContain('/models/out/rectangulaire-8x4-sol.usdz');
  expect(href).not.toContain('allowsContentScaling');
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

// --- Accueil iPhone : Quick Look est le flux principal (V3b) ---

const principalAccueil = (page) => hote(page).locator('[data-role="explication-quicklook"] a[rel~="ar"]');

test('accueil Quick Look : phrase, 3 vignettes, lien principal « Voir dans mon jardin », sans demande de caméra', async ({ page }) => {
  await ouvrir(page);
  const accueil = hote(page).locator('[data-role="explication-quicklook"]');
  await expect(accueil).toBeVisible();
  await expect(accueil).toContainText("L'iPhone reconnaît le sol");
  await expect(accueil).toContainText('visez le sol et attendez une seconde');
  await expect(hote(page).locator('button[data-modele]')).toHaveCount(3);
  await expect(vignette(page, IDS[0])).toHaveAttribute('aria-pressed', 'true');
  await expect(principalAccueil(page)).toHaveCount(1);
  await expect(principalAccueil(page)).toHaveClass(/principal/);
  await expect(principalAccueil(page)).toContainText('Voir dans mon jardin');
  await expect(principalAccueil(page).locator('img')).toHaveCount(1);
  await expect(bouton(page, 'Activer la caméra')).toHaveCount(0);
  expect(await principalAccueil(page).getAttribute('href')).toContain('/models/out/rectangulaire-8x4-sol.usdz');
  expect(await page.evaluate(() => window.__media.flux.length)).toBe(0);
});

test('accueil Quick Look : ready en mode quicklook avec le modèle sélectionné', async ({ page }) => {
  await ouvrir(page);
  await attendre(page, 'ready');
  const [ready] = await evenements(page, 'ready');
  expect(ready.mode).toBe('quicklook');
  expect(ready.modele).toBe(IDS[0]);
});

test('accueil Quick Look : le href suit la vignette et model-changed part avec la pose de départ', async ({ page }) => {
  await ouvrir(page);
  await attendre(page, 'ready');
  const avant = await principalAccueil(page).getAttribute('href');
  await vignette(page, IDS[1]).click();
  await attendre(page, 'model-changed');
  await expect.poll(() => principalAccueil(page).getAttribute('href')).not.toBe(avant);
  const apres = await principalAccueil(page).getAttribute('href');
  expect(apres).toContain('/models/out/haricot-7x3-5-sol.usdz');
  expect(apres.endsWith(`#callToAction=Changer%20de%20mod%C3%A8le&checkoutTitle=${encodeURIComponent('Forme libre 7 × 3,5')}`)).toBe(true);
  const [changement] = await evenements(page, 'model-changed');
  expect(changement.modele).toBe(IDS[1]);
  expect(changement.pose.position).toEqual({ x: 0, y: 0, z: -6 });
  await expect(vignette(page, IDS[1])).toHaveAttribute('aria-pressed', 'true');
});

test('accueil Quick Look : « Aperçu caméra (sans suivi du sol) » mène au flux camera-gyro', async ({ page }) => {
  await ouvrir(page);
  await expect(bouton(page, 'Aperçu caméra (sans suivi du sol)')).toBeVisible();
  await bouton(page, 'Aperçu caméra').click();
  await expect.poll(async () => (await evenements(page, 'ready')).some((e) => e.mode === 'camera-gyro')).toBe(true);
  expect(await page.evaluate(() => window.__media.flux.length)).toBe(1);
  await expect(hote(page).locator('[data-role="explication-quicklook"]')).toHaveCount(0);
});

test('accueil Quick Look : tous les textes font 16 px ou plus', async ({ page }) => {
  await ouvrir(page);
  await expect(principalAccueil(page)).toBeVisible();
  const fautifs = await page.evaluate(() => {
    const racine = document.querySelector('piscine-ar').shadowRoot;
    const liste = [];
    for (const el of racine.querySelectorAll('*')) {
      const texte = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join('');
      if (texte && parseFloat(getComputedStyle(el).fontSize) < 16) liste.push(texte);
    }
    return liste;
  });
  expect(fautifs).toEqual([]);
});

import { test, expect } from '@playwright/test';
import { ouvrir, demarrer, vignette, hote, IDS } from './helpers.js';

// Texte visible dont la taille de police est inférieure à 16 px, dans le Shadow DOM de <piscine-ar>.
const tropPetits = (page) => page.evaluate(() => {
  const racine = document.querySelector('piscine-ar').shadowRoot;
  const fautifs = [];
  let verifies = 0;
  for (const el of racine.querySelectorAll('*')) {
    const texte = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join('');
    if (!texte) continue;
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden') continue;
    verifies += 1;
    if (parseFloat(s.fontSize) < 16) fautifs.push(`${el.tagName.toLowerCase()} « ${texte.slice(0, 30)} » ${s.fontSize}`);
  }
  return { verifies, fautifs };
});

test('écran d\'explication : tous les textes font 16 px ou plus', async ({ page }) => {
  await ouvrir(page);
  await page.locator('piscine-ar').locator('button', { hasText: 'Activer la caméra' }).waitFor();
  const { verifies, fautifs } = await tropPetits(page);
  expect(verifies).toBeGreaterThan(2);
  expect(fautifs).toEqual([]);
});

test('écran de la piscine : tous les textes font 16 px ou plus', async ({ page }) => {
  await demarrer(page);
  const { verifies, fautifs } = await tropPetits(page);
  expect(verifies).toBeGreaterThan(5);
  expect(fautifs).toEqual([]);
});

test('beforexrselect sur une vignette donne defaultPrevented', async ({ page }) => {
  await demarrer(page);
  const prevenu = await vignette(page, IDS[0]).evaluate((el) => {
    const e = new Event('beforexrselect', { bubbles: true, cancelable: true, composed: true });
    el.dispatchEvent(e);
    return e.defaultPrevented;
  });
  expect(prevenu).toBe(true);
});

test('pas de lien Quick Look sous Chromium', async ({ page }) => {
  await demarrer(page);
  expect(await hote(page).locator('a[rel~="ar"]').count()).toBe(0);
});

test('retirer l\'élément termine les pistes caméra', async ({ page }) => {
  await demarrer(page);
  const avant = await page.evaluate(() => window.__media.flux.flatMap((f) => f.getTracks()).map((t) => t.readyState));
  expect(avant.length).toBeGreaterThan(0);
  expect(avant.every((e) => e === 'live')).toBe(true);
  await page.evaluate(() => document.querySelector('piscine-ar').remove());
  await expect.poll(() => page.evaluate(() => window.__media.flux.flatMap((f) => f.getTracks()).every((t) => t.readyState === 'ended'))).toBe(true);
});

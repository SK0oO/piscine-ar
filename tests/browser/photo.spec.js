import { test, expect } from '@playwright/test';
import { demarrer, bouton, hote, attendre, evenements } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await demarrer(page);
});

test('« Figer » → blob image/png à la taille clientWidth × dpr, pixel de coin opaque', async ({ page }) => {
  await bouton(page, 'Figer').click();
  await attendre(page, 'photo');
  const [ev] = await evenements(page, 'photo');
  expect(ev.blob.type).toBe('image/png');
  const attendu = await page.evaluate(() => {
    const h = document.querySelector('piscine-ar');
    return { l: Math.round(h.clientWidth * devicePixelRatio), h: Math.round(h.clientHeight * devicePixelRatio) };
  });
  expect(ev.largeur).toBe(attendu.l);
  expect(ev.hauteur).toBe(attendu.h);
  expect(ev.modele).toBe('rectangulaire-8x4');
  const reel = await page.evaluate(async (i) => {
    const bmp = await createImageBitmap(window.__blobs[i]);
    const c = new OffscreenCanvas(bmp.width, bmp.height);
    const ctx = c.getContext('2d');
    ctx.drawImage(bmp, 0, 0);
    return { l: bmp.width, h: bmp.height, alpha: ctx.getImageData(0, 0, 1, 1).data[3] };
  }, ev.indexBlob);
  expect(reel.l).toBe(attendu.l);
  expect(reel.h).toBe(attendu.h);
  expect(reel.alpha).toBe(255);
});

test('un second appui pendant le gel ne produit pas d\'autre événement', async ({ page }) => {
  await bouton(page, 'Figer').evaluate((b) => { b.click(); b.click(); });
  await attendre(page, 'photo');
  await page.waitForTimeout(500);
  expect(await evenements(page, 'photo')).toHaveLength(1);
});

test('« Enregistrer » télécharge piscine.png', async ({ page }) => {
  await bouton(page, 'Figer').click();
  await attendre(page, 'photo');
  const [dl] = await Promise.all([page.waitForEvent('download'), bouton(page, 'Enregistrer').click()]);
  expect(dl.suggestedFilename()).toBe('piscine.png');
});

test('« Reprendre » masque l\'image figée', async ({ page }) => {
  await bouton(page, 'Figer').click();
  await attendre(page, 'photo');
  const image = hote(page).locator('img[data-role="photo"]');
  await expect(image).toBeVisible();
  await bouton(page, 'Reprendre').click();
  await expect(image).toBeHidden();
});

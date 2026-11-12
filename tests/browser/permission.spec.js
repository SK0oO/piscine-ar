import { test, expect } from '@playwright/test';
import { ouvrir, demarrer, bouton, attendre, evenements, hote } from './helpers.js';

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== 'iphone', 'scénario iPhone : requestPermission n\'existe que sur iOS');
});

const compteurs = (page) => page.evaluate(() => ({ permission: window.__orientation.appels, camera: window.__media.appels }));

test('le texte d\'explication s\'affiche avant toute demande', async ({ page }) => {
  await ouvrir(page);
  await expect(hote(page).getByText('Rien n\'est envoyé')).toBeVisible();
  await expect(bouton(page, 'Activer la caméra')).toBeVisible();
  expect(await compteurs(page)).toEqual({ permission: 0, camera: 0 });
});

test('« Activer la caméra » → un seul requestPermission, un seul getUserMedia, ready camera-gyro en moins de 3 s', async ({ page }) => {
  await ouvrir(page);
  await bouton(page, 'Activer la caméra').click();
  await attendre(page, 'ready', { timeout: 3000 });
  const [pret] = await evenements(page, 'ready');
  expect(pret.mode).toBe('camera-gyro');
  expect(await compteurs(page)).toEqual({ permission: 1, camera: 1 });
});

test('caméra refusée → erreur camera-refusee, puis « Voir sans caméra » → ready en sans-camera', async ({ page }) => {
  await ouvrir(page, { media: { refuser: true } });
  await bouton(page, 'Activer la caméra').click();
  await attendre(page, 'error');
  expect((await evenements(page, 'error'))[0].code).toBe('camera-refusee');
  await bouton(page, 'Voir sans caméra').click();
  await attendre(page, 'ready');
  expect((await evenements(page, 'ready')).at(-1).mode).toBe('sans-camera');
});

test('mouvement refusé (denied) → le mode reste camera-gyro, sans erreur', async ({ page }) => {
  await demarrer(page, { orientation: { reponse: 'denied' } });
  expect((await evenements(page, 'ready'))[0].mode).toBe('camera-gyro');
  expect(await evenements(page, 'error')).toEqual([]);
});

test('play() rejeté → bouton « Lancer la caméra »', async ({ page }) => {
  await ouvrir(page, { media: { rejeterPlay: true } });
  await bouton(page, 'Activer la caméra').click();
  await expect(bouton(page, 'Lancer la caméra')).toBeVisible();
});

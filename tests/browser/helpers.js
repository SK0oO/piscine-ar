import { expect } from '@playwright/test';
import { installerOrientation } from './fakes/orientation.js';
import { installerMedia } from './fakes/media.js';
import { installerXr } from './fakes/xr.js';

// Noms fixés par le testeur (contrat d'interface de A2, voir le rapport) :
//  - hôte : <piscine-ar> ; tout se cherche dans son Shadow DOM par rôle et texte visible, sauf :
//  - surface de gestes : [data-role="gestes"] ; cote en mètres : [data-role="cote"] ;
//  - vignettes : button[data-modele="<id>"] (ordre du JSON) ; photo figée : img[data-role="photo"].
//  - événements : detail.modele = id (chaîne), detail.mode = 'webxr' | 'camera-gyro' | 'sans-camera'.
export const PAGE = '/tests/browser/pages/composant.html';
export const IDS = ['rectangulaire-8x4', 'haricot-7x3-5', 'ovale-5x3'];

export const hote = (page) => page.locator('piscine-ar');
export const bouton = (page, texte) => hote(page).locator('button', { hasText: texte });
export const surface = (page) => hote(page).locator('[data-role="gestes"]');
export const vignette = (page, id) => hote(page).locator(`button[data-modele="${id}"]`);

// Ouvre la page avec les faux injectés avant le chargement, et échoue clairement si /src/index.js ne se charge pas.
export async function ouvrir(page, { orientation = {}, media = {}, xr = false } = {}) {
  await page.addInitScript(installerMedia, media);
  await page.addInitScript(installerOrientation, orientation);
  if (xr) await page.addInitScript(installerXr);
  await page.goto(PAGE);
  await page.waitForFunction(() => window.__chargement !== undefined, null, { timeout: 10_000 });
  const etat = await page.evaluate(() => window.__chargement);
  if (etat !== 'ok') throw new Error(`chargement de /src/index.js impossible (${etat})`);
}

export const evenements = (page, type) =>
  page.evaluate((t) => window.__evts.filter((e) => e.type === t), type);

export const attendre = (page, type, { n = 1, timeout = 10_000 } = {}) =>
  expect.poll(async () => (await evenements(page, type)).length, { timeout }).toBeGreaterThanOrEqual(n);

// Clique « Activer la caméra » et attend `piscine-ar:ready`.
export async function demarrer(page, options) {
  await ouvrir(page, options);
  await bouton(page, 'Activer la caméra').click();
  await attendre(page, 'ready');
}

export const pose = (page) => page.evaluate(() => document.querySelector('piscine-ar').pose);

// Oriente le téléphone (regard 30° sous l'horizon) pour que le toucher trouve le sol, puis laisse passer une image.
export async function regarderLeSol(page) {
  await page.evaluate(() => window.__orientation.emettre({ alpha: 0, beta: 60, gamma: 0 }));
  await page.waitForTimeout(100);
}

// PointerEvent synthétiques sur la surface de gestes.
export async function pointeur(page, type, id, x, y) {
  await surface(page).dispatchEvent(type, {
    pointerId: id, pointerType: 'touch', isPrimary: id === 1, clientX: x, clientY: y, bubbles: true, cancelable: true,
  });
}

export async function centre(page) {
  const b = await surface(page).boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

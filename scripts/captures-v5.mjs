// Captures du lot V5 « DA de Maxime » pour Alex (plan §13.3), dans demo/captures/V5/.
// Usage : npm run build && node scripts/captures-v5.mjs
// Sert dist/ (le bundle publié, comme chez le pisciniste) et photographie à 390 px de large, densité 2 (comme les captures de Maxime).
import { chromium, devices } from '@playwright/test';
import { preview } from 'vite';
import { mkdirSync } from 'node:fs';
import { installerOrientation } from '../tests/browser/fakes/orientation.js';

const SORTIE = 'demo/captures/V5';
const PORT = 5198;
mkdirSync(SORTIE, { recursive: true });

const serveur = await preview({ preview: { port: PORT, strictPort: true, https: undefined }, logLevel: 'silent' });
const base = `http://localhost:${PORT}`;
const navigateur = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
const contexte = await navigateur.newContext({
  ...devices['iPhone 14'],
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  permissions: ['camera'],
});

// Ouvre une page de démo et attend l'accueil prêt : polices de la page chargées, bouton principal et grande vignette affichés.
async function ouvrir(chemin) {
  const page = await contexte.newPage();
  await page.addInitScript(installerOrientation, {});
  await page.goto(base + chemin);
  await page.locator('piscine-ar').locator('.ecran .principal').waitFor({ timeout: 15_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => {
    const img = document.querySelector('piscine-ar').shadowRoot.querySelector('.apercu img');
    return !img || img.complete;
  });
  await page.waitForTimeout(400);
  return page;
}

async function accueilPleinEcran(chemin, nom) {
  const page = await ouvrir(chemin);
  const hote = page.locator('piscine-ar');
  await hote.scrollIntoViewIfNeeded();
  await hote.screenshot({ path: `${SORTIE}/${nom}` });
  await page.close();
}

await accueilPleinEcran('/demo/', 'accueil-390.png');
await accueilPleinEcran('/demo/?palette=terre', 'accueil-terre.png');

// Accueil compact : la boîte 4:3 de la démo intégrée, dans la page (onglets factices au-dessus du composant).
{
  const page = await ouvrir('/demo/integree.html');
  await page.screenshot({ path: `${SORTIE}/accueil-compact.png` });
  await page.close();
}

// Vue caméra : fausse caméra de Chromium, téléphone incliné vers le sol, télécommande visible.
{
  const page = await ouvrir('/demo/');
  await page.locator('piscine-ar').locator('button', { hasText: 'Activer la caméra' }).click();
  await page.waitForFunction(() => {
    const r = document.querySelector('piscine-ar').shadowRoot;
    return r.querySelector('.piscine:not(.attente)') && !r.querySelector('.ecran');
  }, null, { timeout: 15_000 });
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => window.__orientation.emettre({ alpha: 0, beta: 60, gamma: 0 }));
    await page.waitForTimeout(150);
  }
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${SORTIE}/camera-390.png` });
  await page.close();
}

await navigateur.close();
await new Promise((ok) => serveur.httpServer.close(ok));
console.log('captures ok :', SORTIE);

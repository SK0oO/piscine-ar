// Génère models/out/<id>.glb, <id>.usdz, <id>-sol.usdz (dalle à ras du sol, Quick Look) et <id>.png pour chaque JSON de models/params/,
// plus les captures 1024² de demo/captures/M1/<id>.png. Tout passe par Chromium : les exporteurs Three.js ont besoin d'un canvas.
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const RACINE = resolve(fileURLToPath(import.meta.url), '../../..');
const PARAMS = resolve(RACINE, 'models/params');
const SORTIE = resolve(RACINE, 'models/out');
const CAPTURES = resolve(RACINE, 'demo/captures/M1');

const tous = readdirSync(PARAMS)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(resolve(PARAMS, f), 'utf8')));

mkdirSync(SORTIE, { recursive: true });
mkdirSync(CAPTURES, { recursive: true });

const { createServer } = await import('vite');
const { chromium } = await import('@playwright/test');
const serveur = await createServer({ root: RACINE, logLevel: 'error', server: { port: 0, host: '127.0.0.1' } });
await serveur.listen();
const url = serveur.resolvedUrls.local[0].replace(/\/$/, '');
const navigateur = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  // 1. Export GLB + USDZ (canvas 2D seulement, pas de WebGL).
  const exportPage = await navigateur.newPage();
  exportPage.on('pageerror', (e) => console.error(`export : ${e.message}`));
  await exportPage.goto(`${url}/models/generate/export.html`);
  await exportPage.waitForFunction(() => window.__pret === true, null, { timeout: 30000 });
  for (const params of tous) {
    const r = await exportPage.evaluate((p) => window.exporter(p), params);
    writeFileSync(resolve(SORTIE, `${params.id}.glb`), Buffer.from(r.glb, 'base64'));
    writeFileSync(resolve(SORTIE, `${params.id}.usdz`), Buffer.from(r.usdz, 'base64'));
    writeFileSync(resolve(SORTIE, `${params.id}-sol.usdz`), Buffer.from(r.usdzSol, 'base64'));
    console.log(`${params.id} : glb + usdz + usdz sol`);
  }
  await exportPage.close();

  // 2. Vignettes 512² (page de prévisualisation, WebGL logiciel) et captures 1024² pour la relecture.
  for (const [taille, dossier, nom] of [[512, SORTIE, 'vignette'], [1024, CAPTURES, 'capture 1024²']]) {
    const page = await navigateur.newPage({ viewport: { width: taille, height: taille }, ignoreHTTPSErrors: true }); // serveur local, certificat local éventuel (.cert/)
    for (const params of tous) {
      await page.goto(`${url}/demo/preview.html?id=${params.id}&shot=1&taille=${taille}`);
      await page.waitForFunction(() => window.__pret === true, null, { timeout: 60000 });
      await page.screenshot({ path: resolve(dossier, `${params.id}.png`) });
      console.log(`${params.id} : ${nom}`);
    }
    await page.close();
  }
} finally {
  await navigateur.close();
  await serveur.close();
}

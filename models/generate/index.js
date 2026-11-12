// Génère models/out/<id>.glb, <id>.usdz et <id>.png pour chaque JSON de models/params/.
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Scene } from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { USDZExporter } from 'three/addons/exporters/USDZExporter.js';
import { buildPool } from './pool.js';

const RACINE = resolve(fileURLToPath(import.meta.url), '../../..');
const PARAMS = resolve(RACINE, 'models/params');
const SORTIE = resolve(RACINE, 'models/out');

// Node n'a pas FileReader : GLTFExporter en a besoin pour le binaire.
if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = class {
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((r) => { this.result = r; this.onloadend?.({ target: this }); });
    }
    readAsDataURL(blob) {
      blob.arrayBuffer().then((r) => {
        this.result = `data:${blob.type || 'application/octet-stream'};base64,${Buffer.from(r).toString('base64')}`;
        this.onloadend?.({ target: this });
      });
    }
  };
}

const tous = readdirSync(PARAMS)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(resolve(PARAMS, f), 'utf8')));

mkdirSync(SORTIE, { recursive: true });

for (const params of tous) {
  const piscine = buildPool(params, { eau: params.eauParDefaut });
  const scene = new Scene();
  scene.add(piscine);
  const glb = await new GLTFExporter().parseAsync(scene, { binary: true });
  writeFileSync(resolve(SORTIE, `${params.id}.glb`), Buffer.from(glb));
  const usdz = await new USDZExporter().parseAsync(scene);
  writeFileSync(resolve(SORTIE, `${params.id}.usdz`), Buffer.from(usdz));
  console.log(`${params.id} : glb + usdz`);
}

// Vignettes : la page de prévisualisation rendue par Chromium (WebGL logiciel).
const { createServer } = await import('vite');
const { chromium } = await import('@playwright/test');
const serveur = await createServer({ root: RACINE, logLevel: 'error', server: { port: 0, host: '127.0.0.1' } });
await serveur.listen();
const url = serveur.resolvedUrls.local[0].replace(/\/$/, '');
const navigateur = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const page = await navigateur.newPage({ viewport: { width: 512, height: 512 } });
  for (const params of tous) {
    await page.goto(`${url}/demo/preview.html?id=${params.id}&shot=1`);
    await page.waitForFunction(() => window.__pret === true, null, { timeout: 30000 });
    await page.screenshot({ path: resolve(SORTIE, `${params.id}.png`) });
    console.log(`${params.id} : png`);
  }
} finally {
  await navigateur.close();
  await serveur.close();
}

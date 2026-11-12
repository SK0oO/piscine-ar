// Capture d'une page du dépôt en PNG : node scripts/capture-page.mjs <chemin/page.html> <sortie.png> [largeur] [hauteur]
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
const [page_, sortie, largeur = '1760', hauteur = '1000'] = process.argv.slice(2);
const server = await createServer({ root: process.cwd(), server: { port: 5199 }, logLevel: 'silent' });
await server.listen();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: +largeur, height: +hauteur }, deviceScaleFactor: 1 });
await page.goto(`http://localhost:5199/${page_}`);
await page.waitForTimeout(800);
await page.screenshot({ path: sortie, fullPage: true });
await browser.close(); await server.close();
console.log('capture ok', sortie);

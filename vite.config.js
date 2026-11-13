// Construction 2/2 (et serveur de dev/tests) : le site de démo, à côté de dist/piscine-ar.js.
// dist/ reprend l'arborescence du dépôt : demo/, models/out/ et models/params/ côte à côte.
import { defineConfig } from 'vite';
import { existsSync, readFileSync } from 'node:fs';

// Certificat local (dossier .cert/, hors git) pour tester la caméra sur un téléphone du même Wi-Fi.
const https = existsSync('.cert/cert.pem')
  ? { key: readFileSync('.cert/key.pem'), cert: readFileSync('.cert/cert.pem') }
  : undefined;
import { cpSync, writeFileSync, mkdirSync } from 'node:fs';

// Fichiers copiés tels quels, plus .nojekyll (GitHub Pages) et une racine qui renvoie vers demo/.
function sitePages() {
  return {
    name: 'site-pages',
    closeBundle() {
      cpSync('models/out', 'dist/models/out', { recursive: true });
      cpSync('models/params', 'dist/models/params', { recursive: true });
      cpSync('demo/config', 'dist/demo/config', { recursive: true });
      cpSync('demo/maquette-v2.html', 'dist/demo/maquette-v2.html');
      mkdirSync('dist', { recursive: true });
      writeFileSync('dist/.nojekyll', '');
      writeFileSync(
        'dist/index.html',
        '<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Piscines Dupont</title>' +
          '<meta http-equiv="refresh" content="0; url=demo/"></head>' +
          '<body><a href="demo/">Ouvrir la démo</a></body></html>\n',
      );
    },
  };
}

export default defineConfig({
  root: '.',
  base: './',
  publicDir: false,
  plugins: [sitePages()],
  build: {
    outDir: 'dist',
    emptyOutDir: false, // dist/piscine-ar.js vient de la première construction
    rollupOptions: { input: { demo: 'demo/index.html', preview: 'demo/preview.html' } },
  },
  server: { host: true, https },
  preview: { host: true, https, port: 4443 },
  test: { include: ['tests/unit/**/*.test.js'], environment: 'node' },
});

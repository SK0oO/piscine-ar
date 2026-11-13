// Serveur HTTPS simple (HTTP/1.1) pour tester la démo construite (dist/) sur un téléphone du même Wi-Fi.
// node scripts/serveur-test.mjs [port]   — certificat : .cert/cert.pem et .cert/key.pem
import { createServer } from 'node:https';
import { readFileSync, statSync, createReadStream, existsSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';
const port = Number(process.argv[2] || 4443);
const racine = join(process.cwd(), 'dist');
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.usdz': 'model/vnd.usdz+zip', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
};
createServer({ key: readFileSync('.cert/key.pem'), cert: readFileSync('.cert/cert.pem') }, (req, res) => {
  let chemin = decodeURIComponent((req.url || '/').split('?')[0]);
  if (chemin.endsWith('/')) chemin += 'index.html';
  const fichier = normalize(join(racine, chemin));
  if (!fichier.startsWith(racine) || !existsSync(fichier) || statSync(fichier).isDirectory()) {
    if (existsSync(fichier) && statSync(fichier).isDirectory()) { res.writeHead(301, { Location: chemin.replace(/\/?$/, '/') }); return res.end(); }
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('introuvable');
  }
  res.writeHead(200, { 'Content-Type': types[extname(fichier)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  createReadStream(fichier).pipe(res);
}).listen(port, '0.0.0.0', () => console.log(`https://0.0.0.0:${port}/ (dist/)`));

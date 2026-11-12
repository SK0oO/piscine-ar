# piscine-ar — règles du dépôt

Composant web « voir une piscine dans mon jardin » (caméra + 3D) pour les sites de piscinistes.
Plan et décisions (source unique, à lire d'abord) : /Users/alexandre/Documents/Alex Cerveau/DREAM/1-Projets/Piscine-AR/plan.md
Recherche : /Users/alexandre/Documents/Alex Cerveau/DREAM/1-Projets/Piscine-AR/recherche/existant-2026-11-11.md

## Stack
- JavaScript ES modules, sans TypeScript, sans framework UI. Three.js (npm `three`, MIT). Vite pour servir et construire.
- Tests unitaires : vitest (`npm test`). Tests navigateur : Playwright (`npm run test:browser`), émulation mobile, fausse caméra (`--use-fake-device-for-media-stream`).
- Génération des modèles : `npm run generate` (Node + Three.js GLTFExporter/USDZExporter) → `models/out/`.
- Aucune dépendance payante, aucune clé API, aucun service tiers (règle 0 €). Pas de model-viewer, pas de 8th Wall, Zappar, Variant Launch.

## Arborescence (voir plan §3)
src/core (scène, chargement, gestes, changement de modèle, capture) · src/adapters (webxr.js, camera-gyro.js, quicklook.js) · src/ui (composant `<piscine-ar>`, Shadow DOM) · src/config (JSON du pisciniste) · models/generate (paramètres → GLB + USDZ + PNG) · models/out · demo · tests/unit · tests/browser · docs/plans.

## Contrats
- Adaptateur : `start()`, `stop()`, `place(x, y)`, `getPose()`, `onFrame(cb)`, plus `mode` ('webxr' | 'camera-gyro' | 'sans-camera' | 'quicklook'), `capacites` ({ echelle, photo }), `capturer({ largeur, hauteur })` → Blob PNG, `setModele(modele, racine)`. Le cœur ignore la plateforme. Détail : docs/plans/2026-11-12-coeur-et-adaptateurs.md.
- Modèle : 1 unité = 1 mètre, origine au niveau supérieur de la margelle, axe Y vers le haut, < 20 000 triangles, GLB < 4 Mo.
- Paramètres d'un modèle : `models/params/*.json` (longueur, largeur, profondeur, forme, rayon d'angle, margelle, couleurs d'eau).
- Événements du composant : `piscine-ar:ready`, `piscine-ar:model-changed`, `piscine-ar:photo` (detail.blob PNG), `piscine-ar:error`.

## Règles
- Dossiers où dev-testeur écrit : `tests/` seulement. dev-code ne modifie jamais un test.
- Fichiers sensibles (déclenchent dev-securite) : `src/adapters/*`, `src/ui/*` (permissions caméra/mouvement), `demo/*`, toute requête réseau.
- Interdit : envoyer la photo, la position ou toute donnée à un serveur ; cookies ; trackers.
- Textes visibles en français, phrases courtes, 16 px minimum, lisibles en plein soleil (blanc sur fond sombre semi-opaque).
- Commits : messages en français, un sujet par commit. Ne jamais pousser sans l'accord d'Alex.

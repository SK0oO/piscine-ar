Projet : piscine-ar — dépôt /Users/alexandre/piscine-ar (lis CLAUDE.md, puis docs/plans/2026-11-12-coeur-et-adaptateurs.md §12)
Étape : lot V4 — audit de sécurité des fichiers sensibles
Objectif : vérifier src/ui/piscine-ar.js (écouteur sur le lien Quick Look de la vue caméra, coupure de la caméra), src/adapters/camera-gyro.js (lecture des dimensions vidéo, hauteur), src/core/champ.js, models/generate/export.js, et l'essai du pilote (scripts/essai-ra.mjs, demo/essai/index.html, demo/essai/essai-ra.usda, ligne `demo/essai` de vite.config.js, déjà en ligne sur GitHub Pages) contre : la caméra qui resterait allumée après qu'on quitte la vue (pistes non arrêtées sur un chemin d'erreur), toute requête réseau nouvelle, URL externe, `innerHTML`/`eval`/`Function(`, données envoyées, et la règle « aucun envoi de photo, position ou donnée ».
Savoir-faire : /Users/alexandre/Documents/Alex Cerveau/DREAM/_outils/plugins/dream-team/skills/feature/SKILL.md (étape 6)
Entrées : `git diff ff5d9bf HEAD -- src models/generate demo scripts vite.config.js` ; tests/browser/quicklook.spec.js.
Contrôles : `npm audit --omit=dev` (tel quel) ; recherche de `innerHTML`, `eval`, `Function(`, `fetch(`, `XMLHttpRequest`, `sendBeacon`, `localStorage`, `document.cookie`, `http://`, `https://` dans src/, models/generate/, scripts/essai-ra.mjs, demo/essai/ (justifie chaque occurrence) ; `usdchecker --arkit demo/essai/essai-ra.usdz` ; aucune URL externe ni chemin absolu dans demo/essai/essai-ra.usda.
Périmètre : lecture seule. Ne lance ni `npm test` ni `npm run generate` (un autre relecteur les lance en même temps).
Fini quand : verdict `OK`, `À CORRIGER` (fichier:ligne → risque → correctif) ou `BLOQUANT`, avec le résultat des contrôles.
Retour : verdict en une ligne, 3 puces max, preuves.

Projet : piscine-ar — dépôt /Users/alexandre/piscine-ar (lis CLAUDE.md, puis docs/plans/2026-11-12-coeur-et-adaptateurs.md §13)
Étape : lot V5 — audit de sécurité des fichiers sensibles
Objectif : vérifier src/ui/*, src/config/config.js (nouvelles couleurs et champ `forme` venant du JSON du pisciniste), demo/* (Google Fonts chargé par la page démo, nouvelle page integree.html, paramètre `?palette=`), contre : injection CSS par une couleur de config (seul #rrggbb accepté ?), injection par l'attribut `modele` ou le paramètre `palette`, ressource externe chargée par le composant, `innerHTML`, données envoyées.
Savoir-faire : /Users/alexandre/Documents/Alex Cerveau/DREAM/_outils/plugins/dream-team/skills/feature/SKILL.md (étape 6)
Entrées : `git diff e0baa2a HEAD -- src demo vite.config.js` ; tests/unit/config.test.js.
Contrôles : `npm audit --omit=dev` ; recherche de `innerHTML`, `eval`, `Function(`, `fetch(`, `XMLHttpRequest`, `sendBeacon`, `localStorage`, `document.cookie`, `http://`, `https://`, `@import`, `url(` dans src/ et demo/ (justifie chaque occurrence) ; les seules ressources tierces de la démo sont-elles Google Fonts (et rien dans le composant) ?
Périmètre : lecture seule ; ne lance ni `npm test` ni `npm run generate`.
Fini quand : verdict `OK`, `À CORRIGER` (fichier:ligne → risque → correctif) ou `BLOQUANT`.
Retour : verdict en une ligne, 3 puces max, preuves.

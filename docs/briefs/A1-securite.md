Projet : piscine-ar — dépôt /Users/alexandre/piscine-ar (lis CLAUDE.md, puis le plan technique docs/plans/2026-11-12-coeur-et-adaptateurs.md §1 « JSON du pisciniste », « Élément », §5)
Étape : lot A1 — audit de sécurité des fichiers sensibles
Objectif : vérifier src/config/config.js (lecture d'un JSON distant, résolution d'URL, origines autorisées, textes injectés dans l'interface) et src/adapters/choisir.js, contre : injection (URL javascript:, data:, origine étrangère), contenu HTML dans les textes, dénis par JSON énorme ou récursif, fuite de données (aucune requête sortante autre que GET même origine), et le respect de la règle « aucun envoi de photo, position ou donnée ».
Savoir-faire : /Users/alexandre/Documents/Alex Cerveau/DREAM/_outils/plugins/dream-team/skills/feature/SKILL.md (étape 6)
Entrées : `git diff 6459c18 HEAD -- src/` ; tests/unit/config.test.js ; tests/unit/choisir.test.js.
Contrôles : `npm test` (78/78) ; `npm audit --omit=dev` (rapporter le résultat tel quel) ; recherche de `innerHTML`, `eval`, `Function(`, `fetch(`, `XMLHttpRequest`, `navigator.sendBeacon`, `localStorage`, `document.cookie` dans src/.
Périmètre : lecture seule.
Fini quand : verdict `OK`, `À CORRIGER` (fichier:ligne → risque → correctif) ou `BLOQUANT`, avec le résultat des contrôles.
Retour : verdict en une ligne, 3 puces max, preuves.

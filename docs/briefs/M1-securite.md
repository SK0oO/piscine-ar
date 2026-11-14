Projet : piscine-ar — dépôt /Users/alexandre/piscine-ar (lis CLAUDE.md, puis docs/plans/2026-11-12-coeur-et-adaptateurs.md §11)
Étape : lot M1 « matières réalistes » — audit de sécurité des fichiers sensibles
Objectif : vérifier src/ui/piscine-ar.js (branchement de l'environnement et de l'animation de l'eau), demo/preview.js (sol herbe, environnement, captures), models/generate/export.html + export.js + index.js (page d'export ouverte dans Chromium par Playwright, échange base64 avec Node) contre : requête réseau sortante nouvelle, URL externe, `innerHTML`/`eval`/`Function(`, données écrites hors de models/out et demo/captures, exécution de contenu venant d'un fichier de paramètres sans validation, et respect de la règle « aucun envoi de photo, position ou donnée ». Vérifie aussi que le GLB produit ne référence aucune URI externe (le chargeur src/core/loader.js refuse tout `uri` hors data:/blob:) et que `KHR_texture_transform` passe bien par `verifierRessources`.
Savoir-faire : /Users/alexandre/Documents/Alex Cerveau/DREAM/_outils/plugins/dream-team/skills/feature/SKILL.md (étape 6)
Entrées : `git diff aaaa6d5 HEAD -- src demo models/generate` ; tests/browser/matieres.spec.js ; tests/unit/generate.test.js.
Contrôles : `npm audit --omit=dev` (résultat tel quel) ; recherche de `innerHTML`, `eval`, `Function(`, `fetch(`, `XMLHttpRequest`, `sendBeacon`, `localStorage`, `document.cookie`, `http://`, `https://` dans src/ et models/generate/ et demo/preview.js (justifie chaque occurrence) ; lecture du JSON du GLB (chunk JSON) : `images[].uri` absent ou data:.
Périmètre : lecture seule.
Fini quand : verdict `OK`, `À CORRIGER` (fichier:ligne → risque → correctif) ou `BLOQUANT`, avec le résultat des contrôles.
Retour : verdict en une ligne, 3 puces max, preuves.

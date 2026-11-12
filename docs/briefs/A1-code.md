Projet : piscine-ar — dépôt /Users/alexandre/piscine-ar (lis CLAUDE.md, puis le plan technique EN ENTIER : docs/plans/2026-11-12-coeur-et-adaptateurs.md, §1 contrats, §2 fichiers du lot A1, §6 précisions d'API)
Étape : lot A1 — logique pure du cœur, mode CODE
Objectif : faire passer les 9 fichiers de tests du lot A1 dans tests/unit/ (pose, gestures, stage, models, capture, config, choisir, orientation, format), sans modifier aucun test ni les faux de tests/unit/fakes/.
Savoir-faire : /Users/alexandre/Documents/Alex Cerveau/DREAM/_outils/plugins/dream-team/skills/feature/SKILL.md (étape 4)
Entrées : tests/unit/*.test.js et tests/unit/fakes/* (le contrat, lis-les en premier), plan technique §1 et §6.
Tes fichiers (toi seul y écris) : src/core/erreurs.js, src/core/pose.js, src/core/gestures.js, src/core/stage.js, src/core/models.js, src/core/capture.js, src/config/config.js, src/adapters/choisir.js, src/adapters/orientation.js, src/ui/format.js.
Règles : ES modules, pas de DOM ni de WebGL dans ces modules (stage.js crée scène, caméra, lumières et pivot Three.js sans renderer) ; `capture.js` exporte `coverRect` (pur) et `composePhoto` (utilise le canvas passé en paramètre, non testé ici) ; aucune dépendance ajoutée ; aucun `innerHTML`.
Déjà exclu : lot A2 (loader, renderer, camera-gyro, piscine-ar.js, vues, styles, textes, index), lots B et C.
Fini quand : `npm test` lancé par toi → tous les tests verts (23 E1 + les tests A1), résultat collé avec le nombre exact ; `npx vite build` passe.
Retour : verdict `FAIT` ou `BLOQUÉ`, tests n/n, liste des fichiers touchés, hypothèses, 3 puces max.

Projet : piscine-ar — dépôt /Users/alexandre/piscine-ar (lis CLAUDE.md, puis le plan technique EN ENTIER : docs/plans/2026-11-12-coeur-et-adaptateurs.md ; le plan général est /Users/alexandre/Documents/Alex Cerveau/DREAM/1-Projets/Piscine-AR/plan.md)
Étape : lot A1 — logique pure du cœur, mode ROUGE (tests avant le code)
Objectif : écrire les 9 fichiers de tests vitest du lot A1 listés au §3 « A1 » du plan technique (pose, gestures, stage, models, capture, config, choisir, orientation, format), exactement avec les cas qu'il énumère, qui échouent parce que les modules de src/ n'existent pas encore.
Savoir-faire : /Users/alexandre/Documents/Alex Cerveau/DREAM/_outils/plugins/dream-team/skills/feature/SKILL.md (étape 3)
Entrées : plan technique §1 (contrats : signatures exactes, codes d'erreur, constantes exportées) et §3 ; CLAUDE.md (contrats) ; tests existants tests/unit/pool.test.js pour le style.
Règles : environnement node, pas de DOM, pas de WebGL ; les faux (fake navigator, fake chargeur) vivent dans tests/unit/fakes/ ; import des modules par chemin relatif `../../src/...` (import statique, pour que chaque fichier échoue en bloc sur module absent) ; `stage.test.js` peut importer `three` pour vérifier le pivot.
Déjà exclu : ne touche pas à tests/unit/pool.test.js ni generate.test.js ; aucun test navigateur (lot A2).
Périmètre : tu écris SEULEMENT dans tests/unit/. Rien dans src/.
Fini quand : `npm test` lancé par toi montre les 23 tests E1 toujours verts et les nouveaux fichiers en échec pour cause de module absent (pas d'erreur de syntaxe). Donne la commande exacte, le nombre de fichiers et de tests en échec.
Retour : verdict `ROUGE CONFIRMÉ` ou `BLOQUÉ`, 3 puces max, chemins, sortie résumée.

Projet : piscine-ar — dépôt /Users/alexandre/piscine-ar (lis CLAUDE.md, puis le plan technique docs/plans/2026-11-12-coeur-et-adaptateurs.md §1, §2, §6)
Étape : lot A1 — relecture indépendante de la logique pure du cœur
Objectif : dire si les 10 modules de src/ du lot A1 respectent les contrats du plan technique (§1 et §6), les règles de CLAUDE.md, et si les tests prouvent ce qu'ils annoncent.
Savoir-faire : /Users/alexandre/Documents/Alex Cerveau/DREAM/_outils/plugins/dream-team/skills/feature/SKILL.md (étape 6)
Entrées : `git diff 6459c18 HEAD -- src/` (le code) ; tests/unit/*.test.js et tests/unit/fakes/* (le contrat) ; brief docs/briefs/A1-code.md.
Contrôles à relancer : `npm test` (attendu 78/78) ; `npx vite build`.
Points d'attention : bornes d'échelle et normalisation de rotation ; gestes à deux doigts (sens, déroulement de l'angle, doigt restant ignoré) ; « dernier appel gagne » et libération mémoire dans models.js ; parseConfig : origine des URL, ids uniques, version, textContent only ; orientation : formule DeviceOrientationControls (YXZ, −90° X, −angleEcran Z) ; aucun innerHTML, aucune dépendance ajoutée, tests intacts (`git diff 6459c18 HEAD -- tests/` ne doit contenir que l'ajout du testeur, commit « A1 : tests rouges »).
Périmètre : lecture seule.
Fini quand : verdict `OK`, `À CORRIGER` (fichier:ligne → attendu) ou `BLOQUANT`, commandes relancées et résultats.
Retour : verdict en une ligne, 3 puces max, preuves.

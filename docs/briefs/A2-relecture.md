Projet : piscine-ar — dépôt /Users/alexandre/piscine-ar (lis CLAUDE.md, puis le plan technique docs/plans/2026-11-12-coeur-et-adaptateurs.md §1, §2 lot A2, §5, §6, §7)
Étape : lot A2 — relecture indépendante du composant dans le navigateur
Objectif : dire si les 10 fichiers du lot A2 (src/index.js, core/loader.js, core/renderer.js, adapters/camera-gyro.js, adapters/webxr.js et quicklook.js bouchons, ui/piscine-ar.js, vues.js, styles.js, textes.js) respectent le plan technique, CLAUDE.md et le brief docs/briefs/A2-code.md, et si les tests prouvent ce qu'ils annoncent.
Savoir-faire : /Users/alexandre/Documents/Alex Cerveau/DREAM/_outils/plugins/dream-team/skills/feature/SKILL.md (étape 6)
Entrées : `git diff 7d1a3c2 HEAD -- src/` si ce hash existe, sinon `git log --oneline` et prends le diff du dernier commit « A2 : composant » ; tests/unit/camera-gyro.test.js, tests/browser/*.
Contrôles à relancer : `npm test` (87/87) ; `npm run test:browser` (40 passés, 6 ignorés) ; `npx vite build`.
Points d'attention : geste utilisateur (requestPermission, getUserMedia, play, requestSession partent avant le premier await) ; double `play()` ; disconnectedCallback (stop, révocation des URL d'objets, animation loop) ; changement de modèle garde la pose ; « Figer » une seule photo par gel ; aucun innerHTML ; 16 px minimum ; accessibilité de base (boutons `<button>`, `aria-label` sur « ↻ » et « × ») ; fuites : écouteurs retirés, pistes caméra arrêtées ; tests intacts (`git diff -- tests/` vide depuis le commit « A2 : tests rouges »).
Périmètre : lecture seule.
Fini quand : verdict `OK`, `À CORRIGER` (fichier:ligne → attendu) ou `BLOQUANT`, commandes relancées et résultats.
Retour : verdict en une ligne, 3 puces max, preuves.

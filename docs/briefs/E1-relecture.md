Projet : piscine-ar — dépôt /Users/alexandre/piscine-ar (lis CLAUDE.md, puis le plan §0, §2, §3 : /Users/alexandre/Documents/Alex Cerveau/DREAM/1-Projets/Piscine-AR/plan.md)
Étape : E1 — relecture indépendante du générateur des 3 piscines
Objectif : dire si le code de models/generate/, demo/preview.* et vite.config.js respecte le plan, le contrat « Modèle » de CLAUDE.md et les règles du dépôt, sans avoir vu sa fabrication.
Savoir-faire : /Users/alexandre/Documents/Alex Cerveau/DREAM/_outils/plugins/dream-team/skills/feature/SKILL.md (étape 6)
Entrées : `git diff 56e73d1 -- models/generate demo vite.config.js package.json` ; tests/unit/*.test.js (contrat) ; brief du développeur docs/briefs/E1-generateur-code.md (ce qu'on lui a demandé, pas son raisonnement).
Contrôles à relancer toi-même : `npm test` (attendu 23/23) ; `npx vite build` ; vérifier que `models/out/*.glb` fait moins de 4 Mo et que les 3 GLB ont moins de 20 000 triangles (un script court avec three/GLTFLoader en Node, ou lecture des tests qui le prouvent).
Points d'attention : le contrat géométrique (origine à la margelle, dimensions à 1 cm) ; les noms de maillages ; aucune dépendance ajoutée ; aucune requête réseau dans demo/preview.js ; pas de innerHTML avec des données du JSON ; polyfill FileReader local et borné à la génération ; les tests n'ont pas été modifiés (`git diff 56e73d1 -- tests/` doit être vide hors ajout initial du testeur).
Périmètre : lecture seule, tu ne modifies rien.
Fini quand : verdict `OK`, `À CORRIGER` (liste précise fichier:ligne → attendu) ou `BLOQUANT`, avec les commandes relancées et leurs résultats.
Retour : verdict en une ligne, 3 puces max, preuves.

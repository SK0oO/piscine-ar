Projet : piscine-ar — dépôt /Users/alexandre/piscine-ar (lis CLAUDE.md d'abord, puis le plan §0, §2, §3 : /Users/alexandre/Documents/Alex Cerveau/DREAM/1-Projets/Piscine-AR/plan.md)
Étape : E1 — générateur des 3 piscines, mode ROUGE (tests avant le code)
Objectif : des tests vitest qui échouent parce que le générateur n'existe pas encore, et qui passeront quand il existera.
Savoir-faire : /Users/alexandre/Documents/Alex Cerveau/DREAM/_outils/plugins/dream-team/skills/feature/SKILL.md (étape 3)
Entrées : models/params/*.json (3 fichiers), package.json (script `generate`), CLAUDE.md (contrat « Modèle »).
Contrat à tester (c'est toi qui le fixes dans les tests, dev-code s'y pliera) :
  - `models/generate/pool.js` exporte `buildPool(params, { eau })` → un `THREE.Group` (import depuis `three`), sans WebGL.
  - Boîte englobante du groupe : longueur X et largeur Z = params.longueur / params.largeur + 2 × margelle.largeur, à 1 cm près ; Y max = 0 à 1 cm près (dessus de margelle = origine) ; Y min = −params.profondeur à 2 cm près.
  - Triangles totaux du groupe < 20 000 ; chaque forme (rectangle, haricot, ovale) produit un groupe ; un nom d'eau inconnu lève une erreur ; chaque couleur d'eau donne une couleur de matériau différente sur le maillage nommé `eau`.
  - Les maillages sont nommés : `margelle`, `bassin`, `eau` (et `escalier` ou `plage` quand le JSON le prévoit).
  - `models/generate/index.js` (lancé par `npm run generate`) écrit dans `models/out/` : `<id>.glb`, `<id>.usdz`, `<id>.png` pour chaque JSON de `models/params/`, GLB < 4 Mo. Un test d'intégration lance `npm run generate` (timeout 120 s) puis vérifie l'existence et la taille des 9 fichiers et que le GLB commence par les octets `glTF`.
Déjà exclu : pas de model-viewer ; pas de modèle acheté ; pas de test de rendu visuel (c'est Alex qui juge les images).
Périmètre : tu écris SEULEMENT dans tests/unit/. Tu ne crées aucun fichier dans models/generate/.
Fini quand : `npm test` lancé par toi affiche tous les tests en échec pour cause de module absent ou de fichier absent (pas pour une erreur de syntaxe du test). Donne la commande exacte et le nombre de tests en échec.
Retour : verdict `ROUGE CONFIRMÉ` ou `BLOQUÉ` en une ligne, 3 puces max, chemins des fichiers, sortie résumée de la commande.

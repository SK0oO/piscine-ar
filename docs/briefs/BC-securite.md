Projet : piscine-ar — dépôt /Users/alexandre/piscine-ar (lis CLAUDE.md, puis le plan technique docs/plans/2026-11-12-coeur-et-adaptateurs.md §1 « WebXR », « Quick Look », §5)
Étape : lots B et C — audit de sécurité des fichiers sensibles
Objectif : auditer src/adapters/webxr.js, src/adapters/quicklook.js et les modifications de src/ui/* (diff `git diff fcaa34b HEAD -- src/`) : permissions WebXR demandées dans le geste et une seule fois ; `camera-access` : l'image caméra lue en RA ne quitte jamais la page (aucune requête, aucun stockage, URL d'objet révoquée) ; `domOverlay.root` = hôte, pas d'élément extérieur ; Quick Look : href construit à partir d'une URL `usdz` déjà validée par parseConfig (même origine), fragment encodé (`encodeURIComponent` du titre), aucun `javascript:` possible, attribut `rel="ar"` posé par setAttribute ; `<img>` src = vignette validée ; messages du calque en textContent ; aucune donnée sortante ; fuites de ressources (session non fermée, ancres, cibles de rendu).
Savoir-faire : /Users/alexandre/Documents/Alex Cerveau/DREAM/_outils/plugins/dream-team/skills/feature/SKILL.md (étape 6)
Contrôles : `npm test` (134/134) ; `npm audit --omit=dev` ; recherche de `innerHTML|outerHTML|insertAdjacentHTML|eval(|Function(|XMLHttpRequest|sendBeacon|localStorage|document.cookie|WebSocket|postMessage|fetch(` dans src/ (fetch seulement dans loader.js et piscine-ar.js).
Périmètre : lecture seule.
Fini quand : verdict `OK`, `À CORRIGER` (fichier:ligne → risque → correctif) ou `BLOQUANT`, résultat des contrôles.
Retour : verdict en une ligne, 3 puces max, preuves.

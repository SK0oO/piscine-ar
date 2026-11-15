Projet : piscine-ar — dépôt /Users/alexandre/piscine-ar (lis CLAUDE.md, puis docs/plans/2026-11-12-coeur-et-adaptateurs.md §13 en entier)
Étape : lot V5 « DA de Maxime » — relecture indépendante
Objectif : dire si le code respecte le §13 et les règles du dépôt, si les tests prouvent ce qu'ils annoncent, et si rien n'a cassé (plein écran caméra, télécommande, Quick Look, WebXR).
Savoir-faire : /Users/alexandre/Documents/Alex Cerveau/DREAM/_outils/plugins/dream-team/skills/feature/SKILL.md (étape 6)
Entrées : `git diff e0baa2a HEAD -- src demo vite.config.js docs/integration.md` (le code) ; `git show e0baa2a` (les tests) ; brief docs/briefs/V5-code.md. Ajouts hors plan signalés par le codeur : texte sur l'accent calculé (foncé ou blanc, le plus contrasté) sans `onAccent` ; sélecteur « Forme » dans demo/integree.html ; couleurs de config posées sur la racine du Shadow DOM.
Contrôles à relancer : `npm test` (attendu 310/310) ; `npm run test:browser` (attendu 134 passés, 6 ignorés) ; `npm run build`. Puis `git checkout -- models/out/`. Ne commite rien.
Points d'attention : jetons `--pa-*` sans masquer ceux de la page ; aucun chargement de police ou ressource externe par le composant (la page démo peut charger Google Fonts) ; classe `compact` : seuil, plein écran exclu, ResizeObserver libéré au `disconnectedCallback` ; attribut `modele` : valeur inconnue ignorée, pas de double chargement ni de `model-changed` en trop, course avec le chargement initial ; calcul du contraste du texte sur l'accent ; `prefers-reduced-motion` ; cibles ≥ 44 px et textes ≥ 16 px partout (accueil compact compris) ; aucun `innerHTML` ; tests existants modifiés seulement là où le §13 les contredit (`git show e0baa2a --stat`).
Périmètre : lecture seule.
Fini quand : verdict `OK`, `À CORRIGER` (fichier:ligne → attendu) ou `BLOQUANT`, commandes relancées et résultats.
Retour : verdict en une ligne, 3 puces max, preuves.

# Plan technique — cœur Three.js et trois adaptateurs (E3, E4, E5)

Source : plan.md §0–§7, recherche §3, §4, §6, CLAUDE.md du dépôt. Les décisions du brief E2 ne sont pas rouvertes.

**Feature** : le composant `<piscine-ar>` charge le JSON du pisciniste, choisit le mode (RA Android, caméra et gyroscope, ou sans caméra), affiche la piscine, la déplace, la tourne et la met à l'échelle au doigt, change de modèle en gardant la pose, fige une photo PNG et propose Quick Look sur iPhone.

**Hors périmètre** : le script unique de distribution (mode bibliothèque de Vite), la page démo, le QR code et le déploiement (E6) ; le changement de couleur d'eau en direct ; toute modification du générateur E1 ; toute modification de `vite.config.js` et `playwright.config.js` ; Scene Viewer ; Variant Launch, Zappar, 8th Wall ; tout envoi réseau autre qu'un GET de la config, d'un GLB, d'un USDZ, d'une PNG ou du logo.

## 1. Contrats

**Erreurs** (`src/core/erreurs.js`) : `PiscineArError extends Error { code }`. Codes : `config-invalide`, `camera-refusee`, `camera-indisponible`, `modele-introuvable`, `modele-invalide`, `webxr-echec`, `photo-indisponible`, `photo-echec`.

**Pose** (`src/core/pose.js`) : `Pose = { position:{x,y,z} en mètres, y = sol ; rotationY en radians, normalisée dans [-π, π[ ; scale dans [0,5 ; 2], 1 = échelle réelle }`. Ce sont des objets simples, pas des `Vector3`.
- `createPoseStore({ echelleLibre, initiale })` renvoie `{ get() (copie), setPosition(p), rotateBy(dRad), scaleBy(facteur) }`.
- `scaleBy` borne l'échelle entre 0,5 et 2 et ne fait rien si `echelleLibre` vaut false (Android).
- `POSE_DEPART = { position:{0,0,-6}, rotationY:0, scale:1 }`. Les constantes `ECHELLE_MIN`, `ECHELLE_MAX` et `POSE_DEPART` sont exportées et réglées au terrain E6.

**Pose partagée** : le cœur crée une seule réserve de pose et la donne à l'adaptateur.
- `place()` écrit la position ; la rotation et l'échelle passent par les gestes du cœur.
- Changer de modèle remplace seulement l'enfant du groupe pivot ; la transformation du pivot (donc la pose) ne bouge pas.
- `scale` multiplie la taille réelle du modèle : la piscine 2 à l'échelle 1 reste à l'échelle 1.

**Adaptateur** : `createXxxAdaptateur(deps)`.
- `deps = { renderer, stage, pose, hote, calque, video|null, env:{navigator, window, document}, rendre(camera), surFin(raison) }`.
- `calque` est un élément du Shadow DOM réservé aux messages et boutons propres à l'adaptateur.

| Membre | Contrat |
|---|---|
| `start(): Promise<void>` | Appelé dans le geste. Tout appel qui exige ce geste (`requestPermission`, `getUserMedia`, `play`, `requestSession`) part de façon synchrone, avant le premier `await`. Un second `start()` pendant que ça tourne n'ouvre rien de plus. |
| `stop(): Promise<void>` | Peut être appelé plusieurs fois sans effet de plus. Coupe les pistes caméra, la session, les écouteurs et `setAnimationLoop(null)`. |
| `place(x, y): Pose\|null` | x, y en px CSS relatifs à `hote`. Renvoie `null` (pose inchangée) si aucun sol n'est trouvé. |
| `getPose(): Pose` | Copie de `pose.get()`. |
| `onFrame(cb): () => void` | `cb({ time, camera })` à chaque image ; le cœur applique la pose puis fait le rendu. Renvoie la fonction de désabonnement. |
| Ajout `mode` | `'webxr'`, `'camera-gyro'`, `'sans-camera'` ou `'quicklook'`. |
| Ajout `capacites` | `{ echelle:boolean, photo:boolean }`. |
| Ajout `capturer({largeur, hauteur}): Promise<Blob PNG>` | Rejette `photo-indisponible` si `capacites.photo` vaut false. |
| Ajout `setModele(modele, racine)` | Appelé par le cœur après chaque changement réussi. Ne fait rien en caméra-gyro ; reconstruit l'occludeur en RA ; met à jour le `href` pour Quick Look. |

**Choix du mode** (`src/adapters/choisir.js`) : `choisirMode(env)` renvoie `Promise<{ mode, quicklook:boolean }>`.
- Si `await env.navigator.xr?.isSessionSupported('immersive-ar')` (une exception vaut false) : `'webxr'`.
- Sinon, si `mediaDevices.getUserMedia` existe : `'camera-gyro'`.
- Sinon : `'sans-camera'`.
- `quicklook = document.createElement('a').relList.supports('ar')` ; jamais affiché en mode `webxr`.
- Si `start()` en RA échoue : événement d'erreur `webxr-echec`, puis bascule automatique en `camera-gyro`.
- Si la caméra est refusée : erreur `camera-refusee`, écran « Réessayer » ou « Voir sans caméra » (`sans-camera` = même adaptateur, `video:null`, fond `#0f1419`).

**Caméra-gyro** :
- Appel caméra : `getUserMedia({ video:{ facingMode:{ ideal:'environment' } }, audio:false })`.
- Si `DeviceOrientationEvent.requestPermission` vaut `'denied'` ou n'existe pas : regard fixe, `beta = 75°`.
- Si `play()` est rejeté : bouton « Lancer la caméra ».
- Caméra à 1,5 m, sol virtuel à y = 0. `place` lance un rayon vers ce plan.
- `orientationToQuaternion(alpha, beta, gamma, angleEcran, alphaRef)`, fonction pure dans `src/adapters/orientation.js`. Calcul de DeviceOrientationControls : euler YXZ (beta, alpha − alphaRef, −gamma), multiplié par −90° autour de X puis par −angleEcran autour de Z. `alphaRef` est le premier alpha reçu.
- Capture : `composePhoto({ fond:video|null, glCanvas, rendre, largeur, hauteur, couleurFond })`. On dessine la vidéo recadrée comme `object-fit: cover` (`coverRect`), puis on fait `rendre()` et on dessine le canvas WebGL dans la même tâche. `preserveDrawingBuffer:false`.
- Taille de la photo : `round(hote.clientWidth × dpr)` × `round(hote.clientHeight × dpr)`.

**WebXR** :
- `requestSession('immersive-ar', { requiredFeatures:['local','hit-test'], optionalFeatures:['anchors','dom-overlay','camera-access'], domOverlay:{ root: hote } })`.
- Réticule fixé sur le centre de l'écran. `place` prend d'abord le hit-test « transient input » (`generic-touchscreen`), sinon celui du réticule. Il crée une ancre et supprime l'ancre précédente ; sans ancres, il utilise directement la pose du hit.
- Les événements `select` sont ignorés : le cœur passe par `place` seulement.
- Messages dans `calque` : « Balayez le sol », puis après 5 s sans sol « Visez une zone contrastée », plus un bouton « Recentrer ».
- `capacites = { echelle:false, photo: session.enabledFeatures inclut 'camera-access' }`.
- `surFin('session-terminee')` sur l'événement `end`.

**Occludeur** (`src/core/occluder.js`) : `buildOccluder(racine)` renvoie `{ occludeur, ombre }`.
- Plan de 40 × 40 m à y = −0,001, percé du contour extérieur de la face haute du maillage `margelle` (arêtes de bord des triangles à y ≈ 0, boucle d'aire maximale).
- `occludeur` : `colorWrite:false`, `depthWrite:true`, `renderOrder:-1`.
- `ombre` : même géométrie, `ShadowMaterial` d'opacité 0,25.
- Sans `margelle` : erreur `modele-invalide`.

**Changement de modèle** (`src/core/models.js`) : `createModelSwitcher({ pivot, charger })` renvoie `{ selectionner(modele): Promise<{id, dimensions:{longueur, largeur}}|null>, courant() }`.
- Le dernier appel gagne : un chargement dépassé est jeté et libéré, et sa promesse donne `null`.
- Même id que le modèle courant : rien n'est rechargé.
- En cas d'échec : le modèle courant reste, erreur `modele-introuvable`.
- L'ancien modèle est libéré (`dispose`).
- Dimensions tirées de la boîte englobante du nœud `eau` (contrat E1), sinon de la racine.
- `src/core/loader.js` : `chargerGlb(url) → Promise<Object3D>`, une couche mince sur GLTFLoader, sans cache.

**Gestes** (`src/core/gestures.js`) : `createGestureTracker()`.
- En entrée : `{type:'down'|'move'|'up'|'cancel', id, x, y}`. En sortie : la liste des intentions `{type:'deplacer', x, y}`, `{type:'tourner', dRad}` et `{type:'pincer', facteur}`.
- Un doigt : `deplacer`, à l'appui et à chaque mouvement.
- Deux doigts : angle et distance entre les doigts. Le sens horaire à l'écran donne `dRad` négatif. L'angle est déroulé au passage de ±π.
- Après un geste à deux doigts, le doigt qui reste est ignoré jusqu'à ce que tous les doigts soient levés.
- Les gestes sont écoutés sur une surface transparente du Shadow DOM (`touch-action:none`), pas sur le canvas, pour marcher aussi en DOM overlay.

**Quick Look** : `urlQuickLook(usdz, { titre })` renvoie `usdz + '#allowsContentScaling=0&callToAction=Revenir%20au%20site&checkoutTitle=' + encodeURIComponent(titre)`.
- `supporte(document)`.
- L'adaptateur crée dans `calque` un `<a rel="ar">` qui contient exactement une `<img>` (la vignette).
- `start()` fait `a.click()`. `place` renvoie `null`. `capacites` est entièrement à false. `capturer` rejette.
- Un modèle sans `usdz` cache le lien.

**JSON du pisciniste** (`src/config/config.js`) : `parseConfig(json, { configUrl, originesAutorisees })` renvoie une config normalisée, ou lève `config-invalide` avec le champ fautif dans le message.

```
{ "version": 1,
  "pisciniste": { "nom": string, "logo": url|null },
  "couleurs": { "accent": "#rrggbb" }?,
  "textes": { <clé connue>: string }?,
  "modeles": [ { "id": /^[a-z0-9-]+$/ unique, "nom": string, "glb": url, "usdz": url?, "vignette": url } ] (au moins 1),
  "modeleParDefaut": id? (sinon le premier) }
```

- Les URL sont résolues par rapport à `configUrl`, et leur origine doit être dans `[location.origin, origine de import.meta.url]`.
- Les clés de `textes` inconnues sont ignorées.
- Les textes ne vont que dans `textContent`, jamais dans `innerHTML`.
- La config est chargée par `fetch(url, { credentials:'omit' })`.

**Élément** :
- Attribut `config` (obligatoire), Shadow DOM `open`, propriété lecture seule `pose` (copie).
- `disconnectedCallback` appelle `stop()` et libère les URL d'objets.
- Tous les événements partent avec `bubbles:true, composed:true` :
  - `piscine-ar:ready` `{mode, modele, quicklook}` : à chaque démarrage réussi d'un mode, après la première image avec le modèle.
  - `piscine-ar:model-changed` `{modele, pose}` : à chaque changement réussi, sauf le premier chargement.
  - `piscine-ar:photo` `{blob, largeur, hauteur, modele}` : une seule fois par « Figer » (un second appui pendant le gel est ignoré).
  - `piscine-ar:error` `{code, message}`.
- « Enregistrer » télécharge `piscine.png` (`<a download>` vers une URL d'objet). « Reprendre » libère cette URL.
- Les barres de l'interface appellent `preventDefault()` sur `beforexrselect`.

## 2. Fichiers → lot → écrivain (un écrivain par fichier)

| Fichier | Lot | Écrivain | Ce qu'il fait |
|---|---|---|---|
| src/core/erreurs.js | A1 | dev-code | `PiscineArError` et les codes |
| src/core/pose.js | A1 | dev-code | réserve de pose, bornes |
| src/core/gestures.js | A1 | dev-code | pointeurs → intentions |
| src/core/stage.js | A1 | dev-code | scène, caméra (fov 60°), lumières, pivot, `appliquerPose` (sans WebGL) |
| src/core/models.js | A1 | dev-code | changement de modèle |
| src/core/capture.js | A1 | dev-code | `coverRect` (pur), `composePhoto` |
| src/config/config.js | A1 | dev-code | `parseConfig` |
| src/adapters/choisir.js | A1 | dev-code | `choisirMode` |
| src/adapters/orientation.js | A1 | dev-code | `orientationToQuaternion` |
| src/ui/format.js | A1 | dev-code | `formatMetres(l, L, scale)` → « 8,0 × 4,0 m » |
| src/core/loader.js | A2 | dev-code | GLTFLoader, couche mince |
| src/core/renderer.js | A2 | dev-code | WebGLRenderer (alpha, antialias) |
| src/adapters/camera-gyro.js | A2 | dev-code | caméra-gyro et sans-caméra |
| src/ui/piscine-ar.js | A2 | dev-code | élément, écrans, câblage, événements |
| src/ui/vues.js | A2 | dev-code | construction du DOM (`textContent` seulement) |
| src/ui/styles.js | A2 | dev-code | CSS : 16 px minimum, blanc sur fond sombre semi-opaque |
| src/ui/textes.js | A2 | dev-code | textes français par défaut |
| src/index.js | A2 | dev-code | `customElements.define` si l'élément n'existe pas encore |
| src/adapters/webxr.js | A2 bouchon, puis B | dev-code | A2 : `start` rejette `webxr-echec`. B : vrai adaptateur |
| src/core/occluder.js | B | dev-code | occludeur et ombre |
| src/adapters/quicklook.js | A2 bouchon, puis C | dev-code | A2 : `supporte` → false. C : vrai lien |
| tests/unit/*, tests/browser/* (specs, fakes/, fixtures/piscinier.json, pages/composant.html) | A1/A2/B/C | dev-testeur | voir §3 |

Fichiers sensibles qui déclenchent dev-securite à chaque lot : `src/adapters/*`, `src/ui/*`, `config.js`, `loader.js` (réseau).

## 3. Tests à écrire d'abord

### A1 — vitest, environnement node, sans DOM

1. `tests/unit/pose.test.js` :
   - l'échelle est bornée à 0,5 et 2 ;
   - `scaleBy` ne fait rien si `echelleLibre` vaut false ;
   - `rotationY` est normalisée (3π → −π) ;
   - `get()` renvoie une copie.
2. `tests/unit/gestures.test.js` :
   - un appui donne `deplacer` ;
   - tourner de 90° dans le sens horaire donne `dRad ≈ −π/2` à 0,01 près ;
   - écarter de 100 à 150 px donne `facteur ≈ 1,5` ;
   - le passage de ±π ne fait pas de saut ;
   - après deux doigts, le doigt restant est ignoré ;
   - `cancel` retire le pointeur.
3. `tests/unit/stage.test.js` : `appliquerPose` règle `pivot.position`, `rotation.y` et une échelle uniforme.
4. `tests/unit/models.test.js` (chargeur factice) :
   - la pose du pivot est identique avant et après le changement ;
   - même id : `charger` n'est pas appelé ;
   - A puis B avec A plus lent : B est attaché, A est libéré et renvoie `null` ;
   - en cas d'échec : `modele-introuvable` et le modèle précédent reste ;
   - les dimensions viennent du nœud `eau` (8 × 4).
5. `tests/unit/capture.test.js` : `coverRect` en 16/9 vers 9/19,5 donne un recadrage centré au bon ratio.
6. `tests/unit/config.test.js` :
   - la config valide est normalisée ;
   - un GLB d'une autre origine est refusé ;
   - un id en double est refusé ;
   - `modeles` vide est refusé ;
   - un `modeleParDefaut` inconnu est refusé ;
   - `version` différente de 1 est refusée ;
   - les clés de texte inconnues sont ignorées ;
   - une `accent` invalide est refusée.
7. `tests/unit/choisir.test.js` :
   - RA supportée → `webxr` ;
   - `isSessionSupported` qui lève une exception → `camera-gyro` ;
   - sans `getUserMedia` → `sans-camera` ;
   - `quicklook` reflète `relList.supports`.
8. `tests/unit/orientation.test.js` :
   - beta = 90 : regard ≈ (0, 0, −1) ;
   - beta = 0 : regard ≈ (0, −1, 0) ;
   - alpha = 200 au premier événement : regard toujours ≈ (0, 0, −1).
9. `tests/unit/format.test.js` : (8, 4, 1,5) → « 12,0 × 6,0 m ».

### A2 — vitest (faux) et Playwright

10. `tests/unit/camera-gyro.test.js` :
    - `requestPermission`, `getUserMedia` et `play` sont appelés de façon synchrone dès `start()`, avant tout `await` ;
    - `audio:false` et caméra arrière demandés ;
    - deux `start()` → un seul `getUserMedia` ;
    - `stop()` arrête les pistes et peut être appelé deux fois ;
    - `NotAllowedError` → `camera-refusee` ;
    - `place` au-dessus de l'horizon → `null` ;
    - `place` au centre en regardant vers le bas → y = 0.
11. `tests/browser/permission.spec.js` (projet iphone, `fakes/orientation.js` injecté avant le chargement) :
    - le texte d'explication s'affiche avant toute demande ;
    - « Autoriser » → un seul `requestPermission` et un seul `getUserMedia` ;
    - `ready` en mode `camera-gyro` en moins de 3 s ;
    - refus de la caméra → erreur `camera-refusee`, « Voir sans caméra » → `ready` en mode `sans-camera` ;
    - mouvement `denied` → toujours `camera-gyro` ;
    - `play` rejeté → bouton « Lancer la caméra ».
12. `tests/browser/gestes.spec.js` (PointerEvent synthétiques dans le Shadow DOM) :
    - glisser déplace la position de plus de 0,1 m ;
    - tourner change `rotationY` dans le bon sens ;
    - pincer ×1,5 → `scale` ≈ 1,5 et l'étiquette en mètres vaut l'étiquette de départ × 1,5 à 0,1 m près ;
    - pincer ×4 → `scale` = 2.
13. `tests/browser/modeles.spec.js` :
    - 3 vignettes ;
    - après un glisser, la vignette 2 → `model-changed` `haricot-7x3-5` avec la même pose et toujours un seul `getUserMedia` ;
    - appuis rapides 2 puis 3 → le dernier événement est `ovale-5x3`.
14. `tests/browser/photo.spec.js` :
    - « Figer » → blob `image/png` à la taille `clientWidth × dpr` ;
    - le pixel de coin est opaque ;
    - un second appui ne produit pas d'autre événement ;
    - « Enregistrer » → téléchargement `piscine.png` ;
    - « Reprendre » masque l'image.
15. `tests/browser/repli-webxr.spec.js` (projet android, `fakes/xr.js` : RA supportée, `requestSession` rejeté) : erreur `webxr-echec`, puis `ready` en mode `camera-gyro`.
16. `tests/browser/ui.spec.js` :
    - tous les textes font 16 px ou plus ;
    - `beforexrselect` sur une vignette donne `defaultPrevented` ;
    - pas de lien Quick Look sous Chromium ;
    - retirer l'élément termine les pistes caméra.
17. `tests/browser/reseau.spec.js` : sur une session complète (démarrage, gestes, changement, photo), toutes les requêtes sont des GET de même origine, sans POST ni cookie posé.

### B

18. `tests/unit/webxr.test.js` (faux `xr`, fausse session, faux `renderer.xr`) :
    - fonctionnalités exactes et `domOverlay.root === hote`, demandées de façon synchrone ;
    - rejet → `webxr-echec` ;
    - réticule caché sans sol, visible au premier hit, message « Balayez le sol » puis masqué ;
    - `place` crée une ancre et la pose suit l'ancre aux images suivantes ;
    - un second `place` supprime l'ancre précédente ;
    - sans ancres, la pose du hit est utilisée ;
    - `scale` reste à 1 ;
    - `setModele` laisse un seul `occludeur` dans la scène sans changer la pose ;
    - l'événement `end` déclenche `surFin` une seule fois et `setAnimationLoop(null)` ;
    - sans `camera-access` : `capacites.photo` à false et `capturer` rejette `photo-indisponible`.
19. `tests/unit/occluder.test.js` :
    - rayon vers le bas au centre : rien ne le coupe ;
    - à 15 m : touché ;
    - juste hors de la margelle : touché ;
    - sur la margelle : pas touché ;
    - forme en C : l'encoche est couverte (preuve qu'on n'utilise pas d'enveloppe convexe) ;
    - matériaux : `colorWrite` à false, `ShadowMaterial` pour l'ombre ;
    - sans margelle → `modele-invalide`.

### C

20. `tests/unit/quicklook.test.js` :
    - URL exacte (fragment, titre encodé) ;
    - `supporte` avec un faux document ;
    - une seule `<img>` dans le lien ;
    - `setModele` met à jour le `href` ;
    - modèle sans `usdz` : lien caché ;
    - `capturer` rejette.
21. `tests/browser/quicklook.spec.js` (`supports('ar')` forcé à true par un script injecté avant le chargement) :
    - le lien est visible en `camera-gyro` ;
    - son `href` se termine par `#allowsContentScaling=0…` ;
    - il change après un changement de modèle.

**Préalable** : `npm run generate` (sorties E1 dans `models/out/`) avant `npm run test:browser`. La page de test `tests/browser/pages/composant.html` pointe sur `fixtures/piscinier.json`, qui référence les 3 modèles E1.

## 4. Ordre des lots

1. **A1** : dev-testeur en ROUGE, puis dev-code, puis dev-testeur en VERT.
2. **Maquette V2** de l'interface validée par Alex.
3. **A2** : ROUGE, code, VERT, puis dev-relecteur et dev-securite en parallèle.
4. Ensuite **B et C** en parallèle (fichiers disjoints, aucun ne touche `piscine-ar.js`). Chacun suit la chaîne ROUGE, code, VERT, dev-relecteur et dev-securite.

À ta charge avant le lot A2 : ajouter dans CLAUDE.md, ligne « Contrats », les membres `mode`, `capacites`, `capturer`, `setModele`.

## 5. Risques et parade

1. **Photo en RA Android** : le flux caméra n'est pas dans la page.
   - Parade : `camera-access` demandé en option ; s'il est accordé, la composition se fait dans l'image RA (texture caméra et scène dans une cible de rendu, puis lecture des pixels).
   - Sinon : `capacites.photo` vaut false et « Figer » est masqué.
   - Le terrain E6 dit si la parade suffit ; sinon c'est une question pour Alex.
2. **Geste utilisateur perdu** sur iPhone (`requestPermission`, `play`) ou sur Android (`requestSession`).
   - Parade : ces appels partent avant tout `await` dans `start()`, ce que prouvent les tests 10 et 18.
   - Aucun Web Worker sur ce chemin.
3. **Ce que Playwright ne prouve pas** : vraie session RA, vrai Quick Look, type MIME USDZ (`model/vnd.usdz+zip`) sur GitHub Pages, `domOverlay.root` porté par un hôte à Shadow DOM, effet de la bannière « Revenir au site ».
   - Parade : toute la logique est dans des fonctions testées avec des faux.
   - Ces cinq points sont les premières lignes de la grille E6, vérifiées sur un vrai téléphone.

PLAN PRÊT

## 6. Précisions d'API fixées par les tests A1 (validées le 12/11/2026, font partie du contrat)

- `createGestureTracker().handle(evt)` renvoie un tableau d'intentions (vide si rien).
- `createStage()` renvoie `{ scene, camera, pivot, appliquerPose(pose) }`.
- `createModelSwitcher({ pivot, charger })` : `selectionner(modele)` appelle `charger(modele.glb)` ; `courant()` renvoie `{ id, dimensions }` ou `null`.
- `coverRect(srcW, srcH, dstW, dstH)` renvoie `{ sx, sy, sw, sh }` (recadrage source façon `object-fit: cover`).
- `orientationToQuaternion(alpha, beta, gamma, angleEcran, alphaRef)` prend des degrés et renvoie `{ x, y, z, w }`.
- `parseConfig` est synchrone (le `fetch` est fait par l'élément).
- `PiscineArError` vit dans `src/core/erreurs.js`.
- Dimensions : `longueur` = taille en X, `largeur` = taille en Z de la boîte englobante du nœud `eau`.

## 7. Noms d'interface fixés par les tests A2 (validés le 12/11/2026, font partie du contrat)

- `src/adapters/camera-gyro.js` exporte `createCameraGyroAdaptateur(deps)`. Orientation lue sur `deviceorientation` de `env.window`, angle d'écran via `env.window.screen.orientation.angle`, `requestPermission` lu sur `env.window.DeviceOrientationEvent` et appelé avant `getUserMedia` ; `play()` part de façon synchrone dans `start()` ; `stop()` fait `setAnimationLoop(null)` et retire les écouteurs.
- Shadow DOM : surface de gestes `[data-role="gestes"]` ; cote `[data-role="cote"]` (« 12,0 × 6,0 m ») ; vignettes `button[data-modele="<id>"]` dans l'ordre du JSON ; photo figée `img[data-role="photo"]` ; texte d'explication contenant « Rien n'est envoyé ».
- Boutons par texte visible : « Activer la caméra » (bouton de démarrage unique, tous modes), « Voir sans caméra », « Lancer la caméra », « Figer », « Enregistrer », « Reprendre ». Plus « Échelle réelle » (lot C) et « ↻ » recentrer.
- Événements : `detail.modele` = id (chaîne) ; `detail.mode` ∈ webxr | camera-gyro | sans-camera ; `model-changed.detail.pose` égal à `element.pose` ; `photo.detail = { blob, largeur, hauteur, modele }`.
- Tous les textes visibles, vignettes comprises, font 16 px au minimum (la maquette V2 à 14 px sur les vignettes est corrigée par cette règle).
- La page de test charge `/src/index.js` par import dynamique ; `src/index.js` doit définir l'élément à l'import.

## 8. Noms fixés par les tests B (validés le 12/11/2026) — liste complète en tête de tests/unit/fakes/xr.js

- Réticule : objet de `stage.scene` nommé `reticule`, `.visible`, placé à la position du hit.
- Messages du calque créés par `env.document.createElement`, texte en `textContent` : « Balayez le sol », « Visez une zone contrastée », bouton « Recentrer ». Le message « Visez une zone contrastée » apparaît à partir de 5 000 ms sans sol (seuil inclusif), mesuré avec `performance.now()`.
- Hit-tests : `requestReferenceSpace('viewer')`, `requestHitTestSource`, `requestHitTestSourceForTransientInput({ profile: 'generic-touchscreen' })` ; `place` utilise les résultats de la dernière image, hit tactile prioritaire. Ancre : `hit.createAnchor()`, suivie par `frame.getPose(ancre.anchorSpace, renderer.xr.getReferenceSpace())`, présence dans `frame.trackedAnchors` ; sans `anchors` dans `enabledFeatures`, pose du hit directe.
- Occludeur reconnu dans `stage.scene` par `material.colorWrite === false && renderOrder === -1` ; `setModele` n'en laisse qu'un.
- Le chargeur GLB refuse toute ressource externe (sécurité A2) : l'occludeur et l'ombre sont construits en géométrie native, jamais chargés.

## 9. Noms fixés par les tests C (validés le 12/11/2026)

- `src/adapters/quicklook.js` exporte `urlQuickLook(usdz, { titre })`, `supporte(document)` et `createQuickLookAdaptateur(deps)` avec `deps = { calque, env: { document }, rendre, surFin }`.
- Le lien est un `<a>` créé par `env.document.createElement('a')`, ajouté au `calque`, `setAttribute('rel', 'ar')`, propriétés `href` et `hidden`, contenant exactement une `<img>` (src = `modele.vignette`). `setModele(modele, racine)` lit `modele.usdz`, `modele.nom` (titre encodé) et `modele.vignette` ; sans `usdz`, `hidden = true`.
- `mode = 'quicklook'`, `capacites = { echelle: false, photo: false }`, `place` → null, `capturer` rejette `photo-indisponible`.
- Dans l'interface, le lien visible porte le texte « Échelle réelle » et reste visible en mode `camera-gyro` quand `supporte(document)` est vrai ; jamais en `webxr`.
- Tests navigateur : `workers: 1` (fausse caméra partagée).


## 10. Mise à jour du 13/11/2026 (retours V3 d'Alex, brief docs/briefs/V3-retours-alex.md)

- Le bouton photo s'appelle « Photo » (ex-« Figer »). L'action principale est « Fixer au sol » : sur iPhone, c'est le lien Quick Look (ex-« Échelle réelle ») vers `<id>-sol.usdz`, une dalle à ras du sol (margelle + eau à −0,02 + fond à −0,05) ; sur Android, un bouton qui appelle `fixerAuSol()` (pose au réticule du centre). Un seul bouton principal à la fois (`#majPrincipal`).
- Les mentions « Figer » et « Échelle réelle » des §7 et §9 sont remplacées par ces noms.

## 11. Lot M1 « matières réalistes » (14/11/2026, go d'Alex après le rapport de recherche)

Source : /Users/alexandre/Documents/Alex Cerveau/DREAM/1-Projets/Piscine-AR/recherche/reports/Réalisme et sol en AR piscine.md (§1, « Détail technique », recommandation n° 2). Constat d'Alex sur iPhone : « ça fait 3D mais très plat ». Cause établie : couleurs unies, aucune normal map, roughness uniforme, aucune AO. Le lot ne touche ni au sol, ni au figer, ni à l'effet enterré (lots suivants).

### 11.1 Ce qui change
- Chaque surface reçoit une **matière PBR** générée en procédural (règle 0 €, rien de téléchargé) : couleur de base (sRGB), normal map (convention OpenGL = celle de Three.js, PNG), roughness variée, AO. Pas de vertex colors, pas de lumière dans le fichier, pas d'ombre cuite (Quick Look fait l'ombre lui-même), **plus aucun `DoubleSide`** (RealityKit ne le gère pas).
- Trois matières : `pierre` (margelle : pierre claire, grain, pores, veines légères, joints tous les ~0,6 m, roughness 0,75–0,95), `mosaique` (parois, fond, escalier, plage : carreaux de 5 cm, joints de 4 mm, normal biseautée, roughness carreau ≈ 0,25 et joint ≈ 0,9 ; texture de couleur **quasi neutre en luminance** pour que `material.color` = couleur d'eau du JSON donne la teinte, comme aujourd'hui), `ondulations` (eau : normal map de rides, tuilable, 2 m de période ; matériau transparent, opacity 0,65, roughness 0,08, metalness 0, FrontSide, couleur d'eau).
- **UV en mètres partout** : ExtrudeGeometry et ShapeGeometry les donnent déjà (positions x,y) ; `bassinGeo` reçoit un attribut `uv` (u = longueur d'arc le long du contour, v = profondeur) ; les boîtes d'escalier reçoivent des UV à l'échelle de chaque face. Les textures fixent leur taille physique par `texture.repeat = 1 / tailleEnMetres` (pierre 1 m, mosaïque 0,5 m = 10 carreaux, eau 2 m). glTF : `KHR_texture_transform` (GLTFExporter l'écrit seul) ; USDZ : `UsdTransform2d` (un par matériau, c'est la limite Apple).
- **Export dans Chromium** (Playwright, déjà utilisé pour les vignettes) : GLTFExporter et USDZExporter ont besoin d'un canvas pour encoder les textures ; Node n'en a pas. `models/generate/index.js` sert la racine avec Vite, ouvre `models/generate/export.html`, qui construit les scènes (`buildPool`) et renvoie GLB + USDZ + USDZ sol en base64 ; Node écrit les fichiers. USDZExporter appelé avec `{ quickLookCompatible: true, maxTextureSize: 1024 }`.
- `buildPool` reste utilisable en Node (tests) : les textures sont des `DataTexture` construites depuis les tableaux RGBA de `textures.js` ; aucun canvas avant l'export.
- Budgets : GLB < 4 Mo (contrat), chaque USDZ < 5 Mo, textures ≤ 1024², couleur de base en JPEG (`texture.userData.mimeType = 'image/jpeg'`, lu par les deux exporteurs), normal et ORM en PNG, mosaïque et eau en 512² (motifs réguliers), pierre en 1024².
- Côté composant (Android) et page d'aperçu : `renderer.toneMapping = ACESFilmicToneMapping`, `scene.environment` = PMREM de `RoomEnvironment` (reflets sur l'eau et la pierre, en attendant `light-estimation`), et l'eau **bouge** : `animerEau(racine, dt)` fait défiler `normalMap.offset` du maillage `eau` (vitesse ≈ 0,03 m/s sur deux axes). Dans l'USDZ l'eau est immobile (USDZExporter n'exporte pas ça ; accepté).
- Page d'aperçu : sol vert herbe (bruit procédural) à la place du gris, pour que les vignettes montrent ce qu'Alex verra.

### 11.2 Fichiers → écrivain
| Fichier | Rôle | Écrivain |
|---|---|---|
| `models/generate/textures.js` (nouveau) | PRNG à graine, bruit de valeur tuilable, `pierre(taille)`, `mosaique(taille)`, `ondulations(taille)`, `hauteurVersNormale(h, force)`, `empaqueterORM(ao, rough, metal)` → `{ largeur, hauteur, data: Uint8Array RGBA }`, pur (sans Three, sans canvas) | dev-code |
| `models/generate/materiaux.js` (nouveau) | `creerMateriaux(params, couleurEau)` → `{ margelle, mosaique, mosaiqueClaire, fond, eau }` (MeshStandardMaterial avec DataTexture, repeat en mètres, colorSpace : map = SRGBColorSpace, autres = NoColorSpace, `wrapS/T = RepeatWrapping`, `userData.mimeType`), textures mises en cache par matière | dev-code |
| `models/generate/pool.js` | utilise `creerMateriaux`, UV sur `bassinGeo` et escalier, plus aucun DoubleSide, parois orientées vers l'intérieur | dev-code |
| `models/generate/export.html` + `export.js` (nouveaux) | page d'export : `window.exporter(params, options)` → `{ glb, usdz, usdzSol }` base64 | dev-code |
| `models/generate/index.js` | lance Vite + Chromium, appelle l'export, écrit les fichiers, puis les vignettes comme avant | dev-code |
| `demo/preview.js` | environnement PMREM, sol herbe, eau animée ; conserve les boutons de couleur d'eau (teinte par `material.color`) | dev-code |
| `src/core/renderer.js` | `toneMapping` ACESFilmic, `creerEnvironnement(renderer)` (PMREM RoomEnvironment, mis en cache, `dispose`) | dev-code |
| `src/core/models.js` | `animerEau(racine, dt)` exportée, pure Three (pas de DOM) | dev-code |
| `src/ui/piscine-ar.js` | `scene.environment = creerEnvironnement(renderer)` à l'activation ; `animerEau` appelée dans la boucle de rendu avec le delta | dev-code |
| `tests/unit/textures.test.js`, `tests/unit/materiaux.test.js`, ajouts dans `pool.test.js`, `generate.test.js`, `models.test.js` ; `tests/browser/matieres.spec.js` | contrat | dev-testeur |

### 11.3 Ce que les tests doivent prouver (dev-testeur, ROUGE d'abord)
- textures : déterministe (même graine → mêmes octets) ; tailles puissance de 2 ; **tuilable** (colonne 0 ≈ colonne n−1 et ligne 0 ≈ ligne n−1, écart moyen < 8/255) ; normal map : moyenne de B > 200, moyennes de R et G entre 118 et 138 ; roughness : écart-type > 0,04 et valeurs dans [0,05 ; 1] ; mosaïque : part de joints entre 10 % et 20 % de la surface ; pierre : luminance moyenne de la couleur de base > 0,6 (pierre claire).
- materiaux : chaque matériau a `map`, `normalMap`, `roughnessMap` (eau : `normalMap` seulement + `transparent`, `opacity` ∈ [0,55 ; 0,75], `roughness` ≤ 0,15) ; `map.colorSpace === SRGBColorSpace`, les autres `NoColorSpace` ; `repeat` cohérent avec la taille physique (pierre 1 m → repeat 1, mosaïque 0,5 m → repeat 2, eau 2 m → 0,5) ; aucun `side === DoubleSide` ; `mosaique.color` = couleur d'eau ; `map.userData.mimeType === 'image/jpeg'`.
- pool : tous les maillages ont un attribut `uv` ; étendue des UV du maillage `margelle` ≈ étendue en mètres (8,6 × 4,6 à 5 % près pour le rectangle) ; `bassin` : u va de 0 au périmètre (à 5 %), v de −profondeur à −épaisseur ; normales des parois du bassin pointent vers l'intérieur (produit scalaire avec (centre − point) > 0 pour > 95 % des sommets) ; tests existants intacts (triangles < 20 000, dimensions, noms).
- generate : GLB < 4 Mo, USDZ < 5 Mo chacun ; JSON du GLB : `images[]` non vide avec `mimeType` (jpeg et png présents), aucun `uri` externe, `KHR_texture_transform` dans `extensionsUsed`, `textures[]` ≥ 4 ; USDZ : archive zip contenant `textures/` (≥ 4 fichiers) et un `.usda` avec `UsdUVTexture`, `inputs:normal.connect`, `inputs:roughness.connect`, `subdivisionScheme = "none"`, et **aucun** `doubleSided = true` ; `-sol.usdz` idem.
- models : `animerEau(racine, 0.5)` déplace `normalMap.offset` du maillage `eau` d'environ 0,015 sur chaque axe ; sans maillage `eau` → ne lève pas.
- navigateur (`matieres.spec.js`) : le composant charge le vrai GLB texturé (`piscine-ar:ready`, aucune `piscine-ar:error`), `renderer.toneMapping` = ACESFilmic, `scene.environment` non nul en mode caméra, l'offset de l'eau change entre deux images.
- Vignettes 512² régénérées ; captures 1024² pour Alex dans `demo/captures/M1/` (3 modèles × vue 3/4) par `scripts/capture-page.mjs`.

### 11.4 Risques
- Poids : du bruit en PNG compresse mal → couleur en JPEG, normal/ORM en PNG, 512² pour les motifs réguliers ; test de taille bloquant.
- Quick Look et `repeat` : bug connu de l'ordre des opérations, d'où `quickLookCompatible: true` ; vérifier sur l'iPhone d'Alex que les carreaux font bien 5 cm.
- `material.color` × texture : glTF le fait (`baseColorFactor`), USDZExporter le fait par `inputs:scale` du `UsdUVTexture` ; test : le `.usda` contient un `inputs:scale` non blanc pour la mosaïque.
- Export dans Chromium : si le GPU logiciel manque, l'export n'a pas besoin de WebGL (encodage canvas 2D seulement) ; garder `--use-angle=swiftshader` pour les vignettes.

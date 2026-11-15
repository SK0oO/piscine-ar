# Intégrer piscine-ar sur un site de pisciniste

Deux choses à coller : UN script et UNE balise. Pas d'iframe.

## Les deux adresses

| Quoi | Adresse |
|---|---|
| Démo en ligne | `https://<compte>.github.io/piscine-ar/` (renvoie vers `demo/`) |
| Le script | `https://<compte>.github.io/piscine-ar/piscine-ar.js` |

`<compte>` est le compte GitHub qui héberge le dépôt (à remplir quand il existe). Tout est en HTTPS : la caméra l'exige.

## Où héberger le script (important)

Le script s'exécute **dans le site du pisciniste**, avec les mêmes droits que ses propres pages. Il ne faut donc jamais le charger depuis une adresse qui peut changer sans qu'on le sache.

Règle : **copier une version figée de `piscine-ar.js` et du dossier `models/out/` sur le site du pisciniste** (par exemple dans `/piscine-ar/`), et ne jamais pointer en direct vers `github.io`. L'adresse GitHub sert à la démo et à récupérer les fichiers, pas aux sites clients.

Si, exceptionnellement, le script doit rester hébergé ailleurs : utiliser un chemin versionné qui ne change jamais (`/v1.0.0/piscine-ar.js`) et ajouter sur la balise `integrity="sha384-…"` (empreinte calculée avec `openssl dgst -sha384 -binary piscine-ar.js | openssl base64 -A`) et `crossorigin="anonymous"`. Le navigateur refuse alors tout fichier modifié.

## Le code à coller

```html
<script type="module" src="/piscine-ar/piscine-ar.js"></script>
<piscine-ar config="/piscine-ar/pisciniste.json" style="display:block;width:100%;height:80vh"></piscine-ar>
```

- Le script est un seul fichier (Three.js inclus), rien d'autre à charger.
- La balise a besoin d'une taille : sans `width` et `height` (ou `aspect-ratio`), elle ne s'affiche pas.
- `config` : adresse du fichier JSON du pisciniste, relative à la page ou absolue.

## Le fichier JSON du pisciniste

```json
{
  "version": 1,
  "pisciniste": { "nom": "Piscines Dupont", "logo": null },
  "couleurs": { "accent": "#FFD23F", "onAccent": "#1B1600" },
  "textes": {},
  "modeles": [
    {
      "id": "rectangulaire-8x4",
      "forme": "rectangle",
      "nom": "Rectangulaire 8 × 4",
      "glb": "/piscine-ar/models/out/rectangulaire-8x4.glb",
      "usdz": "/piscine-ar/models/out/rectangulaire-8x4-sol.usdz",
      "vignette": "/piscine-ar/models/out/rectangulaire-8x4.png"
    }
  ],
  "modeleParDefaut": "rectangulaire-8x4"
}
```

| Champ | Règle |
|---|---|
| `version` | Toujours `1`. |
| `pisciniste.nom` | Texte affiché. |
| `pisciniste.logo` | Adresse d'une image, ou `null`. |
| `couleurs` | Facultatif. `accent`, `water`, `deep`, `sand`, `onAccent`, chacune en `#rrggbb`. Elles l'emportent sur les couleurs de la page (voir « Couleurs et polices »). Sans `onAccent`, le texte sur `accent` est le plus lisible du foncé `#1B1600` et du blanc. |
| `textes` | Facultatif. Remplace des textes par défaut ; les clés inconnues sont ignorées. |
| `modeles` | Au moins un. `id` : minuscules, chiffres et tirets, unique. `nom`, `glb` et `vignette` obligatoires. `usdz` facultatif (sans lui, pas de bouton « Fixer au sol » sur iPhone). Le `usdz` est la « dalle à ras du sol » `<id>-sol.usdz` produite par `npm run generate` : margelle, eau et fond sombre sans parois, point le plus bas à −0,05 m, car Apple pose le point le plus bas de l'objet sur le sol détecté. Le `glb` garde le bassin complet. |
| `modeles[i].forme` | Facultatif : `rectangle`, `ovale` ou `haricot`. Sert à l'attribut `modele` (voir plus bas). |
| `modeleParDefaut` | Facultatif : un `id` de la liste, sinon le premier. |

Les adresses (`glb`, `usdz`, `vignette`, `logo`) sont relatives au fichier JSON. Leur origine doit être celle de la page ou celle du script, sinon le composant refuse la config (erreur `config-invalide`). Exemple de la démo : `demo/config/pisciniste-demo.json`.

**iPhone (Quick Look supporté, pas de WebXR)** : l'accueil montre les vignettes de modèles et le bouton principal « Voir dans mon jardin », un lien Quick Look vers la dalle du modèle choisi (`<id>-sol.usdz`). L'iPhone reconnaît le sol et y place la piscine à sa vraie taille ; conseil au visiteur : dehors, en plein jour, visez le sol et attendez une seconde. Le lien secondaire « Aperçu caméra (sans suivi du sol) » lance l'ancien mode caméra et gyroscope (la caméra n'est demandée qu'à ce moment). Sur cet écran, `piscine-ar:ready` part avec `mode: 'quicklook'` et le modèle sélectionné, et `piscine-ar:model-changed` à chaque changement de vignette (`pose` = pose de départ). Ailleurs (Android, ou navigateur sans Quick Look), le flux « Activer la caméra » est inchangé.

Dans l'aperçu caméra, « Fixer au sol » est le bouton principal. Sur iPhone, il ouvre la visionneuse Apple (Quick Look) avec la dalle à ras du sol ; sur Android, il pose la piscine au centre de l'écran, dans la page. « Photo » reste le bouton secondaire.

**Taille dans la visionneuse Apple** : le lien n'impose pas d'échelle fixe (pas de `allowsContentScaling=0`). La piscine démarre à sa taille réelle (100 %) ; en intérieur, où la taille réelle est trop grande pour juger, on pince pour réduire, et Apple affiche le pourcentage pendant le pincement.

**Plein écran et télécommande (modes caméra)** : pendant l'aperçu caméra (iPhone) et la RA (Android), `<piscine-ar>` prend tout l'écran (classe `plein-ecran` posée sur l'hôte, `position: fixed`) et Safari ne défile plus sous le doigt. Le bouton « × » en haut à droite ferme le mode et rend la page. Un pavé à flèches en bas à droite déplace la piscine de 0,25 m par appui (← →, et ↑ ↓ dans la direction du regard de la caméra projetée au sol), la tourne de 15° (⟲ ⟳) et, hors RA Android, change la taille de ×1,1 ou ÷1,1 (+ −). Un appui long répète toutes les 120 ms. En RA Android, le déplacement est mémorisé comme décalage par rapport à l'ancre posée, donc il tient quand l'ancre se met à jour. Les gestes au doigt restent disponibles. Textes personnalisables : `fermer`, `teleGauche`, `teleDroite`, `teleAvant`, `teleArriere`, `teleTournerGauche`, `teleTournerDroite`, `teleAgrandir`, `teleReduire`.

## Couleurs et polices : le composant prend celles de la page

Le composant ne charge aucune police et ne fixe pas la marque : il lit les variables CSS posées sur `:root` par la page, comme le fait la maquette du site pisciniste (Sites Habitat). Elles traversent le Shadow DOM.

| Variable de la page | Rôle dans le composant | Repli (palette « lagon ») |
|---|---|---|
| `--accent` | Bouton principal (pilule), touche appuyée, vignette choisie, contour de focus | `#FFD23F` |
| `--on-accent` | Texte du bouton principal | `#1B1600` |
| `--deep` | Fond des écrans d'accueil | `#062A30` |
| `--on-deep` | Texte des écrans d'accueil | `#F2FBFA` |
| `--water` | Halo léger en haut de l'accueil | `#19B5C8` |
| `--sand` | Réservé | `#EFF5F2` |
| `--fd` | Police des titres (Bricolage Grotesque chez Maxime) | `"Bricolage Grotesque", "Avenir Next", system-ui` |
| `--fb` | Police du texte (Onest chez Maxime) | `"Onest", "Helvetica Neue", system-ui` |

Ordre de priorité : `couleurs` du JSON, puis variables de la page, puis repli. Sans la page de Maxime, ce sont les polices du système.

## Dans la boîte 4:3 de la maquette (accueil compact)

Quand la balise fait moins de 420 px de haut (et hors plein écran), l'accueil devient compact : la vignette du modèle courant en fond, le bouton principal (« Activer la caméra », ou « Voir dans mon jardin » sur iPhone) et le lien secondaire, en bas. Les 64 px du haut restent libres pour les onglets de la page. Ni titre, ni texte, ni vignettes de choix : le modèle vient du configurateur de la page, par l'attribut `modele`. Démo : `demo/integree.html`.

### Attributs posés par le configurateur

| Attribut | Effet |
|---|---|
| `modele` | Un `id` de modèle (`ovale-5x3`), ou une forme (`rectangle`, `ovale`, `haricot`) comparée au champ `forme` des modèles. Sélectionne ce modèle et émet `piscine-ar:model-changed`, comme un clic sur sa vignette. Valeur inconnue : ignorée. |
| `couleur`, `longueur`, `largeur` | Pas encore pris en compte : ignorés sans erreur. |

### Réglage dans `app.js` de la maquette

Dans l'objet `AR` du site (section « Module Piscine AR d'Alex ») :

```js
const AR = {
  src: '/piscine-ar/piscine-ar.js',      // le bundle, copié sur le site du pisciniste
  module: true,
  tag: 'piscine-ar',
  event: 'piscine-ar:photo',             // le nom de notre événement (detail.blob = la photo PNG)
  config: '/piscine-ar/pisciniste.json',
  // attrs() inchangé : il pose modele (« rectangle » ou « ovale »), longueur, largeur, couleur
};
```

Le site écoute l'événement sur `#arSlot` et lit déjà `detail.blob` : la photo rejoint la demande de visite sans autre changement. Les formes « Angles doux » et « Rectangle » donnent toutes deux `rectangle`.

## L'événement `piscine-ar:photo` et le bouton devis

Quand le visiteur touche « Photo », le composant émet `piscine-ar:photo` (une seule fois). `event.detail` contient `blob` (image PNG), `largeur`, `hauteur` et `modele`. La photo ne quitte pas le téléphone : c'est au site de décider quoi en faire.

```html
<img id="photo" alt="" hidden>
<button id="devis" hidden>Recevoir un devis avec cette photo</button>
<script>
  let photo = null;
  document.addEventListener('piscine-ar:photo', (e) => {
    photo = e.detail.blob;
    document.getElementById('photo').src = URL.createObjectURL(photo);
    document.getElementById('photo').hidden = false;
    document.getElementById('devis').hidden = false;
  });
  document.getElementById('devis').addEventListener('click', () => {
    // Ici : envoyer `photo` avec le formulaire de devis du site.
  });
</script>
```

Autres événements : `piscine-ar:ready` (`mode`, `modele`, `quicklook`), `piscine-ar:model-changed` (`modele`, `pose`), `piscine-ar:error` (`code`, `message`). Tous remontent jusqu'à `document`.

## À ne pas faire

- Pas d'iframe : la caméra et le gyroscope y sont bloqués ou non fiables sur iPhone.
- Pas de page en `http://` : la caméra est refusée. HTTPS seulement.
- Pas de fichiers `glb`, `usdz` ou `png` hébergés sur une autre origine que la page ou le script.
- Ne pas mettre la photo dans une URL, un cookie ou un outil de mesure sans accord du visiteur.

## Points à vérifier sur le terrain

- Le type MIME des `.usdz` doit être `model/vnd.usdz+zip` (Quick Look sur iPhone). GitHub Pages le déduit de l'extension, mais cela n'a pas pu être vérifié ici (pas de dépôt en ligne) : à contrôler à la première mise en ligne, par exemple `curl -sI <adresse du .usdz>` et lire `content-type`.
- Le fichier `.nojekyll` est ajouté par le build, pour que GitHub Pages serve tout tel quel.

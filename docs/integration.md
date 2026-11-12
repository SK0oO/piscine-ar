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
  "couleurs": { "accent": "#1f6f9f" },
  "textes": {},
  "modeles": [
    {
      "id": "rectangulaire-8x4",
      "nom": "Rectangulaire 8 × 4",
      "glb": "/piscine-ar/models/out/rectangulaire-8x4.glb",
      "usdz": "/piscine-ar/models/out/rectangulaire-8x4.usdz",
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
| `couleurs.accent` | Facultatif. Couleur `#rrggbb`. |
| `textes` | Facultatif. Remplace des textes par défaut ; les clés inconnues sont ignorées. |
| `modeles` | Au moins un. `id` : minuscules, chiffres et tirets, unique. `nom`, `glb` et `vignette` obligatoires. `usdz` facultatif (sans lui, pas de bouton « Échelle réelle » sur iPhone). |
| `modeleParDefaut` | Facultatif : un `id` de la liste, sinon le premier. |

Les adresses (`glb`, `usdz`, `vignette`, `logo`) sont relatives au fichier JSON. Leur origine doit être celle de la page ou celle du script, sinon le composant refuse la config (erreur `config-invalide`). Exemple de la démo : `demo/config/pisciniste-demo.json`.

## L'événement `piscine-ar:photo` et le bouton devis

Quand le visiteur touche « Figer », le composant émet `piscine-ar:photo` (une seule fois). `event.detail` contient `blob` (image PNG), `largeur`, `hauteur` et `modele`. La photo ne quitte pas le téléphone : c'est au site de décider quoi en faire.

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

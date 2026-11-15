// Champ de vision vertical affiché (lot V4b, plan §12.2). Pure : aucun accès au DOM.
export const CHAMP_CAMERA_LONG = 67; // degrés sur le grand côté de la vidéo (objectif principal 26 mm équivalent, capteur 4:3)

const RAD = Math.PI / 180;

// Champ vertical (degrés) d'une vidéo dont le grand côté couvre `champLong` degrés,
// affichée en « cover » dans un écran `ecranL × ecranH`. Renvoie null si une entrée n'est pas > 0.
export function champVertical({ videoL, videoH, ecranL, ecranH, champLong }) {
  for (const v of [videoL, videoH, ecranL, ecranH, champLong]) {
    if (!(Number.isFinite(v) && v > 0)) return null;
  }
  if (champLong >= 180) return null;
  const focale = Math.max(videoL, videoH) / 2 / Math.tan((champLong * RAD) / 2); // en pixels de vidéo
  const echelle = Math.max(ecranL / videoL, ecranH / videoH); // « cover »
  const hauteurVisible = ecranH / echelle; // pixels de vidéo vus en hauteur
  return (2 * Math.atan(hauteurVisible / 2 / focale)) / RAD;
}

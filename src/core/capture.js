import { PiscineArError } from './erreurs.js';

// Recadrage de la source façon `object-fit: cover`, centré.
export function coverRect(srcW, srcH, dstW, dstH) {
  const rs = srcW / srcH;
  const rd = dstW / dstH;
  if (rs > rd) {
    const sw = srcH * rd;
    return { sx: (srcW - sw) / 2, sy: 0, sw, sh: srcH };
  }
  if (rs < rd) {
    const sh = srcW / rd;
    return { sx: 0, sy: (srcH - sh) / 2, sw: srcW, sh };
  }
  return { sx: 0, sy: 0, sw: srcW, sh: srcH };
}

// Fond (vidéo recadrée ou couleur), puis rendu WebGL dessiné dans la même tâche.
// `canvas` : canvas 2D de sortie fourni par l'appelant (sinon un canvas neuf).
export async function composePhoto({ fond, glCanvas, rendre, largeur, hauteur, couleurFond, canvas }) {
  const sortie = canvas ?? globalThis.document?.createElement('canvas');
  if (!sortie) throw new PiscineArError('photo-echec', 'canvas indisponible');
  sortie.width = largeur;
  sortie.height = hauteur;
  const ctx = sortie.getContext('2d');
  if (!ctx) throw new PiscineArError('photo-echec', 'canvas 2D indisponible');
  ctx.fillStyle = couleurFond ?? '#0f1419';
  ctx.fillRect(0, 0, largeur, hauteur);
  if (fond && fond.videoWidth > 0) {
    const { sx, sy, sw, sh } = coverRect(fond.videoWidth, fond.videoHeight, largeur, hauteur);
    ctx.drawImage(fond, sx, sy, sw, sh, 0, 0, largeur, hauteur);
  }
  rendre();
  ctx.drawImage(glCanvas, 0, 0, largeur, hauteur);
  return new Promise((resolve, reject) => {
    sortie.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new PiscineArError('photo-echec', 'export PNG impossible'));
    }, 'image/png');
  });
}

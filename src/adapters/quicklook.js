import { PiscineArError } from '../core/erreurs.js';

const FRAGMENT = (action) => `#allowsContentScaling=0&callToAction=${encodeURIComponent(action)}&checkoutTitle=`;
const ACTION_DEFAUT = 'Revenir au site';

export function urlQuickLook(usdz, { titre, action = ACTION_DEFAUT }) {
  const base = String(usdz).split('#')[0]; // un fragment déjà présent annulerait les paramètres Quick Look
  return base + FRAGMENT(action) + encodeURIComponent(titre);
}

export function supporte(document) {
  try {
    return document.createElement('a').relList.supports('ar') === true;
  } catch {
    return false;
  }
}

// Lien Quick Look : un <a rel="ar"> avec une seule <img> (contrainte Apple), le libellé en texte à côté.
export function createQuickLookAdaptateur({ calque, env, libelle, action }) {
  const doc = env.document;
  const a = doc.createElement('a');
  a.setAttribute('rel', 'ar');
  a.hidden = true;
  const img = doc.createElement('img');
  img.setAttribute('alt', '');
  a.append(img);
  if (libelle) {
    a.setAttribute('aria-label', libelle);
    a.append(libelle);
  }
  calque.append(a);

  return {
    mode: 'quicklook',
    capacites: { echelle: false, photo: false },
    async start() {
      if (!a.hidden) a.click();
    },
    async stop() {},
    place: () => null,
    getPose: () => null,
    onFrame: () => () => {},
    capturer: () => Promise.reject(new PiscineArError('photo-indisponible', 'photo indisponible avec Quick Look')),
    setModele(modele) {
      if (!modele?.usdz) {
        a.hidden = true;
        return;
      }
      a.href = urlQuickLook(modele.usdz, { titre: modele.nom, action });
      img.setAttribute('src', modele.vignette ?? '');
      a.hidden = false;
    },
  };
}

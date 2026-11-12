import { PiscineArError } from '../core/erreurs.js';

const FRAGMENT = '#allowsContentScaling=0&callToAction=Revenir%20au%20site&checkoutTitle=';

export function urlQuickLook(usdz, { titre }) {
  const base = String(usdz).split('#')[0]; // un fragment déjà présent annulerait les paramètres Quick Look
  return base + FRAGMENT + encodeURIComponent(titre);
}

export function supporte(document) {
  try {
    return document.createElement('a').relList.supports('ar') === true;
  } catch {
    return false;
  }
}

// Lien Quick Look : un <a rel="ar"> avec une seule <img> (contrainte Apple), le libellé en texte à côté.
export function createQuickLookAdaptateur({ calque, env, libelle }) {
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
      a.href = urlQuickLook(modele.usdz, { titre: modele.nom });
      img.setAttribute('src', modele.vignette ?? '');
      a.hidden = false;
    },
  };
}

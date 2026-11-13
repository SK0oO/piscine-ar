import { describe, it, expect } from 'vitest';
import { createQuickLookAdaptateur, urlQuickLook, supporte } from '../../src/adapters/quicklook.js';
import { creerElementFactice } from './fakes/camera-gyro.js';
import { creerDocumentFactice, trouver } from './fakes/document.js';

// Noms fixés par le testeur (lot C), à respecter par dev-code :
//  - export urlQuickLook(usdz, { titre }) et supporte(document) (plan §1 « Quick Look ») ;
//  - export createQuickLookAdaptateur(deps), deps = { calque, env:{ document }, ... } ;
//  - setModele(modele, racine) lit modele.usdz, modele.nom (titre de la bannière) et modele.vignette (src de l'<img>) ;
//  - lien = élément <a> créé par env.document.createElement('a'), ajouté à `calque`, avec rel="ar" (attribut),
//    propriété `href` mise à jour, propriété `hidden` à true quand le modèle n'a pas d'usdz.
const FRAGMENT = '#callToAction=Revenir%20au%20site&checkoutTitle=';
const A = { id: 'rect', nom: 'Rectangulaire 8 × 4', usdz: 'https://exemple.invalid/rect.usdz', vignette: 'https://exemple.invalid/rect.png' };
const B = { id: 'ovale', nom: 'Ovale 5 & 3', usdz: 'https://exemple.invalid/ovale.usdz', vignette: 'https://exemple.invalid/ovale.png' };
const SANS_USDZ = { id: 'sans', nom: 'Sans usdz', vignette: 'https://exemple.invalid/sans.png' };

function creer() {
  const document = creerDocumentFactice();
  const calque = creerElementFactice();
  const adaptateur = createQuickLookAdaptateur({
    calque,
    env: { document, navigator: {}, window: {} },
    rendre: () => {},
    surFin: () => {},
  });
  return { adaptateur, calque, document };
}
const lien = (calque) => trouver(calque, 'a')[0];

describe('urlQuickLook : action personnalisée', () => {
  it("encode l'action d'appel (accueil iPhone : « Changer de modèle »)", () => {
    expect(urlQuickLook(A.usdz, { titre: 'T', action: 'Changer de modèle' }))
      .toBe(`${A.usdz}#callToAction=Changer%20de%20mod%C3%A8le&checkoutTitle=T`);
  });
  it("l'adaptateur applique l'action donnée au href", () => {
    const document = creerDocumentFactice();
    const calque = creerElementFactice();
    const adaptateur = createQuickLookAdaptateur({ calque, env: { document }, action: 'Changer de modèle' });
    adaptateur.setModele(A);
    expect(lien(calque).href).toContain('callToAction=Changer%20de%20mod%C3%A8le');
  });
});

describe('urlQuickLook', () => {
  it('retire un fragment déjà présent dans l\'URL du usdz', () => {
    const u = urlQuickLook('https://site.fr/p.usdz#x=1', { titre: 'T' });
    expect(u.split('#').length).toBe(2);
    expect(u.startsWith('https://site.fr/p.usdz#callToAction=')).toBe(true);
  });

  it('ajoute le fragment exact et encode le titre', () => {
    expect(urlQuickLook('https://exemple.invalid/rect.usdz', { titre: 'Ovale 5 & 3' })).toBe(
      `https://exemple.invalid/rect.usdz${FRAGMENT}${encodeURIComponent('Ovale 5 & 3')}`,
    );
  });

  it('encode les accents et les espaces du titre', () => {
    expect(urlQuickLook('/m.usdz', { titre: 'Forme libre 7 × 3,5' })).toBe(
      `/m.usdz${FRAGMENT}Forme%20libre%207%20%C3%97%203%2C5`,
    );
  });
});

describe('supporte', () => {
  it('vrai quand relList.supports("ar") est vrai', () => {
    expect(supporte(creerDocumentFactice({ supporteAr: true }))).toBe(true);
  });

  it('faux quand relList.supports("ar") est faux', () => {
    expect(supporte(creerDocumentFactice({ supporteAr: false }))).toBe(false);
  });
});

describe('createQuickLookAdaptateur', () => {
  it('annonce le mode quicklook et aucune capacité', () => {
    const { adaptateur } = creer();
    expect(adaptateur.mode).toBe('quicklook');
    expect(adaptateur.capacites).toEqual({ echelle: false, photo: false });
  });

  it('crée dans le calque un seul lien rel="ar" qui contient exactement une <img>', () => {
    const { adaptateur, calque } = creer();
    adaptateur.setModele(A, null);
    const liens = trouver(calque, 'a');
    expect(liens).toHaveLength(1);
    expect(liens[0].getAttribute('rel')).toBe('ar');
    expect(liens[0].children).toHaveLength(1);
    expect(liens[0].children[0].tagName).toBe('IMG');
    expect(trouver(liens[0], 'img')).toHaveLength(1);
  });

  it('setModele met le href à jour avec le fragment et le titre du modèle', () => {
    const { adaptateur, calque } = creer();
    adaptateur.setModele(A, null);
    expect(lien(calque).href).toBe(`${A.usdz}${FRAGMENT}${encodeURIComponent(A.nom)}`);
    adaptateur.setModele(B, null);
    expect(lien(calque).href).toBe(`${B.usdz}${FRAGMENT}${encodeURIComponent(B.nom)}`);
    expect(trouver(calque, 'a')).toHaveLength(1);
    expect(trouver(lien(calque), 'img')).toHaveLength(1);
  });

  it('un modèle sans usdz cache le lien, et un modèle avec usdz le réaffiche', () => {
    const { adaptateur, calque } = creer();
    adaptateur.setModele(SANS_USDZ, null);
    expect(lien(calque).hidden).toBe(true);
    adaptateur.setModele(A, null);
    expect(lien(calque).hidden).toBe(false);
    adaptateur.setModele(SANS_USDZ, null);
    expect(lien(calque).hidden).toBe(true);
  });

  it('place renvoie null', () => {
    const { adaptateur } = creer();
    expect(adaptateur.place(10, 10)).toBeNull();
  });

  it('capturer rejette avec le code photo-indisponible', async () => {
    const { adaptateur } = creer();
    await expect(adaptateur.capturer({ largeur: 100, hauteur: 100 })).rejects.toMatchObject({ code: 'photo-indisponible' });
  });
});

import { parseConfig } from '../config/config.js';
import { choisirMode } from '../adapters/choisir.js';
import { createCameraGyroAdaptateur } from '../adapters/camera-gyro.js';
import { createWebxrAdaptateur } from '../adapters/webxr.js';
import { supporte as quickLookSupporte, createQuickLookAdaptateur } from '../adapters/quicklook.js';
import { PiscineArError } from '../core/erreurs.js';
import { createStage } from '../core/stage.js';
import { createPoseStore, POSE_DEPART } from '../core/pose.js';
import { createGestureTracker } from '../core/gestures.js';
import { createModelSwitcher } from '../core/models.js';
import { chargerGlb } from '../core/loader.js';
import { createRenderer } from '../core/renderer.js';
import { formatMetres } from './format.js';
import { TEXTES } from './textes.js';
import { STYLES } from './styles.js';
import { vueExplication, vueMessage, vuePiscine, vueQuickLook } from './vues.js';

const CONFIG_TAILLE_MAX = 1024 * 1024; // 1 Mo
const CONFIG_DELAI_MS = 10_000;
const CHOIX_DELAI_MS = 2_000;
const IMAGE_DELAI_MS = 1_500;

// GET de la config, sans cookie, avec délai et plafond de taille avant JSON.parse.
async function lireConfig(url) {
  const invalide = (raison) => new PiscineArError('config-invalide', raison);
  try {
    const reponse = await fetch(url, { credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(CONFIG_DELAI_MS) });
    if (!reponse.ok) throw invalide(`configuration introuvable (${reponse.status})`);
    const lecteur = reponse.body.getReader();
    const morceaux = [];
    let total = 0;
    for (;;) {
      const { done, value } = await lecteur.read();
      if (done) break;
      total += value.length;
      if (total > CONFIG_TAILLE_MAX) {
        lecteur.cancel().catch(() => {});
        throw invalide('configuration trop volumineuse (1 Mo maximum)');
      }
      morceaux.push(value);
    }
    return JSON.parse(await new Blob(morceaux).text());
  } catch (e) {
    throw e instanceof PiscineArError ? e : invalide('configuration illisible');
  }
}

const attendre = (ms, valeur) => new Promise((resolve) => setTimeout(resolve, ms, valeur));

const masquer = (el, oui) => {
  if (!el) return;
  el.hidden = oui;
  el.style.display = oui ? 'none' : '';
};

export class PiscineAr extends HTMLElement {
  static observedAttributes = ['config'];

  #racine;
  #vie = 0; // change à chaque déconnexion : écarte les résultats asynchrones périmés
  #stage;
  #pose;
  #switcher;
  #config = null;
  #textes = TEXTES;
  #choix = null;
  #modelePret = null;
  #modeleEchec = false;
  #dimensions = null;
  #renderer = null;
  #observeur = null;
  #adaptateur = null;
  #quicklook = null;
  #accueil = null; // accueil iPhone : { vignettes, quicklook }
  #vue = null;
  #ecran = null;
  #occupe = false;
  #gele = false;
  #urlPhoto = null;

  constructor() {
    super();
    const ombre = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = STYLES;
    this.#racine = document.createElement('div');
    this.#racine.className = 'racine';
    ombre.append(style, this.#racine);
    this.#initialiser();
  }

  get pose() {
    return this.#pose.get();
  }

  connectedCallback() {
    this.#charger();
  }

  disconnectedCallback() {
    this.#liberer();
  }

  attributeChangedCallback(nom, ancien, nouveau) {
    if (this.isConnected && ancien !== null && ancien !== nouveau) {
      this.#liberer();
      this.#charger();
    }
  }

  // --- cycle de vie -------------------------------------------------------

  #initialiser() {
    this.#stage = createStage();
    this.#pose = createPoseStore({ echelleLibre: true });
    this.#switcher = createModelSwitcher({ pivot: this.#stage.pivot, charger: chargerGlb });
    this.#config = null;
    this.#textes = TEXTES;
    this.#choix = null;
    this.#modelePret = null;
    this.#modeleEchec = false;
    this.#dimensions = null;
    this.#adaptateur = null;
    this.#vue = null;
    this.#accueil = null;
    this.#ecran = null;
    this.#occupe = false;
    this.#gele = false;
  }

  #liberer() {
    this.#vie++;
    this.#adaptateur?.stop();
    if (this.#urlPhoto) URL.revokeObjectURL(this.#urlPhoto);
    this.#urlPhoto = null;
    this.#observeur?.disconnect();
    this.#observeur = null;
    this.#renderer?.dispose();
    this.#renderer?.forceContextLoss();
    this.#renderer = null;
    this.#racine.replaceChildren();
    this.#racine.style.removeProperty('--accent');
    this.#initialiser();
  }

  async #charger() {
    const vie = this.#vie;
    this.#montrerEcran(vueMessage(this.#textes.chargement));
    try {
      const attribut = this.getAttribute('config');
      if (!attribut) throw new PiscineArError('config-invalide', 'attribut config manquant');
      const configUrl = new URL(attribut, document.baseURI).href;
      const json = await lireConfig(configUrl);
      if (vie !== this.#vie) return;
      this.#config = parseConfig(json, {
        configUrl,
        originesAutorisees: [location.origin, new URL(import.meta.url).origin],
      });
      this.#textes = { ...TEXTES, ...this.#config.textes };
      if (this.#config.couleurs.accent) this.#racine.style.setProperty('--accent', this.#config.couleurs.accent);
      this.#lancerChargementModele();
      this.#choix = await Promise.race([
        choisirMode({ navigator, window, document }),
        attendre(CHOIX_DELAI_MS, { mode: 'camera-gyro', quicklook: false }),
      ]);
      if (vie !== this.#vie) return;
      this.#montrerExplication();
    } catch (e) {
      if (vie !== this.#vie) return;
      this.#signaler(e, 'config-invalide');
      this.#montrerEcran(vueMessage(this.#textes.erreurConfig));
    }
  }

  // --- événements et erreurs ----------------------------------------------

  #emettre(type, detail) {
    this.dispatchEvent(new CustomEvent(`piscine-ar:${type}`, { detail, bubbles: true, composed: true }));
  }

  // Jamais de donnée personnelle ni de détail interne dans l'événement.
  #signaler(e, codeParDefaut) {
    const typee = e instanceof PiscineArError;
    this.#emettre('error', { code: typee ? e.code : codeParDefaut, message: typee ? e.message : 'erreur inattendue' });
  }

  // --- écrans -------------------------------------------------------------

  #montrerEcran(ecran) {
    this.#ecran?.remove();
    this.#ecran = ecran;
    this.#racine.append(ecran);
  }

  // iPhone : Quick Look (reconnaît le sol) est le flux principal, hors WebXR et si le navigateur le supporte.
  #montrerAccueilQuickLook() {
    const vie = this.#vie;
    const vue = vueQuickLook({
      textes: this.#textes,
      config: this.#config,
      surVignette: (m) => {
        this.#accueil?.quicklook.setModele(m);
        this.#choisirModele(m);
      },
      surCamera: () => this.#activer(this.#choix.mode),
    });
    const quicklook = createQuickLookAdaptateur({ calque: vue.lienRA, env: { document }, libelle: this.#textes.voirDansJardin, action: this.#textes.changerModele });
    vue.lienRA.querySelector('a')?.classList.add('principal');
    const courant = this.#switcher.courant();
    const initial = this.#config.modeles.find((m) => m.id === (courant?.id ?? this.#config.modeleParDefaut));
    if (initial) quicklook.setModele(initial);
    this.#montrerEcran(vue.ecran);
    this.#accueil = { vignettes: vue.vignettes, quicklook };
    this.#majVignettes();
    this.#modelePret.then(() => {
      const modele = this.#switcher.courant();
      if (vie === this.#vie && this.#ecran === vue.ecran && modele) {
        this.#emettre('ready', { mode: 'quicklook', modele: modele.id, quicklook: true });
      }
    });
  }

  #montrerExplication(erreur) {
    this.#accueil = null;
    if (!erreur && this.#choix?.mode !== 'webxr' && quickLookSupporte(document)) {
      this.#montrerAccueilQuickLook();
      return;
    }
    const camera = this.#choix?.mode !== 'sans-camera';
    this.#montrerEcran(vueExplication({
      textes: this.#textes,
      config: this.#config,
      erreur,
      reessayer: Boolean(erreur),
      sansCamera: camera,
      surActiver: () => this.#activer(),
      surSansCamera: () => this.#activer('sans-camera'),
    }));
  }

  #retirerVue() {
    if (this.#urlPhoto) URL.revokeObjectURL(this.#urlPhoto);
    this.#urlPhoto = null;
    this.#adaptateur?.stop();
    this.#adaptateur = null;
    this.#quicklook = null;
    this.#vue?.racine.remove();
    this.#vue = null;
    this.#gele = false;
  }

  #retourAccueil() {
    this.#retirerVue();
    this.#occupe = false;
    this.#montrerExplication();
  }

  #echec(e) {
    if (!e.dejaSignale) this.#signaler(e, 'camera-indisponible');
    this.#retirerVue();
    this.#occupe = false;
    const messages = {
      'camera-refusee': this.#textes.erreurCameraRefusee,
      'camera-indisponible': this.#textes.erreurCameraIndisponible,
      'modele-introuvable': this.#textes.erreurModele,
      'modele-invalide': this.#textes.erreurModele,
    };
    this.#montrerExplication(messages[e.code] ?? this.#textes.erreurAffichage);
  }

  // --- modèles ------------------------------------------------------------

  #lancerChargementModele() {
    const defaut = this.#config.modeles.find((m) => m.id === this.#config.modeleParDefaut);
    this.#modeleEchec = false;
    this.#modelePret = this.#selectionner(defaut).catch(() => {
      this.#modeleEchec = true;
      return null;
    });
  }

  async #selectionner(modele) {
    const vie = this.#vie;
    try {
      const res = await this.#switcher.selectionner(modele);
      if (!res || vie !== this.#vie) return null;
      this.#dimensions = res.dimensions;
      this.#adaptateur?.setModele(modele, this.#stage.pivot.children[0] ?? null);
      this.#quicklook?.setModele(modele);
      this.#majPrincipal();
      this.#majCote();
      this.#majVignettes();
      return res;
    } catch (e) {
      if (vie === this.#vie) this.#signaler(e, 'modele-introuvable');
      throw e;
    }
  }

  async #choisirModele(modele) {
    const avant = this.#switcher.courant()?.id;
    let res;
    try {
      res = await this.#selectionner(modele);
    } catch {
      return; // déjà signalé ; le modèle courant reste
    }
    if (res && res.id !== avant) this.#emettre('model-changed', { modele: res.id, pose: this.#pose.get() });
  }

  #majVignettes() {
    const actif = this.#switcher.courant()?.id;
    for (const [id, b] of this.#vue?.vignettes ?? this.#accueil?.vignettes ?? []) b.setAttribute('aria-pressed', String(id === actif));
  }

  // Une seule action principale (bouton blanc) : « Fixer au sol » (lien Quick Look ou pose RA), sinon « Photo ».
  #majPrincipal() {
    const vue = this.#vue;
    if (!vue) return;
    const lien = vue.lienRA.querySelector('a');
    const quickLook = Boolean(this.#quicklook && lien && !lien.hidden);
    lien?.classList.toggle('principal', quickLook);
    vue.fixer.classList.toggle('principal', !vue.fixer.hidden);
    vue.figer.classList.toggle('principal', !quickLook && vue.fixer.hidden);
  }

  #majCote() {
    if (!this.#vue || !this.#dimensions) return;
    this.#vue.cote.textContent = formatMetres(this.#dimensions.longueur, this.#dimensions.largeur, this.#pose.get().scale);
  }

  // --- démarrage (appelé dans le geste de l'utilisateur : aucun await avant adaptateur.start()) ---

  #activer(modeDemande) {
    if (this.#occupe || !this.#choix) return;
    this.#occupe = true;
    if (this.#modeleEchec) this.#lancerChargementModele();
    const mode = modeDemande ?? this.#choix.mode;
    this.#retirerVue();

    let adaptateur;
    try {
      this.#renderer ??= createRenderer();
      this.#pose = createPoseStore({ echelleLibre: mode !== 'webxr', initiale: this.#pose.get() });
      const vue = vuePiscine({
        config: this.#config,
        textes: this.#textes,
        canvas: this.#renderer.domElement,
        avecVideo: mode === 'camera-gyro',
        surVignette: (m) => this.#choisirModele(m),
        surFiger: () => this.#figer(),
        surFixer: () => this.#adaptateur?.fixerAuSol?.(),
        surRecentrer: () => this.#recentrer(),
        surEnregistrer: () => this.#enregistrer(),
        surReprendre: () => this.#reprendre(),
      });
      this.#vue = vue;
      this.#racine.append(vue.racine);
      this.#brancherGestes(vue);
      this.#majCote();
      this.#majVignettes();
      this.#mesurer();
      this.#observeur ??= new ResizeObserver(() => this.#mesurer());
      this.#observeur.observe(this);

      const deps = {
        renderer: this.#renderer,
        stage: this.#stage,
        pose: this.#pose,
        hote: this,
        calque: vue.calque,
        video: vue.video,
        env: { navigator, window, document },
        rendre: () => this.#rendre(),
        surFin: () => {
          if (this.#adaptateur === adaptateur) this.#retourAccueil();
        },
        textes: this.#textes,
      };
      adaptateur = mode === 'webxr' ? createWebxrAdaptateur(deps) : createCameraGyroAdaptateur(deps);
      this.#adaptateur = adaptateur;
      const courant = this.#switcher.courant();
      const modeleCourant = courant && this.#config.modeles.find((m) => m.id === courant.id);
      // Le modèle par défaut s'est chargé pendant l'écran d'explication : l'adaptateur doit le connaître (occludeur en RA).
      if (modeleCourant) adaptateur.setModele?.(modeleCourant, this.#stage.pivot.children[0]);
      if (mode === 'camera-gyro' && quickLookSupporte(document)) {
        this.#quicklook = createQuickLookAdaptateur({ calque: vue.lienRA, env: { document }, libelle: this.#textes.voirEnRA });
        if (modeleCourant) this.#quicklook.setModele(modeleCourant);
        this.#majPrincipal();
      }
      this.#renderer.shadowMap.enabled = mode === 'webxr'; // seul le plan d'ombre de la RA reçoit des ombres
      adaptateur.onFrame(() => this.#rendre());
    } catch {
      this.#echec(new PiscineArError('modele-invalide', 'affichage 3D indisponible'));
      return;
    }
    this.#suite(adaptateur, mode, this.#vie);
  }

  async #suite(adaptateur, mode, vie) {
    const demarrage = adaptateur.start(); // la partie synchrone (permissions, caméra, lecture) part ici, dans le geste
    try {
      await demarrage;
      await this.#modelePret;
      if (vie !== this.#vie) return;
      const modele = this.#switcher.courant();
      if (!modele) throw Object.assign(new PiscineArError('modele-introuvable', 'modèle introuvable'), { dejaSignale: true });
      await new Promise((resolve) => {
        const fin = adaptateur.onFrame(() => {
          fin();
          resolve();
        });
        setTimeout(resolve, IMAGE_DELAI_MS);
      });
      if (vie !== this.#vie || this.#adaptateur !== adaptateur) return;
      // Capacités de l'adaptateur : pas de photo possible → « Photo » masqué ;
      // en RA le calque porte déjà « Recentrer » → le « ↻ » de la barre est masqué,
      // et « Fixer au sol » (pose au centre) devient l'action principale.
      const capacites = adaptateur.capacites ?? { echelle: true, photo: true };
      masquer(this.#vue.figer, !capacites.photo);
      masquer(this.#vue.recentrer, mode === 'webxr');
      masquer(this.#vue.fixer, mode !== 'webxr');
      this.#majPrincipal();
      this.#ecran?.remove();
      this.#ecran = null;
      this.#vue.racine.classList.remove('attente');
      this.#occupe = false;
      this.#emettre('ready', {
        mode: adaptateur.mode,
        modele: modele.id,
        quicklook: Boolean(this.#choix.quicklook && quickLookSupporte(document)),
      });
    } catch (e) {
      await adaptateur.stop().catch(() => {});
      if (vie !== this.#vie) return;
      if (mode === 'webxr') {
        this.#signaler(e, 'webxr-echec');
        this.#occupe = false;
        this.#activer('camera-gyro'); // hors geste : suffit sur Android
        return;
      }
      this.#echec(e);
    }
  }

  // --- rendu, taille, gestes ----------------------------------------------

  #rendre() {
    this.#stage.appliquerPose(this.#pose.get());
    this.#renderer.render(this.#stage.scene, this.#stage.camera);
  }

  #mesurer() {
    const l = this.clientWidth;
    const h = this.clientHeight;
    if (this.#renderer && l > 0 && h > 0) this.#renderer.setSize(l, h, false);
  }

  #brancherGestes(vue) {
    const suivi = createGestureTracker();
    const ecouter = (evenement, type) =>
      vue.gestes.addEventListener(evenement, (e) => {
        const r = this.getBoundingClientRect();
        const intentions = suivi.handle({ type, id: e.pointerId, x: e.clientX - r.left, y: e.clientY - r.top });
        for (const i of intentions) {
          if (i.type === 'deplacer') this.#adaptateur?.place(i.x, i.y);
          else if (i.type === 'tourner') this.#pose.rotateBy(i.dRad);
          else if (i.type === 'pincer') this.#pose.scaleBy(i.facteur);
        }
        if (intentions.length > 0) {
          vue.aide.hidden = true;
          this.#majCote();
        }
      });
    ecouter('pointerdown', 'down');
    ecouter('pointermove', 'move');
    ecouter('pointerup', 'up');
    ecouter('pointercancel', 'cancel');
  }

  #recentrer() {
    this.#pose.setPosition(POSE_DEPART.position);
    this.#pose.rotateBy(-this.#pose.get().rotationY);
    this.#adaptateur?.recentrer?.();
  }

  // --- photo --------------------------------------------------------------

  async #figer() {
    const adaptateur = this.#adaptateur;
    const vue = this.#vue;
    if (this.#gele || !adaptateur || !vue) return; // un second appui pendant le gel est ignoré
    this.#gele = true;
    vue.barre.hidden = true;
    const dpr = window.devicePixelRatio || 1;
    const largeur = Math.round(this.clientWidth * dpr);
    const hauteur = Math.round(this.clientHeight * dpr);
    const vie = this.#vie;
    try {
      const blob = await adaptateur.capturer({ largeur, hauteur });
      if (vie !== this.#vie || this.#vue !== vue) return;
      this.#urlPhoto = URL.createObjectURL(blob);
      vue.photo.src = this.#urlPhoto;
      vue.photo.hidden = false;
      vue.bandeau.hidden = false;
      vue.barrePhoto.hidden = false;
      this.#emettre('photo', { blob, largeur, hauteur, modele: this.#switcher.courant()?.id });
    } catch (e) {
      if (vie !== this.#vie) return;
      this.#gele = false;
      vue.barre.hidden = false;
      this.#signaler(e, 'photo-echec');
    }
  }

  #enregistrer() {
    if (!this.#urlPhoto) return;
    const lien = document.createElement('a');
    lien.href = this.#urlPhoto;
    lien.download = 'piscine.png';
    this.#racine.append(lien);
    lien.click();
    lien.remove();
  }

  #reprendre() {
    const vue = this.#vue;
    if (this.#urlPhoto) URL.revokeObjectURL(this.#urlPhoto);
    this.#urlPhoto = null;
    this.#gele = false;
    if (!vue) return;
    vue.photo.hidden = true;
    vue.photo.removeAttribute('src');
    vue.bandeau.hidden = true;
    vue.barrePhoto.hidden = true;
    vue.barre.hidden = false;
  }
}

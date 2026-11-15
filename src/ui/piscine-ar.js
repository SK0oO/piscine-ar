import { parseConfig } from '../config/config.js';
import { choisirMode } from '../adapters/choisir.js';
import { createCameraGyroAdaptateur } from '../adapters/camera-gyro.js';
import { createWebxrAdaptateur } from '../adapters/webxr.js';
import { supporte as quickLookSupporte, createQuickLookAdaptateur } from '../adapters/quicklook.js';
import { PiscineArError } from '../core/erreurs.js';
import { createStage } from '../core/stage.js';
import { createPoseStore, decalerSelonDirection, POSE_DEPART } from '../core/pose.js';
import { createGestureTracker } from '../core/gestures.js';
import { createModelSwitcher, animerEau } from '../core/models.js';
import { chargerGlb } from '../core/loader.js';
import { createRenderer, creerEnvironnement } from '../core/renderer.js';
import { formatMetres } from './format.js';
import { TEXTES } from './textes.js';
import { STYLES } from './styles.js';
import { vueExplication, vueMessage, vuePiscine, vueQuickLook } from './vues.js';

const CONFIG_TAILLE_MAX = 1024 * 1024; // 1 Mo
const CONFIG_DELAI_MS = 10_000;
const CHOIX_DELAI_MS = 2_000;
const IMAGE_DELAI_MS = 1_500;
const PAS_DEPLACEMENT_M = 0.25;
const PAS_ROTATION_RAD = (15 * Math.PI) / 180;
const PAS_ECHELLE = 1.1;
const REPETITION_MS = 120;
const COMPACT_MAX_PX = 420; // hauteur de l'hôte sous laquelle l'accueil passe en compact (boîte 4:3 de la page)

// Couleurs de la config du pisciniste → variables internes (priorité : config > page > repli lagon).
const VARIABLES_COULEURS = Object.freeze({ accent: '--pa-accent', water: '--pa-water', deep: '--pa-deep', sand: '--pa-sand', onAccent: '--pa-on-accent' });

// Texte lisible sur l'accent de la config quand `onAccent` manque : le plus contrasté du foncé de la palette et du blanc.
const FONCE_SUR_ACCENT = '#1B1600';
function luminance(hex) {
  const lin = (v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
}
function texteSurAccent(hex) {
  const l = luminance(hex);
  return (l + 0.05) / (luminance(FONCE_SUR_ACCENT) + 0.05) >= 1.05 / (l + 0.05) ? FONCE_SUR_ACCENT : '#FFFFFF';
}

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
  static observedAttributes = ['config', 'modele'];

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
  #dernierRendu = null;
  #observeur = null;
  #adaptateur = null;
  #quicklook = null;
  #accueil = null; // accueil iPhone : { vignettes, quicklook }
  #vue = null;
  #ecran = null;
  #occupe = false;
  #gele = false;
  #urlPhoto = null;
  #repetition = null; // minuteur d'appui long de la télécommande
  #apercu = null; // grande vignette de l'accueil (img), suit le modèle courant

  constructor() {
    super();
    const ombre = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = STYLES;
    this.#racine = document.createElement('div');
    this.#racine.className = 'racine';
    ombre.append(style, this.#racine);
    // Plein écran : Safari ne doit ni défiler ni zoomer sous le doigt (écouteur non passif, sinon preventDefault est ignoré).
    this.#racine.addEventListener('touchmove', (e) => {
      if (this.classList.contains('plein-ecran')) e.preventDefault();
    }, { passive: false });
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
    if (nom === 'modele') {
      if (ancien !== nouveau) this.#appliquerAttributModele();
      return;
    }
    if (this.isConnected && ancien !== null && ancien !== nouveau) {
      this.#liberer();
      this.#charger();
    }
  }

  // --- cycle de vie -------------------------------------------------------

  #initialiser() {
    this.#stage = createStage();
    this.#pose = createPoseStore({ echelleLibre: false });
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
    this.#apercu = null;
    this.#ecran = null;
    this.#occupe = false;
    this.#gele = false;
  }

  #liberer() {
    this.#vie++;
    this.#arreterRepetition();
    this.classList.remove('plein-ecran');
    this.#adaptateur?.stop();
    if (this.#urlPhoto) URL.revokeObjectURL(this.#urlPhoto);
    this.#urlPhoto = null;
    this.#observeur?.disconnect();
    this.#observeur = null;
    this.#renderer?.dispose();
    this.#renderer?.forceContextLoss();
    this.#renderer = null;
    this.#racine.replaceChildren();
    for (const nom of Object.values(VARIABLES_COULEURS)) this.#racine.style.removeProperty(nom);
    this.#initialiser();
  }

  async #charger() {
    const vie = this.#vie;
    this.#montrerEcran(vueMessage(this.#textes.chargement));
    // Taille de l'hôte suivie dès l'accueil : classe `compact` dans la boîte 4:3 de la page (plan §13.2).
    this.#observeur ??= new ResizeObserver(() => this.#mesurer());
    this.#observeur.observe(this);
    this.#mesurer();
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
      this.#appliquerCouleurs(this.#config.couleurs);
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

  #appliquerCouleurs(couleurs) {
    for (const [cle, nom] of Object.entries(VARIABLES_COULEURS)) {
      if (couleurs[cle]) this.#racine.style.setProperty(nom, couleurs[cle]);
    }
    if (couleurs.accent && !couleurs.onAccent) this.#racine.style.setProperty('--pa-on-accent', texteSurAccent(couleurs.accent));
  }

  // Attribut `modele` (contrat de la maquette) : id d'un modèle, ou forme (`rectangle`, `ovale`, `haricot`). Inconnu : null.
  #modeleDemande() {
    const valeur = this.getAttribute('modele');
    if (!valeur || !this.#config) return null;
    const modeles = this.#config.modeles;
    return modeles.find((m) => m.id === valeur) ?? modeles.find((m) => m.forme === valeur) ?? null;
  }

  // Changement de l'attribut après le chargement : comme un clic sur la vignette (model-changed émis).
  #appliquerAttributModele() {
    if (!this.#config || !this.#modelePret) return; // avant : lu par #charger
    const modele = this.#modeleDemande();
    if (!modele) return;
    this.#accueil?.quicklook.setModele(modele);
    const choix = this.#choisirModele(modele);
    if (!this.#switcher.courant()) this.#modelePret = choix.then(() => this.#switcher.courant());
  }

  // Modèle à montrer sur l'accueil : le courant, sinon celui demandé ou par défaut.
  #modeleAffiche() {
    const id = this.#switcher.courant()?.id ?? this.#modeleDemande()?.id ?? this.#config.modeleParDefaut;
    return this.#config.modeles.find((m) => m.id === id);
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
      modele: this.#modeleAffiche(),
      surVignette: (m) => {
        this.#accueil?.quicklook.setModele(m);
        this.#choisirModele(m);
      },
      surCamera: () => this.#activer(this.#choix.mode),
    });
    const quicklook = createQuickLookAdaptateur({ calque: vue.lienRA, env: { document }, libelle: this.#textes.voirDansJardin, action: this.#textes.changerModele });
    vue.lienRA.querySelector('a')?.classList.add('principal');
    const initial = this.#modeleAffiche();
    if (initial) quicklook.setModele(initial);
    this.#montrerEcran(vue.ecran);
    this.#apercu = vue.apercu;
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
    const vue = vueExplication({
      textes: this.#textes,
      config: this.#config,
      modele: this.#config && this.#modeleAffiche(),
      erreur,
      reessayer: Boolean(erreur),
      sansCamera: camera,
      surActiver: () => this.#activer(),
      surSansCamera: () => this.#activer('sans-camera'),
    });
    this.#montrerEcran(vue.ecran);
    this.#apercu = vue.apercu;
  }

  #retirerVue() {
    this.#arreterRepetition();
    this.classList.remove('plein-ecran');
    if (this.#urlPhoto) URL.revokeObjectURL(this.#urlPhoto);
    this.#urlPhoto = null;
    this.#adaptateur?.stop();
    this.#adaptateur = null;
    this.#quicklook = null;
    this.#vue?.racine.remove();
    this.#vue = null;
    this.#gele = false;
    this.#mesurer();
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

  // Premier modèle : celui de l'attribut `modele` s'il est connu (model-changed émis s'il diffère du défaut), sinon le défaut.
  #lancerChargementModele() {
    const demande = this.#modeleDemande();
    const defaut = demande ?? this.#config.modeles.find((m) => m.id === this.#config.modeleParDefaut);
    const vie = this.#vie;
    this.#modeleEchec = false;
    this.#modelePret = this.#selectionner(defaut).then((res) => {
      if (res && vie === this.#vie && res.id !== this.#config.modeleParDefaut) this.#emettre('model-changed', { modele: res.id, pose: this.#pose.get() });
      return res;
    }).catch(() => {
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
    const modele = actif && this.#config?.modeles.find((m) => m.id === actif);
    if (this.#apercu && modele && this.#apercu.getAttribute('src') !== modele.vignette) this.#apercu.src = modele.vignette;
  }

  // Une seule action principale (pilule --pa-accent) : « Fixer au sol » (lien Quick Look ou pose RA), sinon « Photo ».
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
      this.#stage.scene.environment = creerEnvironnement(this.#renderer);
      this.#pose = createPoseStore({ echelleLibre: false, initiale: this.#pose.get() });
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
        surFermer: () => this.#retourAccueil(),
        surTelecommande: (action, actif, unPas) => this.#telecommande(action, actif, unPas),
      });
      this.#vue = vue;
      this.classList.add('plein-ecran');
      this.#racine.append(vue.racine);
      this.#brancherGestes(vue);
      // Échelle bloquée à 100 % dans tous les modes : « + » et « − » gardent leur case dans la grille 3×3 mais restent invisibles.
      for (const b of [vue.plus, vue.moins]) {
        if (!b) continue;
        b.style.visibility = 'hidden';
        b.disabled = true;
        b.setAttribute('aria-hidden', 'true');
      }
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
        // V4a : Quick Look a besoin de la caméra et de la mémoire. Au clic (phase de capture, dans le geste, sans preventDefault),
        // on coupe caméra et rendu tout de suite ; la vue n'est retirée qu'après le clic, pour que le lien
        // soit encore dans la page quand le navigateur l'ouvre.
        vue.lienRA.querySelector('a')?.addEventListener('click', () => {
          if (this.#adaptateur !== adaptateur) return;
          adaptateur.stop();
          setTimeout(() => {
            if (this.#adaptateur === adaptateur) this.#retourAccueil();
          }, 0);
        }, { capture: true });
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
    const maintenant = performance.now();
    const dt = this.#dernierRendu === null ? 0 : Math.min((maintenant - this.#dernierRendu) / 1000, 0.1);
    this.#dernierRendu = maintenant;
    animerEau(this.#stage.pivot, dt);
    this.#stage.appliquerPose(this.#pose.get());
    this.#renderer.render(this.#stage.scene, this.#stage.camera);
  }

  #mesurer() {
    const l = this.clientWidth;
    const h = this.clientHeight;
    this.#racine.classList.toggle('compact', h > 0 && h < COMPACT_MAX_PX && !this.classList.contains('plein-ecran'));
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

  // --- télécommande -------------------------------------------------------

  // Direction horizontale du regard de la caméra (le « avant » de la télécommande).
  #directionCamera() {
    const camera = this.#stage.camera;
    camera.updateMatrixWorld(true);
    const m = camera.matrixWorld.elements;
    return { x: -m[8], z: -m[10] };
  }

  // Déplacement au sol. En RA, l'adaptateur garde le décalage relatif à l'ancre (sinon l'ancre ramènerait la piscine) ;
  // sinon on modifie directement la pose libre.
  #deplacer(avant, lateral) {
    const d = decalerSelonDirection(this.#directionCamera(), { avant, lateral });
    if (typeof this.#adaptateur?.deplacer === 'function') {
      this.#adaptateur.deplacer(d.x, d.z);
      return;
    }
    const p = this.#pose.get().position;
    this.#pose.setPosition({ x: p.x + d.x, y: p.y, z: p.z + d.z });
  }

  #pasTelecommande(action) {
    switch (action) {
      case 'gauche': this.#deplacer(0, -PAS_DEPLACEMENT_M); break;
      case 'droite': this.#deplacer(0, PAS_DEPLACEMENT_M); break;
      case 'avant': this.#deplacer(PAS_DEPLACEMENT_M, 0); break;
      case 'arriere': this.#deplacer(-PAS_DEPLACEMENT_M, 0); break;
      case 'tournerG': this.#pose.rotateBy(PAS_ROTATION_RAD); break; // sens antihoraire à l'écran : rotationY augmente
      case 'tournerD': this.#pose.rotateBy(-PAS_ROTATION_RAD); break;
      case 'plus': this.#pose.scaleBy(PAS_ECHELLE); break;
      case 'moins': this.#pose.scaleBy(1 / PAS_ECHELLE); break;
      default: return;
    }
    if (this.#vue) this.#vue.aide.hidden = true;
    this.#majCote();
  }

  #arreterRepetition() {
    clearInterval(this.#repetition);
    this.#repetition = null;
  }

  // Appui : un pas tout de suite, puis un pas toutes les 120 ms tant que le doigt reste. `unPas` : clavier, sans répétition.
  #telecommande(action, actif, unPas) {
    if (!actif) {
      this.#arreterRepetition();
      return;
    }
    this.#arreterRepetition();
    this.#pasTelecommande(action);
    if (!unPas) this.#repetition = setInterval(() => this.#pasTelecommande(action), REPETITION_MS);
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

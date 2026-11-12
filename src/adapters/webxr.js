import * as THREE from 'three';
import { PiscineArError } from '../core/erreurs.js';
import { buildOccluder } from '../core/occluder.js';
import { coverRect } from '../core/capture.js';
import { TEXTES } from '../ui/textes.js';

const DELAI_SOL_MS = 5000; // sans sol au-delà : « Visez une zone contrastée »
const DELAI_PHOTO_MS = 2000; // aucune image RA reçue : la photo échoue

// RA Android : session WebXR immersive-ar, réticule au centre, hit-tests, ancre, occludeur.
export function createWebxrAdaptateur(deps) {
  const { renderer, stage, pose, hote, calque, env, rendre } = deps;
  const textes = deps.textes ?? TEXTES;
  const abonnes = new Set();
  const capacites = { echelle: false, photo: false };

  let demarrage = null;
  let arrete = false;
  let fini = false;
  let session = null;
  let sourceReticule = null;
  let sourceTactile = null;
  let dernierReticule = null; // { hit, position }
  let dernierTactile = null;
  let ancre = null;
  let jetonAncre = 0;
  let solTrouve = false;
  let debut = 0;
  let message = null;
  let boutonRecentrer = null;
  let occlusion = null; // groupe { occludeur, ombre } dans la scène
  let photoEnAttente = null;

  const reticule = new THREE.Mesh(
    new THREE.RingGeometry(0.12, 0.16, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
  );
  reticule.name = 'reticule';
  reticule.visible = false;

  const echec = () => new PiscineArError('webxr-echec', 'session de réalité augmentée indisponible');

  // --- messages ------------------------------------------------------------
  const montrerMessage = (texte) => {
    if (!message) {
      message = env.document.createElement('p');
      message.setAttribute('class', 'pastille');
    }
    message.textContent = texte;
    if (!message.parent && !message.parentNode) calque.appendChild(message);
  };
  const cacherMessage = () => {
    message?.remove();
  };

  // --- occludeur -----------------------------------------------------------
  const retirerOcclusion = () => {
    if (!occlusion) return;
    stage.scene.remove(occlusion);
    const { occludeur, ombre } = occlusion.userData;
    occludeur.geometry.dispose();
    occludeur.material.dispose();
    ombre.material.dispose();
    occlusion = null;
  };

  // --- pose ----------------------------------------------------------------
  const supprimerAncre = () => {
    jetonAncre++;
    try { ancre?.delete(); } catch { /* ancre déjà perdue */ }
    ancre = null;
  };

  function poser(hit, position) {
    supprimerAncre();
    pose.setPosition({ x: position.x, y: position.y, z: position.z });
    if (session?.enabledFeatures?.includes('anchors') && typeof hit.createAnchor === 'function') {
      const moi = jetonAncre;
      Promise.resolve()
        .then(() => hit.createAnchor())
        .then((a) => {
          if (!a) return;
          if (moi !== jetonAncre || fini) {
            try { a.delete(); } catch { /* sans effet */ }
            return;
          }
          ancre = a;
        })
        .catch(() => {}); // pas d'ancre : la pose du hit reste en place
    }
    return pose.get();
  }

  // --- boucle --------------------------------------------------------------
  const lirePose = (resultat, espace) => {
    const p = resultat.getPose(espace)?.transform?.position;
    return p ? { x: p.x, y: p.y, z: p.z } : null;
  };

  function image(time, frame) {
    if (fini || !frame) return;
    const espace = renderer.xr.getReferenceSpace();
    if (!espace) return;

    // Hit-test du centre de l'écran (réticule).
    dernierReticule = null;
    const hits = sourceReticule ? frame.getHitTestResults(sourceReticule) : [];
    if (hits.length > 0) {
      const position = lirePose(hits[0], espace);
      if (position) dernierReticule = { hit: hits[0], position };
    }
    // Hit-test du toucher (prioritaire dans place()).
    dernierTactile = null;
    if (sourceTactile) {
      const entrees = frame.getHitTestResultsForTransientInput(sourceTactile);
      const entree = entrees.find((e) => e.results.length > 0);
      if (entree) {
        const position = lirePose(entree.results[0], espace);
        if (position) dernierTactile = { hit: entree.results[0], position };
      }
    }

    reticule.visible = dernierReticule !== null;
    if (dernierReticule) {
      const { x, y, z } = dernierReticule.position;
      reticule.position.set(x, y, z);
      solTrouve = true;
      cacherMessage();
    } else if (!solTrouve && performance.now() - debut >= DELAI_SOL_MS) {
      montrerMessage(textes.viserContraste);
    }

    // La pose suit l'ancre.
    if (ancre && frame.trackedAnchors?.has(ancre)) {
      const position = lirePose({ getPose: (e) => frame.getPose(ancre.anchorSpace, e) }, espace);
      if (position) pose.setPosition(position);
    }

    stage.appliquerPose(pose.get());
    if (occlusion) {
      occlusion.position.copy(stage.pivot.position);
      occlusion.rotation.copy(stage.pivot.rotation);
      occlusion.scale.copy(stage.pivot.scale);
    }
    const camera = renderer.xr.getCamera();
    for (const cb of [...abonnes]) cb({ time, camera });
    if (photoEnAttente) traiterPhoto(frame, espace, camera);
  }

  // --- photo (camera-access) ----------------------------------------------
  // Lit les pixels de l'image caméra et ceux de la scène dans l'image RA courante, puis les compose.
  // Non vérifiable sous Playwright : à valider sur un vrai téléphone (grille E6).
  function traiterPhoto(frame, espace, camera) {
    const { largeur, hauteur, resolve, reject, minuterie } = photoEnAttente;
    photoEnAttente = null;
    clearTimeout(minuterie);
    const garderReticule = reticule.visible;
    try {
      const gl = renderer.getContext();
      const vue = frame.getViewerPose(espace)?.views?.[0];
      if (!vue?.camera) throw new Error('pas de vue caméra');
      const liaison = new env.window.XRWebGLBinding(session, gl);
      const texture = liaison.getCameraImage(vue.camera);

      reticule.visible = false;
      rendre(camera);
      reticule.visible = garderReticule;

      const lireTexture = (largeurSrc, hauteurSrc) => {
        const fb = gl.createFramebuffer();
        const precedent = gl.getParameter(gl.FRAMEBUFFER_BINDING);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
        const px = new Uint8Array(largeurSrc * hauteurSrc * 4);
        gl.readPixels(0, 0, largeurSrc, hauteurSrc, gl.RGBA, gl.UNSIGNED_BYTE, px);
        gl.bindFramebuffer(gl.FRAMEBUFFER, precedent);
        gl.deleteFramebuffer(fb);
        return px;
      };
      const couche = renderer.xr.getBaseLayer?.() ?? session.renderState.baseLayer;
      const vp = couche?.getViewport?.(vue) ?? { x: 0, y: 0, width: renderer.domElement.width, height: renderer.domElement.height };
      const lireScene = () => {
        const precedent = gl.getParameter(gl.FRAMEBUFFER_BINDING);
        gl.bindFramebuffer(gl.FRAMEBUFFER, couche?.framebuffer ?? null);
        const px = new Uint8Array(vp.width * vp.height * 4);
        gl.readPixels(vp.x, vp.y, vp.width, vp.height, gl.RGBA, gl.UNSIGNED_BYTE, px);
        gl.bindFramebuffer(gl.FRAMEBUFFER, precedent);
        return px;
      };

      const toile = (l, h, px) => {
        const c = env.document.createElement('canvas');
        c.width = l;
        c.height = h;
        const ctx = c.getContext('2d');
        const donnees = ctx.createImageData(l, h);
        for (let y = 0; y < h; y++) { // OpenGL lit de bas en haut
          donnees.data.set(px.subarray((h - 1 - y) * l * 4, (h - y) * l * 4), y * l * 4);
        }
        ctx.putImageData(donnees, 0, 0);
        return c;
      };
      const fond = toile(vue.camera.width, vue.camera.height, lireTexture(vue.camera.width, vue.camera.height));
      const scene = toile(vp.width, vp.height, lireScene());

      const sortie = env.document.createElement('canvas');
      sortie.width = largeur;
      sortie.height = hauteur;
      const ctx = sortie.getContext('2d');
      const r = coverRect(fond.width, fond.height, largeur, hauteur);
      ctx.drawImage(fond, r.sx, r.sy, r.sw, r.sh, 0, 0, largeur, hauteur);
      ctx.drawImage(scene, 0, 0, scene.width, scene.height, 0, 0, largeur, hauteur);
      sortie.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new PiscineArError('photo-echec', 'export PNG impossible'))),
        'image/png',
      );
    } catch {
      reticule.visible = garderReticule;
      reject(new PiscineArError('photo-echec', 'photo impossible en RA'));
    }
  }

  // --- cycle de vie --------------------------------------------------------
  function nettoyer() {
    if (fini) return;
    fini = true;
    renderer.setAnimationLoop(null);
    session?.removeEventListener('end', surEnd);
    sourceReticule?.cancel?.();
    sourceTactile?.cancel?.();
    supprimerAncre();
    stage.scene.remove(reticule);
    retirerOcclusion();
    cacherMessage();
    boutonRecentrer?.remove();
    boutonRecentrer = null;
    if (photoEnAttente) {
      clearTimeout(photoEnAttente.minuterie);
      photoEnAttente.reject(new PiscineArError('photo-echec', 'session terminée'));
      photoEnAttente = null;
    }
    abonnes.clear();
  }

  function surEnd() {
    if (fini) return;
    const demande = !arrete;
    nettoyer();
    if (demande) deps.surFin('session-terminee');
  }

  function start() {
    if (demarrage) return demarrage;
    // requestSession part ici, dans le geste, avant tout await.
    let demande;
    try {
      demande = env.navigator.xr.requestSession('immersive-ar', {
        requiredFeatures: ['local', 'hit-test'],
        optionalFeatures: ['anchors', 'dom-overlay', 'camera-access'],
        domOverlay: { root: hote },
      });
    } catch {
      demarrage = Promise.reject(echec());
      return demarrage;
    }
    demarrage = (async () => {
      try {
        session = await demande;
      } catch {
        throw echec();
      }
      try {
        if (arrete) {
          await session.end();
          return;
        }
        session.addEventListener('end', surEnd);
        capacites.photo = Boolean(session.enabledFeatures?.includes('camera-access'));
        renderer.xr.setReferenceSpaceType('local');
        await renderer.xr.setSession(session);
        const viewer = await session.requestReferenceSpace('viewer');
        sourceReticule = await session.requestHitTestSource({ space: viewer });
        try {
          sourceTactile = await session.requestHitTestSourceForTransientInput({ profile: 'generic-touchscreen' });
        } catch {
          sourceTactile = null; // sans toucher : le réticule suffit
        }
        if (arrete || fini) return;
        stage.scene.add(reticule);
        debut = performance.now();
        montrerMessage(textes.balayerSol);
        boutonRecentrer = env.document.createElement('button');
        boutonRecentrer.setAttribute('class', 'btn');
        boutonRecentrer.setAttribute('type', 'button');
        boutonRecentrer.textContent = textes.recentrer;
        boutonRecentrer.addEventListener('click', () => recentrer());
        calque.appendChild(boutonRecentrer);
        renderer.setAnimationLoop(image);
      } catch {
        try { await session.end(); } catch { /* déjà terminée */ }
        nettoyer();
        throw echec();
      }
    })();
    return demarrage;
  }

  async function stop() {
    if (arrete) return;
    arrete = true;
    const s = session;
    nettoyer();
    try { await s?.end(); } catch { /* déjà terminée */ }
  }

  function place() {
    const choix = dernierTactile ?? dernierReticule;
    if (!choix || fini) return null;
    return poser(choix.hit, choix.position);
  }

  function recentrer() {
    if (dernierReticule && !fini) poser(dernierReticule.hit, dernierReticule.position);
  }

  return {
    mode: 'webxr',
    capacites,
    start,
    stop,
    place,
    getPose: () => pose.get(),
    onFrame(cb) {
      abonnes.add(cb);
      return () => abonnes.delete(cb);
    },
    capturer({ largeur, hauteur }) {
      if (!capacites.photo || fini) {
        return Promise.reject(new PiscineArError('photo-indisponible', 'photo indisponible en RA'));
      }
      if (photoEnAttente) return Promise.reject(new PiscineArError('photo-echec', 'photo déjà en cours'));
      return new Promise((resolve, reject) => {
        const minuterie = setTimeout(() => {
          photoEnAttente = null;
          reject(new PiscineArError('photo-echec', 'aucune image reçue'));
        }, DELAI_PHOTO_MS);
        photoEnAttente = { largeur, hauteur, resolve, reject, minuterie };
      });
    },
    setModele(modele, racine) {
      retirerOcclusion();
      if (!racine || fini) return;
      const { occludeur, ombre } = buildOccluder(racine);
      occlusion = new THREE.Group();
      occlusion.name = 'occlusion';
      occlusion.userData = { occludeur, ombre };
      occlusion.add(occludeur, ombre);
      stage.scene.add(occlusion);
    },
    recentrer,
  };
}

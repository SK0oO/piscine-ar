import * as THREE from 'three';
import { PiscineArError } from '../core/erreurs.js';
import { composePhoto } from '../core/capture.js';
import { TEXTES } from '../ui/textes.js';
import { orientationToQuaternion } from './orientation.js';
import { champVertical, CHAMP_CAMERA_LONG } from '../core/champ.js';

const BETA_FIXE = 75; // regard fixe si aucune orientation n'arrive (degrés)
const DISTANCE_MAX = 40; // m : au-delà, le rayon rase l'horizon et le point n'a plus de sens
const HAUTEUR_TELEPHONE = 1.4; // m : téléphone tenu en main
const FOV_DEFAUT = 60; // degrés, sans dimensions vidéo
const COULEUR_FOND = '#0f1419';
const REFUS = ['NotAllowedError', 'SecurityError', 'PermissionDeniedError'];

// Caméra + gyroscope (iPhone, et repli Android), ou fond uni si `video` vaut null (« sans caméra »).
export function createCameraGyroAdaptateur(deps) {
  const { renderer, stage, pose, hote, calque, video, env, rendre } = deps;
  const textes = deps.textes ?? TEXTES;
  const win = env.window;
  const camera = stage.camera;
  const abonnes = new Set();
  const rayon = new THREE.Raycaster();

  let demarrage = null;
  let arrete = false;
  let flux = null;
  let orientation = null; // { alpha, beta, gamma }
  let alphaRef = null;
  let boutonLancer = null;

  const surOrientation = (e) => {
    if (e.alpha == null || e.beta == null) return;
    orientation = { alpha: e.alpha, beta: e.beta, gamma: e.gamma ?? 0 };
    alphaRef ??= e.alpha;
  };

  const angleEcran = () => win.screen?.orientation?.angle ?? 0;

  const majCamera = () => {
    const o = orientation ?? { alpha: 0, beta: BETA_FIXE, gamma: 0 };
    const q = orientationToQuaternion(o.alpha, o.beta, o.gamma, angleEcran(), alphaRef ?? o.alpha);
    camera.quaternion.set(q.x, q.y, q.z, q.w);
    if (hote.clientWidth > 0 && hote.clientHeight > 0) {
      const aspect = hote.clientWidth / hote.clientHeight;
      let change = false;
      if (camera.aspect !== aspect) {
        camera.aspect = aspect;
        change = true;
      }
      const fov = video
        ? (champVertical({
            videoL: video.videoWidth,
            videoH: video.videoHeight,
            ecranL: hote.clientWidth,
            ecranH: hote.clientHeight,
            champLong: CHAMP_CAMERA_LONG,
          }) ?? FOV_DEFAUT)
        : FOV_DEFAUT;
      if (Math.abs(camera.fov - fov) > 1e-6) {
        camera.fov = fov;
        change = true;
      }
      if (change) camera.updateProjectionMatrix();
    }
    camera.updateMatrixWorld(true);
  };

  const image = (time) => {
    majCamera();
    for (const cb of [...abonnes]) cb({ time, camera });
  };

  const erreurCamera = (e) =>
    e instanceof PiscineArError
      ? e
      : REFUS.includes(e?.name)
        ? new PiscineArError('camera-refusee', 'accès à la caméra refusé')
        : new PiscineArError('camera-indisponible', 'caméra indisponible');

  const couperPistes = (f) => f?.getTracks?.().forEach((p) => p.stop());

  const proposerLancement = () => {
    if (boutonLancer || arrete) return;
    boutonLancer = env.document.createElement('button');
    boutonLancer.setAttribute('class', 'btn principal');
    boutonLancer.setAttribute('type', 'button');
    boutonLancer.textContent = textes.lancerCamera;
    boutonLancer.addEventListener('click', async () => {
      try {
        await video.play();
        boutonLancer?.remove();
        boutonLancer = null;
      } catch {
        // le bouton reste affiché : l'utilisateur peut réessayer
      }
    });
    calque.appendChild(boutonLancer);
  };

  function start() {
    if (demarrage) return demarrage;
    camera.position.y = HAUTEUR_TELEPHONE;

    // Tout ce qui exige le geste de l'utilisateur part ici, avant le premier await.
    win.addEventListener('deviceorientation', surOrientation);
    let permission = Promise.resolve('granted');
    const demander = win.DeviceOrientationEvent?.requestPermission;
    if (typeof demander === 'function') {
      try {
        permission = Promise.resolve(demander.call(win.DeviceOrientationEvent)).catch(() => 'denied'); // refusé : le regard reste fixe (aucun événement n'arrive)
      } catch {
        permission = Promise.resolve('denied');
      }
    }
    let ouverture = null;
    if (video) {
      try {
        ouverture = env.navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      } catch (e) {
        ouverture = Promise.reject(e);
      }
      // Premier play() dans le geste ; sans source il peut être avorté, c'est sans conséquence (second play() plus bas).
      Promise.resolve(video.play()).catch(() => {});
    }

    demarrage = (async () => {
      if (ouverture) {
        let obtenu;
        try {
          obtenu = await ouverture;
        } catch (e) {
          throw erreurCamera(e);
        }
        if (arrete) {
          couperPistes(obtenu);
          return;
        }
        flux = obtenu;
        video.srcObject = flux;
      }
      await permission;
      if (arrete) return;
      if (video) {
        try {
          await video.play();
        } catch {
          proposerLancement();
        }
      }
      if (!arrete) renderer.setAnimationLoop(image);
    })();
    return demarrage;
  }

  async function stop() {
    if (arrete) return;
    arrete = true;
    renderer.setAnimationLoop(null);
    win.removeEventListener('deviceorientation', surOrientation);
    couperPistes(flux);
    flux = null;
    if (video) {
      video.pause?.();
      video.srcObject = null;
    }
    boutonLancer?.remove();
    boutonLancer = null;
    abonnes.clear();
  }

  function place(x, y) {
    majCamera();
    const l = hote.clientWidth;
    const h = hote.clientHeight;
    if (!(l > 0 && h > 0)) return null;
    rayon.setFromCamera(new THREE.Vector2((x / l) * 2 - 1, -(y / h) * 2 + 1), camera);
    const { origin, direction } = rayon.ray;
    if (direction.y > -1e-3) return null; // au-dessus (ou presque à) l'horizon
    const t = (0 - origin.y) / direction.y;
    if (t > DISTANCE_MAX) return null;
    pose.setPosition({ x: origin.x + t * direction.x, y: 0, z: origin.z + t * direction.z });
    return pose.get();
  }

  return {
    mode: video ? 'camera-gyro' : 'sans-camera',
    capacites: { echelle: true, photo: true },
    start,
    stop,
    place,
    getPose: () => pose.get(),
    onFrame(cb) {
      abonnes.add(cb);
      return () => abonnes.delete(cb);
    },
    capturer({ largeur, hauteur }) {
      majCamera();
      return composePhoto({
        fond: video,
        glCanvas: renderer.domElement,
        rendre: () => rendre(camera),
        largeur,
        hauteur,
        couleurFond: COULEUR_FOND,
      });
    },
    setModele() {},
    // « ↻ » : le regard actuel devient le « droit devant ».
    recentrer() {
      if (orientation) alphaRef = orientation.alpha;
    },
  };
}


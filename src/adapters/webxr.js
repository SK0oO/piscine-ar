import { PiscineArError } from '../core/erreurs.js';

// BOUCHON du lot A2 : le vrai adaptateur WebXR arrive au lot B.
// start() fait partir requestSession dans le geste (comme le fera le vrai), puis échoue toujours.
export function createWebxrAdaptateur(deps) {
  const { pose, hote, env } = deps;
  return {
    mode: 'webxr',
    capacites: { echelle: false, photo: false },
    start() {
      const echec = () => new PiscineArError('webxr-echec', 'session de réalité augmentée indisponible');
      let demande;
      try {
        demande = env.navigator.xr.requestSession('immersive-ar', {
          requiredFeatures: ['local', 'hit-test'],
          optionalFeatures: ['anchors', 'dom-overlay', 'camera-access'],
          domOverlay: { root: hote },
        });
      } catch {
        return Promise.reject(echec());
      }
      return Promise.resolve(demande).then(
        (session) => Promise.resolve(session?.end?.()).catch(() => {}).then(() => { throw echec(); }),
        () => { throw echec(); },
      );
    },
    stop: () => Promise.resolve(),
    place: () => null,
    getPose: () => pose.get(),
    onFrame: () => () => {},
    capturer: () => Promise.reject(new PiscineArError('photo-indisponible', 'photo indisponible en RA')),
    setModele() {},
  };
}

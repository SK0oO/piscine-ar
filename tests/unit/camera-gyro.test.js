import { describe, it, expect } from 'vitest';
import { createCameraGyroAdaptateur } from '../../src/adapters/camera-gyro.js';
import { creerDepsCameraGyro } from './fakes/camera-gyro.js';

// API supposée : createCameraGyroAdaptateur(deps) (plan §1 « Adaptateur » et « Caméra-gyro »).
// L'orientation vient de l'événement `deviceorientation` de env.window ; la caméra se met à jour à chaque image
// (renderer.setAnimationLoop), donc les tests appellent renderer.tick() après avoir émis une orientation.
const vide = () => new Promise((r) => setTimeout(r, 0));
const noms = (journal) => journal.map((j) => j.nom);

async function demarre(options) {
  const f = creerDepsCameraGyro(options);
  const adaptateur = createCameraGyroAdaptateur(f.deps);
  await adaptateur.start();
  await vide();
  return { ...f, adaptateur };
}

describe('createCameraGyroAdaptateur', () => {
  it('annonce le mode camera-gyro et les capacités échelle + photo', () => {
    const { deps } = creerDepsCameraGyro();
    const a = createCameraGyroAdaptateur(deps);
    expect(a.mode).toBe('camera-gyro');
    expect(a.capacites).toEqual({ echelle: true, photo: true });
  });

  it('appelle requestPermission, getUserMedia et play de façon synchrone dès start(), avant tout await', () => {
    const { deps, journal } = creerDepsCameraGyro();
    const a = createCameraGyroAdaptateur(deps);
    const p = a.start(); // pas de await : on regarde ce qui est parti dans le même tour
    expect(noms(journal)).toEqual(['requestPermission', 'getUserMedia', 'play']);
    return p;
  });

  it('demande la caméra arrière sans audio', () => {
    const { deps, journal } = creerDepsCameraGyro();
    const p = createCameraGyroAdaptateur(deps).start();
    const appel = journal.find((j) => j.nom === 'getUserMedia');
    expect(appel.contraintes).toEqual({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    return p;
  });

  it('deux start() ouvrent une seule caméra', async () => {
    const { deps, journal } = creerDepsCameraGyro();
    const a = createCameraGyroAdaptateur(deps);
    await Promise.all([a.start(), a.start()]);
    expect(journal.filter((j) => j.nom === 'getUserMedia')).toHaveLength(1);
  });

  it('stop() arrête les pistes, coupe la boucle et les écouteurs, et peut être appelé deux fois', async () => {
    const { adaptateur, pistes, renderer, win } = await demarre();
    await adaptateur.stop();
    await expect(adaptateur.stop()).resolves.toBeUndefined();
    expect(pistes.every((p) => p.stoppee)).toBe(true);
    expect(renderer.boucle.nulls).toBeGreaterThanOrEqual(1);
    expect(renderer.boucle.cb).toBeNull();
    expect(win.nbEcouteurs('deviceorientation')).toBe(0);
  });

  it('NotAllowedError de getUserMedia → start() rejette avec le code camera-refusee', async () => {
    const refus = Object.assign(new Error('refus'), { name: 'NotAllowedError' });
    const { deps } = creerDepsCameraGyro({ getUserMedia: () => Promise.reject(refus) });
    const a = createCameraGyroAdaptateur(deps);
    await expect(a.start()).rejects.toMatchObject({ code: 'camera-refusee' });
  });

  it('place au-dessus de l\'horizon renvoie null et laisse la pose inchangée', async () => {
    const { adaptateur, win, renderer, pose } = await demarre();
    win.emettre('deviceorientation', { alpha: 0, beta: 120, gamma: 0 }); // regard vers le haut
    renderer.tick();
    const avant = pose.get();
    expect(adaptateur.place(195, 422)).toBeNull();
    expect(pose.get()).toEqual(avant);
  });

  it('place au centre en regardant vers le bas pose la piscine sur le sol (y = 0)', async () => {
    const { adaptateur, win, renderer, pose } = await demarre();
    win.emettre('deviceorientation', { alpha: 0, beta: 0, gamma: 0 }); // regard droit vers le bas
    renderer.tick();
    const res = adaptateur.place(195, 422);
    expect(res).not.toBeNull();
    expect(res.position.y).toBeCloseTo(0, 5);
    expect(res.position.x).toBeCloseTo(0, 2);
    expect(res.position.z).toBeCloseTo(0, 2);
    expect(pose.get().position.y).toBeCloseTo(0, 5);
    expect(adaptateur.getPose().position.y).toBeCloseTo(0, 5);
  });

  // ---- Lot V4b (plan §12.2/§12.3) ----
  describe('V4b : champ de vision et hauteur du téléphone', () => {
    it('vidéo 1080 × 1920 dans un hôte 390 × 844 : après une image, camera.fov ≈ 67° (±0,5)', async () => {
      const { stage, win, renderer } = await demarre({ dimsVideo: { largeur: 1080, hauteur: 1920 } });
      win.emettre('deviceorientation', { alpha: 0, beta: 60, gamma: 0 });
      renderer.tick();
      expect(Math.abs(stage.camera.fov - 67)).toBeLessThanOrEqual(0.5);
    });

    it('sans dimensions vidéo (0 × 0) : camera.fov reste 60', async () => {
      const { stage, win, renderer } = await demarre({ dimsVideo: { largeur: 0, hauteur: 0 } });
      win.emettre('deviceorientation', { alpha: 0, beta: 60, gamma: 0 });
      renderer.tick();
      expect(stage.camera.fov).toBe(60);
    });

    it('camera.position.y vaut 1,4 après start() (hauteur du téléphone)', async () => {
      const { stage } = await demarre({ dimsVideo: { largeur: 1080, hauteur: 1920 } });
      expect(stage.camera.position.y).toBeCloseTo(1.4, 5);
    });

    it('mode sans caméra : camera.fov reste 60 après une image', async () => {
      const { adaptateur, stage, win, renderer } = await demarre({ sansVideo: true });
      expect(adaptateur.mode).toBe('sans-camera');
      win.emettre('deviceorientation', { alpha: 0, beta: 60, gamma: 0 });
      renderer.tick();
      expect(stage.camera.fov).toBe(60);
    });
  });
});

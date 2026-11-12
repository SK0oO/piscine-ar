import { describe, it, expect, vi, afterEach } from 'vitest';
import { createWebxrAdaptateur } from '../../src/adapters/webxr.js';
import { creerDepsWebxr, textesVisibles, boutonsVisibles, flush, fabriquerRacine } from './fakes/xr.js';

// API supposée : createWebxrAdaptateur(deps) (plan §1 « Adaptateur » et « WebXR »).
// L'adaptateur lit les images via renderer.setAnimationLoop(cb) : cb(time, frame). Voir fakes/xr.js pour les noms fixés.
const noms = (journal) => journal.map((j) => j.nom);
const demarre = async (options) => {
  const f = creerDepsWebxr(options);
  const adaptateur = createWebxrAdaptateur(f.deps);
  await adaptateur.start();
  await flush();
  return { ...f, adaptateur };
};
const compterOccludeurs = (scene) => {
  let n = 0;
  scene.traverse((o) => { if (o.material && o.material.colorWrite === false && o.renderOrder === -1) n++; });
  return n;
};
const reticule = (stage) => stage.scene.getObjectByName('reticule');

afterEach(() => vi.useRealTimers());

describe('createWebxrAdaptateur — session', () => {
  it('annonce le mode webxr, sans échelle libre', () => {
    const { deps } = creerDepsWebxr();
    const a = createWebxrAdaptateur(deps);
    expect(a.mode).toBe('webxr');
    expect(a.capacites.echelle).toBe(false);
  });

  it('demande les fonctionnalités exactes, domOverlay.root === hote, de façon synchrone dès start()', async () => {
    const { deps, journal, hote } = creerDepsWebxr();
    const p = createWebxrAdaptateur(deps).start(); // pas de await : ce qui est parti dans le même tour
    expect(noms(journal)).toEqual(['requestSession']);
    const { mode, init } = journal[0];
    expect(mode).toBe('immersive-ar');
    expect(init.requiredFeatures).toEqual(['local', 'hit-test']);
    expect(init.optionalFeatures).toEqual(['anchors', 'dom-overlay', 'camera-access']);
    expect(init.domOverlay.root).toBe(hote);
    await p;
  });

  it('active renderer.xr avant setSession et le désactive à stop()', async () => {
    const { deps } = creerDepsWebxr();
    deps.renderer.xr.enabled = false;
    const a = createWebxrAdaptateur(deps);
    await a.start();
    expect(deps.renderer.xr.enabled).toBe(true);
    await a.stop();
    expect(deps.renderer.xr.enabled).toBe(false);
  });

  it('requestSession rejeté → start() rejette avec le code webxr-echec', async () => {
    const { deps } = creerDepsWebxr({ requestSession: () => Promise.reject(new Error('NotSupportedError')) });
    await expect(createWebxrAdaptateur(deps).start()).rejects.toMatchObject({ code: 'webxr-echec' });
  });

  it('requestSession qui lève à l\'appel → webxr-echec', async () => {
    const { deps } = creerDepsWebxr({ requestSession: () => { throw new Error('SecurityError'); } });
    await expect(createWebxrAdaptateur(deps).start()).rejects.toMatchObject({ code: 'webxr-echec' });
  });

  it('deux start() ouvrent une seule session', async () => {
    const { deps, journal } = creerDepsWebxr();
    const a = createWebxrAdaptateur(deps);
    await Promise.all([a.start(), a.start()]);
    expect(journal.filter((j) => j.nom === 'requestSession')).toHaveLength(1);
  });

  it('branche la session au rendu (espace local) et demande les deux hit-tests, dont generic-touchscreen', async () => {
    const { journal, session } = await demarre();
    expect(journal.find((j) => j.nom === 'setReferenceSpaceType').type).toBe('local');
    expect(journal.find((j) => j.nom === 'setSession').session).toBe(session);
    expect(journal.find((j) => j.nom === 'requestHitTestSource')).toBeDefined();
    expect(journal.find((j) => j.nom === 'requestHitTestSourceForTransientInput').options.profile).toBe('generic-touchscreen');
  });

  it('les événements select sont ignorés : ni pose ni ancre', async () => {
    const { session, pose, journal, image, hit } = await demarre();
    image({ reticule: [hit(0, 0, -3)] });
    const avant = pose.get();
    session.emettre('select');
    await flush();
    expect(pose.get()).toEqual(avant);
    expect(noms(journal)).not.toContain('createAnchor');
  });

  it('l\'événement end déclenche surFin(\'session-terminee\') une seule fois et setAnimationLoop(null)', async () => {
    const { session, surFin, renderer } = await demarre();
    session.emettre('end');
    session.emettre('end');
    expect(surFin).toEqual(['session-terminee']);
    expect(renderer.boucle.nulls).toBeGreaterThanOrEqual(1);
    expect(renderer.boucle.cb).toBeNull();
  });

  it('stop() termine la session, coupe la boucle et peut être appelé deux fois', async () => {
    const { adaptateur, session, renderer } = await demarre();
    await adaptateur.stop();
    await expect(adaptateur.stop()).resolves.toBeUndefined();
    expect(session.termine).toBe(true);
    expect(renderer.boucle.cb).toBeNull();
  });
});

describe('createWebxrAdaptateur — réticule et messages', () => {
  it('au départ : réticule caché et message « Balayez le sol » visible, avec un bouton « Recentrer »', async () => {
    const { stage, calque } = await demarre();
    expect(reticule(stage)).toBeDefined();
    expect(reticule(stage).visible).toBe(false);
    expect(textesVisibles(calque)).toContain('Balayez le sol');
    expect(boutonsVisibles(calque).map((b) => b.textContent)).toContain('Recentrer');
  });

  it('une image sans hit laisse le réticule caché', async () => {
    const { stage, image } = await demarre();
    image({ reticule: [] });
    expect(reticule(stage).visible).toBe(false);
  });

  it('au premier hit : réticule visible à la position du hit, message masqué', async () => {
    const { stage, calque, image, hit } = await demarre();
    image({ reticule: [hit(0.5, 0, -3)] });
    expect(reticule(stage).visible).toBe(true);
    expect(reticule(stage).position.x).toBeCloseTo(0.5, 5);
    expect(reticule(stage).position.z).toBeCloseTo(-3, 5);
    expect(textesVisibles(calque)).not.toContain('Balayez le sol');
  });

  it('après 5 s sans sol : « Visez une zone contrastée » (absent à 4,999 s, présent à 5,001 s)', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'] });
    const f = creerDepsWebxr();
    const a = createWebxrAdaptateur(f.deps);
    await a.start();
    await flush();
    f.image({ reticule: [], time: performance.now() });
    vi.advanceTimersByTime(4999);
    f.image({ reticule: [], time: performance.now() });
    expect(textesVisibles(f.calque)).not.toContain('Visez une zone contrastée');
    vi.advanceTimersByTime(2);
    f.image({ reticule: [], time: performance.now() });
    expect(textesVisibles(f.calque)).toContain('Visez une zone contrastée');
  });

  it('pas de « Visez une zone contrastée » si un sol a été trouvé avant 5 s', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'] });
    const f = creerDepsWebxr();
    await createWebxrAdaptateur(f.deps).start();
    await flush();
    f.image({ reticule: [f.hit(0, 0, -3)], time: performance.now() });
    vi.advanceTimersByTime(6000);
    f.image({ reticule: [f.hit(0, 0, -3)], time: performance.now() });
    expect(textesVisibles(f.calque)).not.toContain('Visez une zone contrastée');
  });
});

describe('createWebxrAdaptateur — place', () => {
  it('sans sol trouvé : place() renvoie null et la pose est inchangée', async () => {
    const { adaptateur, pose, image } = await demarre();
    image({ reticule: [] });
    const avant = pose.get();
    expect(adaptateur.place(100, 200)).toBeNull();
    expect(pose.get()).toEqual(avant);
  });

  it('place() crée une ancre, et la pose suit l\'ancre aux images suivantes', async () => {
    const { adaptateur, ancres, journal, image, hit } = await demarre();
    image({ reticule: [hit(0.5, 0, -3)] });
    const p = adaptateur.place(100, 200);
    expect(p.position.x).toBeCloseTo(0.5, 5);
    expect(p.position.z).toBeCloseTo(-3, 5);
    await flush();
    expect(noms(journal).filter((n) => n === 'createAnchor')).toHaveLength(1);
    ancres[0].deplacer(1, 0.1, -2);
    image({ reticule: [hit(9, 0, -9)] });
    const apres = adaptateur.getPose();
    expect(apres.position.x).toBeCloseTo(1, 5);
    expect(apres.position.y).toBeCloseTo(0.1, 5);
    expect(apres.position.z).toBeCloseTo(-2, 5);
  });

  it('un second place() supprime l\'ancre précédente', async () => {
    const { adaptateur, ancres, image, hit } = await demarre();
    image({ reticule: [hit(0, 0, -3)] });
    adaptateur.place(10, 10);
    await flush();
    image({ reticule: [hit(2, 0, -4)] });
    adaptateur.place(20, 20);
    await flush();
    expect(ancres).toHaveLength(2);
    expect(ancres[0].supprimee).toBe(true);
    expect(ancres[1].supprimee).toBe(false);
  });

  it('le hit « transient input » (toucher) passe avant celui du réticule', async () => {
    const { adaptateur, image, hit } = await demarre();
    image({ reticule: [hit(0, 0, -3)], tactile: [hit(2, 0, -5)] });
    const p = adaptateur.place(50, 60);
    expect(p.position.x).toBeCloseTo(2, 5);
    expect(p.position.z).toBeCloseTo(-5, 5);
  });

  it('sans ancres : la pose du hit est utilisée et ne bouge plus aux images suivantes', async () => {
    const { adaptateur, ancres, journal, image, hit } = await demarre({ ancres: false });
    image({ reticule: [hit(0.5, -1.2, -3)] });
    const p = adaptateur.place(100, 200);
    expect(p.position.x).toBeCloseTo(0.5, 5);
    expect(p.position.y).toBeCloseTo(-1.2, 5);
    expect(p.position.z).toBeCloseTo(-3, 5);
    await flush();
    image({ reticule: [hit(7, 0, -7)] });
    expect(adaptateur.getPose().position.x).toBeCloseTo(0.5, 5);
    expect(ancres).toHaveLength(0);
    expect(noms(journal)).not.toContain('createAnchor');
  });

  it('scale reste à 1, avant et après placement', async () => {
    const { adaptateur, image, hit } = await demarre();
    expect(adaptateur.getPose().scale).toBe(1);
    image({ reticule: [hit(0, 0, -3)] });
    adaptateur.place(1, 1);
    await flush();
    image({ reticule: [hit(1, 0, -3)] });
    expect(adaptateur.getPose().scale).toBe(1);
  });

  it('getPose() renvoie une copie', async () => {
    const { adaptateur } = await demarre();
    const p = adaptateur.getPose();
    p.position.x = 99;
    expect(adaptateur.getPose().position.x).not.toBe(99);
  });
});

describe('createWebxrAdaptateur — images, modèle, photo', () => {
  it('onFrame : cb({ time, camera }) à chaque image, jusqu\'au désabonnement', async () => {
    const { adaptateur, image, stage } = await demarre();
    const vus = [];
    const off = adaptateur.onFrame((e) => vus.push(e));
    image({ time: 42 });
    expect(vus).toHaveLength(1);
    expect(vus[0].time).toBe(42);
    expect(vus[0].camera).toBeDefined();
    off();
    image({ time: 43 });
    expect(vus).toHaveLength(1);
    expect(stage.camera).toBeDefined();
  });

  it('setModele laisse un seul occludeur dans la scène, sans changer la pose', async () => {
    const { adaptateur, stage, image, hit } = await demarre({ ancres: false });
    image({ reticule: [hit(0.5, 0, -3)] });
    adaptateur.place(1, 1);
    const avant = adaptateur.getPose();
    adaptateur.setModele({ id: 'a' }, fabriquerRacine());
    expect(compterOccludeurs(stage.scene)).toBe(1);
    adaptateur.setModele({ id: 'b' }, fabriquerRacine());
    expect(compterOccludeurs(stage.scene)).toBe(1);
    expect(adaptateur.getPose()).toEqual(avant);
  });

  it('sans camera-access : capacites.photo false et capturer rejette photo-indisponible', async () => {
    const { adaptateur } = await demarre();
    expect(adaptateur.capacites).toEqual({ echelle: false, photo: false });
    await expect(adaptateur.capturer({ largeur: 390, hauteur: 844 })).rejects.toMatchObject({ code: 'photo-indisponible' });
  });

  it('avec camera-access accordé : capacites.photo true', async () => {
    const { adaptateur } = await demarre({ features: ['local', 'hit-test', 'anchors', 'dom-overlay', 'camera-access'] });
    expect(adaptateur.capacites).toEqual({ echelle: false, photo: true });
  });
});

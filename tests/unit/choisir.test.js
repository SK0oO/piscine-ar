import { describe, it, expect } from 'vitest';
import { choisirMode } from '../../src/adapters/choisir.js';
import { creerEnv } from './fakes/env.js';

describe('choisirMode', () => {
  it('RA supportée → webxr (interroge immersive-ar)', async () => {
    const { env, appels } = creerEnv({ xr: 'supporte' });
    expect(await choisirMode(env)).toEqual({ mode: 'webxr', quicklook: false });
    expect(appels.isSessionSupported).toEqual(['immersive-ar']);
  });

  it('isSessionSupported qui lève une exception → camera-gyro', async () => {
    const { env } = creerEnv({ xr: 'exception' });
    expect((await choisirMode(env)).mode).toBe('camera-gyro');
  });

  it('RA non supportée avec getUserMedia → camera-gyro', async () => {
    const { env } = creerEnv({ xr: 'non-supporte' });
    expect((await choisirMode(env)).mode).toBe('camera-gyro');
  });

  it('pas de navigator.xr avec getUserMedia → camera-gyro', async () => {
    const { env } = creerEnv({ xr: 'absent' });
    expect((await choisirMode(env)).mode).toBe('camera-gyro');
  });

  it('sans getUserMedia → sans-camera', async () => {
    const { env } = creerEnv({ xr: 'absent', getUserMedia: false });
    expect((await choisirMode(env)).mode).toBe('sans-camera');
  });

  it('quicklook reflète relList.supports(\'ar\')', async () => {
    const oui = creerEnv({ xr: 'absent', quicklook: true }).env;
    const non = creerEnv({ xr: 'absent', quicklook: false }).env;
    expect((await choisirMode(oui)).quicklook).toBe(true);
    expect((await choisirMode(non)).quicklook).toBe(false);
  });
});

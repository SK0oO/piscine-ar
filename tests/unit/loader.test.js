import { describe, it, expect } from 'vitest';
import { analyserGlb } from '../../src/core/loader.js';

// Fabrique un GLB minimal (en-tête + chunk JSON) à partir d'un objet glTF.
function glbDepuis(gltf) {
  const json = new TextEncoder().encode(JSON.stringify(gltf));
  const pad = (4 - (json.length % 4)) % 4;
  const jsonLen = json.length + pad;
  const total = 12 + 8 + jsonLen;
  const buf = new ArrayBuffer(total);
  const dv = new DataView(buf);
  dv.setUint32(0, 0x46546c67, true); // 'glTF'
  dv.setUint32(4, 2, true);
  dv.setUint32(8, total, true);
  dv.setUint32(12, jsonLen, true);
  dv.setUint32(16, 0x4e4f534a, true); // 'JSON'
  new Uint8Array(buf, 20).set(json);
  for (let i = 0; i < pad; i++) new Uint8Array(buf)[20 + json.length + i] = 0x20;
  return buf;
}

const base = { asset: { version: '2.0' }, scenes: [{ nodes: [] }], scene: 0 };

describe('analyserGlb', () => {
  it('accepte un GLB autonome', async () => {
    const scene = await analyserGlb(glbDepuis(base));
    expect(scene).toBeTruthy();
  });

  it('refuse un GLB dont une image pointe vers un serveur tiers (modele-invalide)', async () => {
    const gltf = {
      ...base,
      images: [{ uri: 'https://tiers.invalid/pixel.png' }],
      textures: [{ source: 0 }],
      materials: [{ pbrMetallicRoughness: { baseColorTexture: { index: 0 } } }],
    };
    await expect(analyserGlb(glbDepuis(gltf))).rejects.toMatchObject({ code: 'modele-invalide' });
  });

  it('refuse un GLB dont un tampon pointe vers un serveur tiers (modele-invalide)', async () => {
    const gltf = { ...base, buffers: [{ uri: 'https://tiers.invalid/x.bin', byteLength: 4 }] };
    await expect(analyserGlb(glbDepuis(gltf))).rejects.toMatchObject({ code: 'modele-invalide' });
  });
});

import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');
const ids = readdirSync(resolve(ROOT, 'models/params'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.replace(/\.json$/, ''));

describe('npm run generate', () => {
  it('écrit <id>.glb, <id>.usdz, <id>.png pour les 3 modèles', () => {
    expect(ids).toHaveLength(3);
    execSync('npm run generate', { cwd: ROOT, stdio: 'pipe' });
    for (const id of ids) {
      for (const ext of ['glb', 'usdz', 'png']) {
        const p = resolve(ROOT, 'models/out', `${id}.${ext}`);
        expect(existsSync(p), p).toBe(true);
        expect(statSync(p).size, p).toBeGreaterThan(0);
      }
      const glb = resolve(ROOT, 'models/out', `${id}.glb`);
      expect(statSync(glb).size).toBeLessThan(4 * 1024 * 1024);
      expect(readFileSync(glb).subarray(0, 4).toString('latin1')).toBe('glTF');
    }
  }, 120_000);

  it('écrit aussi <id>-sol.usdz : 12 fichiers au total (3 glb, 3 usdz, 3 usdz sol, 3 png)', () => {
    execSync('npm run generate', { cwd: ROOT, stdio: 'pipe' });
    const sortie = readdirSync(resolve(ROOT, 'models/out'));
    for (const id of ids) {
      const p = resolve(ROOT, 'models/out', `${id}-sol.usdz`);
      expect(existsSync(p), p).toBe(true);
      expect(statSync(p).size, p).toBeGreaterThan(0);
    }
    expect(sortie.filter((f) => /\.(glb|usdz|png)$/.test(f))).toHaveLength(12);
  }, 120_000);
});

// ---- Lot M1 : matières dans les fichiers exportés (plan §11.3) ----
// Un seul `npm run generate` partagé par tous les tests de ce bloc.
import { beforeAll } from 'vitest';
import { inflateRawSync } from 'node:zlib';

// Archive zip (USDZ = « store ») : lit les en-têtes locaux à la suite.
function lireZip(buf) {
  const fichiers = [];
  let o = 0;
  while (o + 30 <= buf.length && buf.readUInt32LE(o) === 0x04034b50) {
    const methode = buf.readUInt16LE(o + 8);
    const taille = buf.readUInt32LE(o + 18);
    const nomLen = buf.readUInt16LE(o + 26);
    const extraLen = buf.readUInt16LE(o + 28);
    const nom = buf.subarray(o + 30, o + 30 + nomLen).toString('utf8');
    const debut = o + 30 + nomLen + extraLen;
    let data = buf.subarray(debut, debut + taille);
    if (methode === 8) data = inflateRawSync(data);
    fichiers.push({ nom, data });
    o = debut + taille;
  }
  return fichiers;
}

function jsonGlb(buf) {
  const len = buf.readUInt32LE(12);
  expect(buf.subarray(16, 20).toString('latin1')).toBe('JSON');
  return JSON.parse(buf.subarray(20, 20 + len).toString('utf8'));
}

describe('fichiers exportés : matières (M1)', () => {
  beforeAll(() => {
    execSync('npm run generate', { cwd: ROOT, stdio: 'pipe' });
  }, 120_000);

  for (const id of ids) {
    describe(id, () => {
      const MO = 1024 * 1024;

      it('GLB < 4 Mo, USDZ < 5 Mo, USDZ sol < 5 Mo', () => {
        expect(statSync(resolve(ROOT, 'models/out', `${id}.glb`)).size).toBeLessThan(4 * MO);
        expect(statSync(resolve(ROOT, 'models/out', `${id}.usdz`)).size).toBeLessThan(5 * MO);
        expect(statSync(resolve(ROOT, 'models/out', `${id}-sol.usdz`)).size).toBeLessThan(5 * MO);
      });

      it('GLB : images[] avec mimeType jpeg et png, aucun uri externe', () => {
        const j = jsonGlb(readFileSync(resolve(ROOT, 'models/out', `${id}.glb`)));
        expect(Array.isArray(j.images) && j.images.length > 0, 'images[] non vide').toBe(true);
        const types = j.images.map((i) => i.mimeType);
        expect(types).toContain('image/jpeg');
        expect(types).toContain('image/png');
        for (const img of j.images) expect(img.uri).toBeUndefined();
      });

      it('GLB : KHR_texture_transform dans extensionsUsed, textures[] ≥ 4', () => {
        const j = jsonGlb(readFileSync(resolve(ROOT, 'models/out', `${id}.glb`)));
        expect(j.extensionsUsed ?? []).toContain('KHR_texture_transform');
        expect((j.textures ?? []).length).toBeGreaterThanOrEqual(4);
      });

      it('GLB : aucun matériau doubleSided, aucune couleur de sommet (COLOR_0)', () => {
        const j = jsonGlb(readFileSync(resolve(ROOT, 'models/out', `${id}.glb`)));
        expect(j.images?.length ?? 0).toBeGreaterThan(0); // évite un faux vert sur un GLB sans matière
        for (const m of j.materials) expect(m.doubleSided, m.name).not.toBe(true);
        for (const mesh of j.meshes) for (const p of mesh.primitives) expect(p.attributes.COLOR_0).toBeUndefined();
      });

      for (const suffixe of ['', '-sol']) {
        describe(`${id}${suffixe}.usdz`, () => {
          const lire = () => lireZip(readFileSync(resolve(ROOT, 'models/out', `${id}${suffixe}.usdz`)));
          const usda = () => {
            const f = lire().find((x) => x.nom.endsWith('.usda'));
            expect(f, 'fichier .usda dans l\'archive').toBeTruthy();
            return f.data.toString('utf8');
          };

          it('archive avec textures/ (≥ 4 fichiers)', () => {
            const tex = lire().filter((f) => f.nom.startsWith('textures/') && f.data.length > 0);
            expect(tex.length).toBeGreaterThanOrEqual(4);
          });

          it('.usda : UsdUVTexture, inputs:normal.connect, inputs:roughness.connect, subdivisionScheme = "none"', () => {
            const t = usda();
            expect(t).toContain('UsdUVTexture');
            expect(t).toContain('inputs:normal.connect');
            expect(t).toContain('inputs:roughness.connect');
            expect(t).toContain('subdivisionScheme = "none"');
          });

          it('.usda : aucun doubleSided = true', () => {
            const t = usda();
            expect(t).toContain('UsdUVTexture'); // évite un faux vert sur un USDZ sans matière
            expect(t).not.toMatch(/doubleSided\s*=\s*(true|1)/);
          });

          it('.usda : un inputs:scale non blanc (couleur d\'eau × texture de la mosaïque)', () => {
            const t = usda();
            expect(t).toContain('UsdUVTexture');
            const valeurs = [...t.matchAll(/inputs:scale\s*=\s*\(([^)]*)\)/g)].map((m) => m[1].split(',').map(Number));
            expect(valeurs.length).toBeGreaterThan(0);
            expect(valeurs.some((v) => v.slice(0, 3).some((x) => Math.abs(x - 1) > 0.01))).toBe(true);
          });
        });
      }
    });
  }
});

// ---- Lot V4a bis : USDZ plus léger (plan §12.2 / §12.3) ----
// Lit la taille (largeur, hauteur) d'un PNG ou d'un JPEG à partir de son en-tête.
function dimsImage(data) {
  if (data.length > 24 && data.readUInt32BE(0) === 0x89504e47) {
    return { l: data.readUInt32BE(16), h: data.readUInt32BE(20), type: 'png' };
  }
  if (data.length > 4 && data[0] === 0xff && data[1] === 0xd8) {
    let o = 2;
    while (o + 9 < data.length) {
      if (data[o] !== 0xff) { o += 1; continue; }
      const m = data[o + 1];
      if (m === 0xff) { o += 1; continue; }
      if ((m >= 0xc0 && m <= 0xcf) && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
        return { h: data.readUInt16BE(o + 5), l: data.readUInt16BE(o + 7), type: 'jpeg' };
      }
      o += 2 + data.readUInt16BE(o + 2);
    }
  }
  return null;
}

// Images d'un GLB (JSON + BIN) : [{ nom, data }]
function imagesGlb(buf) {
  const j = jsonGlb(buf);
  const lenJson = buf.readUInt32LE(12);
  const debutBin = 20 + lenJson + 8; // en-tête du fragment BIN : 8 octets
  return (j.images ?? []).map((img, i) => {
    const bv = j.bufferViews[img.bufferView];
    const debut = debutBin + (bv.byteOffset ?? 0);
    return { nom: `image ${i}`, data: buf.subarray(debut, debut + bv.byteLength) };
  });
}

describe('fichiers exportés : poids et textures (V4a bis)', () => {
  beforeAll(() => {
    execSync('npm run generate', { cwd: ROOT, stdio: 'pipe' });
  }, 120_000);

  const MO15 = 1.5 * 1024 * 1024;

  for (const id of ids) {
    for (const suffixe of ['', '-sol']) {
      const fichier = `${id}${suffixe}.usdz`;
      const lire = () => lireZip(readFileSync(resolve(ROOT, 'models/out', fichier)));

      it(`${fichier} : poids < 1,5 Mo`, () => {
        expect(statSync(resolve(ROOT, 'models/out', fichier)).size).toBeLessThan(MO15);
      });

      it(`${fichier} : toutes les textures font 512 px au plus (en-tête PNG/JPEG)`, () => {
        const tex = lire().filter((f) => f.nom.startsWith('textures/') && f.data.length > 0);
        expect(tex.length, 'textures/ non vide').toBeGreaterThanOrEqual(4);
        for (const t of tex) {
          const d = dimsImage(t.data);
          expect(d, `${t.nom} : en-tête PNG/JPEG lisible`).not.toBeNull();
          expect(Math.max(d.l, d.h), `${t.nom} (${d.l}×${d.h})`).toBeLessThanOrEqual(512);
        }
      });
    }

    it(`${id}.glb : inchangé, < 4 Mo, textures ≤ 1024 px et au moins une à 1024`, () => {
      const buf = readFileSync(resolve(ROOT, 'models/out', `${id}.glb`));
      expect(buf.length).toBeLessThan(4 * 1024 * 1024);
      const dims = imagesGlb(buf).map((i) => {
        const d = dimsImage(i.data);
        expect(d, `${i.nom} : en-tête lisible`).not.toBeNull();
        return Math.max(d.l, d.h);
      });
      expect(dims.length).toBeGreaterThan(0);
      expect(Math.max(...dims)).toBeLessThanOrEqual(1024);
      expect(Math.max(...dims)).toBe(1024);
    });
  }
});

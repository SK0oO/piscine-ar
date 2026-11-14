import { describe, it, expect } from 'vitest';

// Contrat fixé par ces tests (plan §11.2/§11.3), pur : sans Three, sans canvas.
//  - pierre(taille, graine?), mosaique(taille, graine?) -> { couleur, normale, orm }
//  - ondulations(taille, graine?) -> { normale }
//  - chaque image = { largeur, hauteur, data: Uint8Array RGBA } ; orm = empaqueterORM : R = AO, G = roughness, B = metal.
//  - hauteurVersNormale(h, force) : h = { largeur, hauteur, data: Float32Array 0..1 } -> image RGBA.
//  - empaqueterORM(ao, rough, metal) : trois { largeur, hauteur, data: Float32Array 0..1 } -> image RGBA.
const load = () => import('../../models/generate/textures.js');
const T = 256;

const lum = (img) => {
  let s = 0;
  const n = img.largeur * img.hauteur;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    s += (0.2126 * img.data[o] + 0.7152 * img.data[o + 1] + 0.0722 * img.data[o + 2]) / 255;
  }
  return s / n;
};
const moyenneCanal = (img, c) => {
  let s = 0;
  const n = img.largeur * img.hauteur;
  for (let i = 0; i < n; i++) s += img.data[i * 4 + c];
  return s / n;
};
const canal = (img, c) => {
  const n = img.largeur * img.hauteur;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = img.data[i * 4 + c] / 255;
  return out;
};
const ecartType = (v) => {
  const m = v.reduce((a, b) => a + b, 0) / v.length;
  return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length);
};
// Écart moyen (sur 255) entre deux bords opposés.
const ecartBords = (img, bord) => {
  const { largeur: w, hauteur: h, data } = img;
  let s = 0, n = 0;
  const n1 = bord === 'colonnes' ? h : w;
  for (let k = 0; k < n1; k++) {
    const a = bord === 'colonnes' ? (k * w + 0) * 4 : (0 * w + k) * 4;
    const b = bord === 'colonnes' ? (k * w + (w - 1)) * 4 : ((h - 1) * w + k) * 4;
    for (let c = 0; c < 3; c++) { s += Math.abs(data[a + c] - data[b + c]); n++; }
  }
  return s / n;
};

const generateurs = {
  pierre: (m, t = T, g) => m.pierre(t, g),
  mosaique: (m, t = T, g) => m.mosaique(t, g),
  ondulations: (m, t = T, g) => m.ondulations(t, g),
};

describe('textures procédurales', () => {
  for (const nom of ['pierre', 'mosaique', 'ondulations']) {
    describe(nom, () => {
      it('même graine → mêmes octets', async () => {
        const m = await load();
        const a = generateurs[nom](m, 64, 7);
        const b = generateurs[nom](m, 64, 7);
        for (const cle of Object.keys(a)) expect(Buffer.from(a[cle].data).equals(Buffer.from(b[cle].data)), cle).toBe(true);
      });

      it('graine différente → octets différents', async () => {
        const m = await load();
        const a = generateurs[nom](m, 64, 7);
        const b = generateurs[nom](m, 64, 8);
        expect(Buffer.from(a.normale.data).equals(Buffer.from(b.normale.data))).toBe(false);
      });

      it('tailles puissance de 2, data RGBA de la bonne longueur', async () => {
        const m = await load();
        for (const t of [64, 128, 256]) {
          const r = generateurs[nom](m, t);
          for (const [cle, img] of Object.entries(r)) {
            expect(img.largeur, cle).toBe(t);
            expect(img.hauteur, cle).toBe(t);
            expect(img.data, cle).toBeInstanceOf(Uint8Array);
            expect(img.data.length, cle).toBe(t * t * 4);
          }
        }
      });

      it('tuilable : colonne 0 ≈ colonne n−1 et ligne 0 ≈ ligne n−1 (écart moyen < 8/255)', async () => {
        const m = await load();
        const r = generateurs[nom](m);
        for (const [cle, img] of Object.entries(r)) {
          expect(ecartBords(img, 'colonnes'), `${cle} colonnes`).toBeLessThan(8);
          expect(ecartBords(img, 'lignes'), `${cle} lignes`).toBeLessThan(8);
        }
      });

      it('normal map : moyenne de B > 200, moyennes de R et G entre 118 et 138', async () => {
        const m = await load();
        const n = generateurs[nom](m).normale;
        expect(moyenneCanal(n, 2)).toBeGreaterThan(200);
        for (const c of [0, 1]) {
          expect(moyenneCanal(n, c)).toBeGreaterThanOrEqual(118);
          expect(moyenneCanal(n, c)).toBeLessThanOrEqual(138);
        }
      });
    });
  }

  for (const nom of ['pierre', 'mosaique']) {
    it(`${nom} : roughness (canal G de l'ORM) à écart-type > 0,04 et valeurs dans [0,05 ; 1]`, async () => {
      const m = await load();
      const rough = canal(generateurs[nom](m).orm, 1);
      expect(ecartType(rough)).toBeGreaterThan(0.04);
      expect(Math.min(...rough)).toBeGreaterThanOrEqual(0.05 - 0.5 / 255);
      expect(Math.max(...rough)).toBeLessThanOrEqual(1);
    });
  }

  it('pierre : roughness entre 0,75 et 0,95 en moyenne', async () => {
    const m = await load();
    const moy = moyenneCanal(m.pierre(T).orm, 1) / 255;
    expect(moy).toBeGreaterThanOrEqual(0.75);
    expect(moy).toBeLessThanOrEqual(0.95);
  });

  it('pierre claire : luminance moyenne de la couleur de base > 0,6', async () => {
    const m = await load();
    expect(lum(m.pierre(T).couleur)).toBeGreaterThan(0.6);
  });

  it('mosaïque : la part de joints (roughness > 0,6) est entre 10 % et 20 % de la surface', async () => {
    const m = await load();
    const rough = canal(m.mosaique(T).orm, 1);
    const part = rough.filter((v) => v > 0.6).length / rough.length;
    expect(part).toBeGreaterThanOrEqual(0.10);
    expect(part).toBeLessThanOrEqual(0.20);
  });

  it('hauteurVersNormale : une hauteur plate donne (≈128, ≈128, ≈255)', async () => {
    const m = await load();
    const h = { largeur: 16, hauteur: 16, data: new Float32Array(256).fill(0.5) };
    const n = m.hauteurVersNormale(h, 2);
    expect(n.largeur).toBe(16);
    expect(n.data.length).toBe(16 * 16 * 4);
    expect(Math.abs(moyenneCanal(n, 0) - 127.5)).toBeLessThan(2);
    expect(Math.abs(moyenneCanal(n, 1) - 127.5)).toBeLessThan(2);
    expect(moyenneCanal(n, 2)).toBeGreaterThan(250);
  });

  it('hauteurVersNormale : une pente montante vers +x (convention OpenGL) incline R sous 128', async () => {
    const m = await load();
    const w = 16;
    const data = new Float32Array(w * w);
    for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) data[y * w + x] = x / (w - 1);
    const n = m.hauteurVersNormale({ largeur: w, hauteur: w, data }, 2);
    const o = (8 * w + 8) * 4;
    expect(n.data[o]).toBeLessThan(120);
  });

  it('empaqueterORM : R = AO, G = roughness, B = metal, A = 255', async () => {
    const m = await load();
    const f = (v) => ({ largeur: 2, hauteur: 2, data: new Float32Array(4).fill(v) });
    const o = m.empaqueterORM(f(1), f(0.5), f(0));
    expect([o.largeur, o.hauteur]).toEqual([2, 2]);
    expect(Array.from(o.data.slice(0, 4))).toEqual([255, 128, 0, 255]);
  });
});

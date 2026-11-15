import { test, expect } from '@playwright/test';
import { installerOrientation } from './fakes/orientation.js';
import { installerMedia } from './fakes/media.js';
import { hote, bouton, evenements, attendre, demarrer } from './helpers.js';

// Lot V5 « DA de Maxime » (plan §13.3). Page hôte : pages/da.html, qui simule la page de Maxime (jetons sur :root).
const ROUGE = 'rgb(255, 0, 0)';
const BLEU = 'rgb(0, 0, 255)';
const JAUNE = 'rgb(255, 210, 63)'; // #FFD23F
const DEEP = 'rgb(6, 42, 48)'; // #062A30
const ON_ACCENT = 'rgb(27, 22, 0)'; // #1B1600

async function ouvrirDA(page, params = {}, { quickLook = false } = {}) {
  await page.addInitScript(installerMedia, {});
  await page.addInitScript(installerOrientation, {});
  if (quickLook) {
    // Comme quicklook.spec.js : Chromium ne supporte pas rel="ar", on le force avant le chargement.
    await page.addInitScript(() => {
      const original = DOMTokenList.prototype.supports;
      DOMTokenList.prototype.supports = function (jeton) { return jeton === 'ar' ? true : original.call(this, jeton); };
    });
  }
  await page.goto('/tests/browser/pages/da.html?' + new URLSearchParams(params));
  await page.waitForFunction(() => window.__chargement !== undefined, null, { timeout: 10_000 });
  const etat = await page.evaluate(() => window.__chargement);
  if (etat !== 'ok') throw new Error(`chargement de /src/index.js impossible (${etat})`);
}

const ecran = (page) => hote(page).locator('.ecran').first();
const principal = (page) => hote(page).locator('.ecran .principal').first();
const couleurs = async (loc) => loc.evaluate((e) => ({ fond: getComputedStyle(e).backgroundColor, texte: getComputedStyle(e).color }));

// Ouvre l'hôte compact et attend la classe `compact` sur la racine du Shadow DOM.
async function ouvrirCompact(page, options) {
  await ouvrirDA(page, { w: 360, h: 270 }, options);
  await hote(page).locator('.compact').waitFor({ state: 'attached', timeout: 5_000 });
  await principal(page).waitFor();
}

// Éléments visibles et cliquables du Shadow DOM, avec leur rectangle relatif à l'hôte.
const cliquables = (page) => page.evaluate(() => {
  const h = document.querySelector('piscine-ar');
  const r0 = h.getBoundingClientRect();
  return [...h.shadowRoot.querySelectorAll('button, a[href]')]
    .filter((e) => { const s = getComputedStyle(e); const r = e.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0; })
    .map((e) => { const r = e.getBoundingClientRect(); return { texte: e.textContent.trim().slice(0, 30), haut: r.top - r0.top, bas: r.bottom - r0.top, l: r.width, h: r.height }; });
});

test.describe('jetons de la page', () => {
  test('--accent de la page colore le bouton principal de l\'accueil', async ({ page }) => {
    await ouvrirDA(page, { accent: '#ff0000', deep: '#0000ff' });
    await principal(page).waitFor();
    expect((await couleurs(principal(page))).fond).toBe(ROUGE);
  });

  test('--deep de la page colore le fond de l\'écran d\'accueil', async ({ page }) => {
    await ouvrirDA(page, { accent: '#ff0000', deep: '#0000ff' });
    await principal(page).waitFor();
    expect((await couleurs(ecran(page))).fond).toBe(BLEU);
  });

  test('sans variables de page : bouton jaune #FFD23F', async ({ page }) => {
    await ouvrirDA(page);
    await principal(page).waitFor();
    expect((await couleurs(principal(page))).fond).toBe(JAUNE);
  });

  test('sans variables de page : fond d\'écran #062A30', async ({ page }) => {
    await ouvrirDA(page);
    await principal(page).waitFor();
    expect((await couleurs(ecran(page))).fond).toBe(DEEP);
  });

  test('couleurs.accent de la config l\'emporte sur --accent de la page', async ({ page }) => {
    await ouvrirDA(page, { accent: '#ff0000', config: '../fixtures/piscinier.json' }); // accent config : #1f6f9f
    await principal(page).waitFor();
    expect((await couleurs(principal(page))).fond).toBe('rgb(31, 111, 159)');
  });
});

test.describe('accueil compact (hôte 360 × 270)', () => {
  test('la racine reçoit la classe compact', async ({ page }) => {
    await ouvrirCompact(page);
    expect(await hote(page).locator('.compact').count()).toBeGreaterThan(0);
  });

  test('un seul bouton principal visible', async ({ page }) => {
    await ouvrirCompact(page);
    const visibles = await hote(page).locator('.ecran .principal').evaluateAll(
      (els) => els.filter((e) => e.getBoundingClientRect().width > 0 && getComputedStyle(e).display !== 'none').length);
    expect(visibles).toBe(1);
  });

  test('aucun h2 visible', async ({ page }) => {
    await ouvrirCompact(page);
    const visibles = await hote(page).locator('h2').evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().width > 0 && getComputedStyle(e).display !== 'none').length);
    expect(visibles).toBe(0);
  });

  test('aucune vignette de choix visible', async ({ page }) => {
    await ouvrirCompact(page);
    const visibles = await hote(page).locator('button[data-modele]').evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().width > 0 && getComputedStyle(e).display !== 'none').length);
    expect(visibles).toBe(0);
  });

  test('rien de cliquable dans les 64 px du haut', async ({ page }) => {
    await ouvrirCompact(page);
    const dansLeHaut = (await cliquables(page)).filter((c) => c.haut < 64);
    expect(dansLeHaut).toEqual([]);
  });

  test('tout tient sans défilement', async ({ page }) => {
    await ouvrirCompact(page);
    const m = await ecran(page).evaluate((e) => ({ scroll: e.scrollHeight, client: e.clientHeight }));
    expect(m.scroll).toBeLessThanOrEqual(m.client);
  });

  test('tous les textes visibles font 16 px ou plus', async ({ page }) => {
    await ouvrirCompact(page);
    const { verifies, fautifs } = await page.evaluate(() => {
      const racine = document.querySelector('piscine-ar').shadowRoot;
      const fautifs = []; let verifies = 0;
      for (const el of racine.querySelectorAll('*')) {
        const texte = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join('');
        const s = getComputedStyle(el);
        if (!texte || s.display === 'none' || s.visibility === 'hidden' || el.getBoundingClientRect().width === 0) continue;
        verifies += 1;
        if (parseFloat(s.fontSize) < 16) fautifs.push(`${el.tagName.toLowerCase()} « ${texte.slice(0, 30)} » ${s.fontSize}`);
      }
      return { verifies, fautifs };
    });
    expect(verifies).toBeGreaterThanOrEqual(1);
    expect(fautifs).toEqual([]);
  });

  test('toutes les cibles cliquables font 44 px ou plus', async ({ page }) => {
    await ouvrirCompact(page);
    const cibles = await cliquables(page);
    expect(cibles.length).toBeGreaterThanOrEqual(1);
    expect(cibles.filter((c) => c.h < 44 || c.l < 44)).toEqual([]);
  });

  test('hors compact (hôte plein écran) : le titre h2 reste visible', async ({ page }) => {
    await ouvrirDA(page);
    await principal(page).waitFor();
    await expect(hote(page).locator('h2').first()).toBeVisible();
    expect(await hote(page).locator('.compact').count()).toBe(0);
  });
});

test.describe('accueil compact avec Quick Look', () => {
  test('un seul bouton principal visible (le lien « Voir dans mon jardin »), sans titre ni vignettes', async ({ page }) => {
    await ouvrirCompact(page, { quickLook: true });
    const m = await page.evaluate(() => {
      const racine = document.querySelector('piscine-ar').shadowRoot;
      const visible = (e) => e.getBoundingClientRect().width > 0 && getComputedStyle(e).display !== 'none';
      return {
        principaux: [...racine.querySelectorAll('.ecran .principal')].filter(visible).length,
        titres: [...racine.querySelectorAll('h2')].filter(visible).length,
        vignettes: [...racine.querySelectorAll('button[data-modele]')].filter(visible).length,
      };
    });
    expect(m).toEqual({ principaux: 1, titres: 0, vignettes: 0 });
  });
});

test.describe('contraste', () => {
  test('texte du bouton principal sur --pa-accent (palette lagon) ≥ 4,5:1', async ({ page }) => {
    await ouvrirDA(page);
    await principal(page).waitFor();
    const c = await couleurs(principal(page));
    expect(c.fond).toBe(JAUNE); // la palette lagon, pas un blanc par défaut
    expect(c.texte).toBe(ON_ACCENT);
    const lum = (rgb) => {
      const [r, g, b] = rgb.match(/\d+/g).slice(0, 3).map((v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const [a, b] = [lum(c.fond), lum(c.texte)].sort((x, y) => y - x);
    expect((a + 0.05) / (b + 0.05)).toBeGreaterThanOrEqual(4.5);
  });
});

test.describe('attribut modele', () => {
  const modeles = async (page) => (await evenements(page, 'model-changed')).map((e) => e.modele);

  test('modele="ovale" au chargement sélectionne ovale-5x3', async ({ page }) => {
    await ouvrirDA(page, { modele: 'ovale' });
    await expect.poll(() => modeles(page), { timeout: 5_000 }).toContain('ovale-5x3');
  });

  test('changer modele="haricot" après le chargement émet model-changed haricot-7x3-5 (forme)', async ({ page }) => {
    await ouvrirDA(page);
    await principal(page).waitFor();
    await page.evaluate(() => document.querySelector('piscine-ar').setAttribute('modele', 'haricot'));
    await expect.poll(() => modeles(page), { timeout: 5_000 }).toContain('haricot-7x3-5');
  });

  test('modele par id (« ovale-5x3 ») est accepté', async ({ page }) => {
    await ouvrirDA(page);
    await principal(page).waitFor();
    await page.evaluate(() => document.querySelector('piscine-ar').setAttribute('modele', 'ovale-5x3'));
    await expect.poll(() => modeles(page), { timeout: 5_000 }).toContain('ovale-5x3');
  });

  test('modele="inconnu" est ignoré : aucun model-changed', async ({ page }) => {
    await ouvrirDA(page);
    await principal(page).waitFor();
    // preuve que l'attribut est vivant : une valeur connue réagit (sinon « ignoré » serait un faux vert)
    await page.evaluate(() => document.querySelector('piscine-ar').setAttribute('modele', 'ovale'));
    await expect.poll(() => modeles(page), { timeout: 5_000 }).toContain('ovale-5x3');
    const avant = (await modeles(page)).length;
    await page.evaluate(() => document.querySelector('piscine-ar').setAttribute('modele', 'inconnu'));
    await page.waitForTimeout(500);
    expect((await modeles(page)).length).toBe(avant);
  });
});

test('cote « 8,00 × 4,00 m » en vue caméra', async ({ page }) => {
  await demarrer(page);
  await expect(hote(page).locator('[data-role="cote"]')).toHaveText('8,00 × 4,00 m');
});

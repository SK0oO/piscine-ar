import { test, expect } from '@playwright/test';
import { demarrer, regarderLeSol, pose, hote, bouton, surface, ouvrir, attendre } from './helpers.js';

// Télécommande à flèches et plein écran pendant les modes caméra (V3c).
// Regard fixe par défaut (beta 75°, vers -Z) : avant = -Z, droite de l'écran = +X.
const touche = (page, action) => hote(page).locator(`[data-role="tele-${action}"]`);
const cote = (page) => hote(page).locator('[data-role="cote"]').evaluate((e) => e.textContent);

test.describe('télécommande', () => {
  test.beforeEach(async ({ page }) => {
    await demarrer(page);
    await regarderLeSol(page);
  });

  test('chaque touche a un aria-label et mesure au moins 44 px', async ({ page }) => {
    for (const action of ['gauche', 'droite', 'avant', 'arriere', 'tournerG', 'tournerD', 'plus', 'moins']) {
      const t = touche(page, action);
      expect(await t.getAttribute('aria-label')).toBeTruthy();
      const b = await t.boundingBox();
      expect(b.width).toBeGreaterThanOrEqual(44);
      expect(b.height).toBeGreaterThanOrEqual(44);
    }
  });

  test('← et → déplacent de 0,25 m de chaque côté', async ({ page }) => {
    const p0 = (await pose(page)).position;
    await touche(page, 'droite').click();
    const p1 = (await pose(page)).position;
    expect(p1.x - p0.x).toBeGreaterThan(0.2);
    expect(Math.abs(p1.z - p0.z)).toBeLessThan(0.05);
    await touche(page, 'gauche').click();
    await touche(page, 'gauche').click();
    const p2 = (await pose(page)).position;
    expect(p2.x - p1.x).toBeLessThan(-0.4);
  });

  test('↑ éloigne la piscine, ↓ la rapproche (direction de la caméra projetée au sol)', async ({ page }) => {
    const p0 = (await pose(page)).position;
    await touche(page, 'avant').click();
    const p1 = (await pose(page)).position;
    expect(p1.z - p0.z).toBeLessThan(-0.2);
    expect(Math.abs(p1.x - p0.x)).toBeLessThan(0.05);
    await touche(page, 'arriere').click();
    await touche(page, 'arriere').click();
    expect((await pose(page)).position.z - p1.z).toBeGreaterThan(0.2);
  });

  test('⟲ augmente rotationY et ⟳ la diminue, de 15° par appui', async ({ page }) => {
    const r0 = (await pose(page)).rotationY;
    await touche(page, 'tournerG').click();
    const r1 = (await pose(page)).rotationY;
    expect(r1 - r0).toBeCloseTo(Math.PI / 12, 2);
    await touche(page, 'tournerD').click();
    await touche(page, 'tournerD').click();
    expect((await pose(page)).rotationY - r1).toBeCloseTo(-Math.PI / 6, 2);
  });

  test('+ et − changent l\'échelle (×1,1 et ÷1,1) et la cote en mètres', async ({ page }) => {
    const c0 = await cote(page);
    const s0 = (await pose(page)).scale;
    await touche(page, 'plus').click();
    const s1 = (await pose(page)).scale;
    expect(s1 / s0).toBeCloseTo(1.1, 3);
    expect(await cote(page)).not.toBe(c0);
    await touche(page, 'moins').click();
    expect((await pose(page)).scale).toBeCloseTo(s0, 3);
    expect(await cote(page)).toBe(c0);
  });

  test('appui long : répétition toutes les 120 ms, arrêtée au relâchement', async ({ page }) => {
    const t = touche(page, 'tournerG');
    const b = await t.boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(700);
    await page.mouse.up();
    const r = (await pose(page)).rotationY;
    expect(r).toBeGreaterThan((3 * Math.PI) / 12); // au moins 4 pas (1 + répétitions)
    await page.waitForTimeout(400);
    expect((await pose(page)).rotationY).toBeCloseTo(r, 5);
  });

  test('les gestes au doigt restent disponibles', async ({ page }) => {
    await expect(surface(page)).toBeVisible();
  });

  test('l\'aide à l\'écran décrit la télécommande', async ({ page }) => {
    await expect(hote(page).locator('.aide')).toHaveText('Flèches : déplacer · ⟲⟳ : tourner');
  });

  test('model-changed n\'est pas émis par la télécommande', async ({ page }) => {
    await touche(page, 'avant').click();
    expect(await page.evaluate(() => window.__evts.filter((e) => e.type === 'model-changed').length)).toBe(0);
  });
});

test.describe('plein écran', () => {
  const plein = (page) => hote(page).evaluate((h) => h.classList.contains('plein-ecran'));

  test('classe posée pendant la caméra, position fixed sur tout l\'écran, retirée après « × »', async ({ page }) => {
    await ouvrir(page);
    expect(await plein(page)).toBe(false);
    await bouton(page, 'Activer la caméra').click();
    await attendre(page, 'ready');
    expect(await plein(page)).toBe(true);
    const r = await hote(page).evaluate((h) => {
      const s = getComputedStyle(h);
      const b = h.getBoundingClientRect();
      return { position: s.position, overscroll: s.overscrollBehavior, w: b.width, h: b.height, x: b.x, y: b.y, vw: innerWidth, vh: innerHeight };
    });
    expect(r.position).toBe('fixed');
    expect(r.overscroll).toContain('none');
    expect([r.x, r.y]).toEqual([0, 0]);
    expect(r.w).toBe(r.vw);
    expect(r.h).toBe(r.vh);
    await hote(page).locator('button[aria-label="Fermer"]').click();
    await expect.poll(() => plein(page)).toBe(false);
  });

  test('touchmove est annulé sur la surface de gestes et le body n\'est pas modifié', async ({ page }) => {
    await demarrer(page);
    const bodyAvant = await page.evaluate(() => document.body.getAttribute('style'));
    const annule = await surface(page).evaluate((el) => {
      const e = new Event('touchmove', { bubbles: true, cancelable: true, composed: true });
      el.dispatchEvent(e);
      return e.defaultPrevented;
    });
    expect(annule).toBe(true);
    expect(await surface(page).evaluate((el) => getComputedStyle(el).touchAction)).toBe('none');
    expect(await page.evaluate(() => document.body.getAttribute('style'))).toBe(bodyAvant);
  });

  test('retirer l\'élément retire aussi la classe (disconnectedCallback)', async ({ page }) => {
    await demarrer(page);
    const classe = await page.evaluate(() => {
      const h = document.querySelector('piscine-ar');
      h.remove();
      return h.classList.contains('plein-ecran');
    });
    expect(classe).toBe(false);
  });
});

import { test, expect } from '@playwright/test';
import { demarrer, regarderLeSol, pointeur, centre, pose, hote } from './helpers.js';

const cote = (page) => hote(page).locator('[data-role="cote"]').evaluate((e) => e.textContent);
// « 12,0 × 6,0 m » → { l: 12, L: 6 }
const dims = (t) => { const [l, L] = t.match(/[\d,]+/g).map((s) => parseFloat(s.replace(',', '.'))); return { l, L }; };

test.beforeEach(async ({ page }) => {
  await demarrer(page);
  await regarderLeSol(page);
});

test('un glisser déplace la position de plus de 0,1 m', async ({ page }) => {
  const c = await centre(page);
  await pointeur(page, 'pointerdown', 1, c.x, c.y + 60);
  const p1 = (await pose(page)).position;
  for (let i = 1; i <= 5; i++) await pointeur(page, 'pointermove', 1, c.x + i * 16, c.y + 60 + i * 24);
  const p2 = (await pose(page)).position;
  await pointeur(page, 'pointerup', 1, c.x + 80, c.y + 180);
  expect(Math.hypot(p2.x - p1.x, p2.z - p1.z)).toBeGreaterThan(0.1);
});

test('tourner deux doigts dans le sens horaire diminue rotationY', async ({ page }) => {
  const c = await centre(page);
  const R = 60;
  const doigts = (a) => [[c.x - R * Math.cos(a), c.y - R * Math.sin(a)], [c.x + R * Math.cos(a), c.y + R * Math.sin(a)]];
  const [[ax, ay], [bx, by]] = doigts(0);
  await pointeur(page, 'pointerdown', 1, ax, ay);
  await pointeur(page, 'pointerdown', 2, bx, by);
  for (let deg = 15; deg <= 45; deg += 15) { // y vers le bas : angle croissant = sens horaire à l'écran
    const [[x1, y1], [x2, y2]] = doigts((deg * Math.PI) / 180);
    await pointeur(page, 'pointermove', 1, x1, y1);
    await pointeur(page, 'pointermove', 2, x2, y2);
  }
  const { rotationY } = await pose(page);
  expect(rotationY).toBeLessThan(-0.6);
  expect(rotationY).toBeGreaterThan(-0.95);
  await pointeur(page, 'pointerup', 1, 0, 0);
  await pointeur(page, 'pointerup', 2, 0, 0);
});

async function pincer(page, de, a) {
  const c = await centre(page);
  await pointeur(page, 'pointerdown', 1, c.x - de / 2, c.y);
  await pointeur(page, 'pointerdown', 2, c.x + de / 2, c.y);
  const pas = 10;
  for (let i = 1; i <= pas; i++) {
    const d = de + ((a - de) * i) / pas;
    await pointeur(page, 'pointermove', 1, c.x - d / 2, c.y);
    await pointeur(page, 'pointermove', 2, c.x + d / 2, c.y);
  }
}

test('pincer ne change pas l\'échelle : scale reste 1 et la cote reste celle annoncée', async ({ page }) => {
  const depart = await cote(page);
  expect(depart).toBe('8,00 × 4,00 m');
  expect((await pose(page)).scale).toBe(1);
  await pincer(page, 100, 200);
  const c = await centre(page);
  await pointeur(page, 'pointerup', 1, c.x - 100, c.y);
  await pointeur(page, 'pointerup', 2, c.x + 100, c.y);
  expect((await pose(page)).scale).toBe(1);
  expect(await cote(page)).toBe(depart);
});

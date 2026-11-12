import { describe, it, expect } from 'vitest';
import { createGestureTracker } from '../../src/core/gestures.js';

// API supposée (plan §1) : tracker.handle({type, id, x, y}) → tableau d'intentions.
const ev = (type, id, x, y) => ({ type, id, x, y });
const of = (list, type) => list.filter((i) => i.type === type);
const somme = (list, type, cle) => of(list, type).reduce((a, i) => a + i[cle], 0);
const produit = (list) => of(list, 'pincer').reduce((a, i) => a * i.facteur, 1);

describe('createGestureTracker', () => {
  it('un appui donne deplacer à la position du doigt', () => {
    const g = createGestureTracker();
    expect(g.handle(ev('down', 1, 10, 20))).toEqual([{ type: 'deplacer', x: 10, y: 20 }]);
  });

  it('un doigt qui bouge donne deplacer à chaque mouvement', () => {
    const g = createGestureTracker();
    g.handle(ev('down', 1, 10, 20));
    expect(g.handle(ev('move', 1, 15, 25))).toEqual([{ type: 'deplacer', x: 15, y: 25 }]);
    expect(g.handle(ev('move', 1, 30, 40))).toEqual([{ type: 'deplacer', x: 30, y: 40 }]);
  });

  it('un move sans appui ne donne rien', () => {
    const g = createGestureTracker();
    expect(g.handle(ev('move', 7, 1, 1))).toEqual([]);
  });

  it('tourner de 90° dans le sens horaire donne dRad ≈ -π/2 (0,01 près)', () => {
    const g = createGestureTracker();
    g.handle(ev('down', 1, 100, 200));
    g.handle(ev('down', 2, 200, 200)); // doigt 2 à droite
    const out = g.handle(ev('move', 2, 100, 300)); // passe en dessous (horaire à l'écran, y vers le bas)
    expect(somme(out, 'tourner', 'dRad')).toBeCloseTo(-Math.PI / 2, 2);
    expect(of(out, 'deplacer')).toEqual([]);
  });

  it('tourner dans le sens antihoraire donne dRad positif', () => {
    const g = createGestureTracker();
    g.handle(ev('down', 1, 100, 200));
    g.handle(ev('down', 2, 200, 200));
    const out = g.handle(ev('move', 2, 100, 100));
    expect(somme(out, 'tourner', 'dRad')).toBeCloseTo(Math.PI / 2, 2);
  });

  it('écarter de 100 à 150 px donne facteur ≈ 1,5 (0,01 près)', () => {
    const g = createGestureTracker();
    g.handle(ev('down', 1, 100, 200));
    g.handle(ev('down', 2, 200, 200));
    const out = g.handle(ev('move', 2, 250, 200));
    expect(produit(out)).toBeCloseTo(1.5, 2);
  });

  it('rapprocher de 100 à 50 px donne facteur ≈ 0,5', () => {
    const g = createGestureTracker();
    g.handle(ev('down', 1, 100, 200));
    g.handle(ev('down', 2, 200, 200));
    const out = g.handle(ev('move', 2, 150, 200));
    expect(produit(out)).toBeCloseTo(0.5, 2);
  });

  it('le passage de ±π ne fait pas de saut', () => {
    const g = createGestureTracker();
    g.handle(ev('down', 1, 0, 0));
    const r = 100;
    const pt = (deg) => [r * Math.cos((deg * Math.PI) / 180), r * Math.sin((deg * Math.PI) / 180)];
    g.handle(ev('down', 2, ...pt(170)));
    let total = 0;
    for (let deg = 175; deg <= 190; deg += 5) {
      const out = g.handle(ev('move', 2, ...pt(deg)));
      const d = somme(out, 'tourner', 'dRad');
      expect(Math.abs(d)).toBeLessThan(0.2); // 5° = 0,087 rad ; un saut vaudrait ~2π
      total += d;
    }
    expect(total).toBeCloseTo(-(20 * Math.PI) / 180, 2);
  });

  it('après deux doigts, le doigt restant est ignoré jusqu\'à ce que tous soient levés', () => {
    const g = createGestureTracker();
    g.handle(ev('down', 1, 100, 200));
    g.handle(ev('down', 2, 200, 200));
    g.handle(ev('move', 2, 220, 200));
    g.handle(ev('up', 2, 220, 200));
    expect(g.handle(ev('move', 1, 120, 220))).toEqual([]);
    expect(g.handle(ev('move', 1, 130, 230))).toEqual([]);
    g.handle(ev('up', 1, 130, 230));
    // tous levés : un nouvel appui redonne deplacer
    expect(g.handle(ev('down', 3, 5, 6))).toEqual([{ type: 'deplacer', x: 5, y: 6 }]);
  });

  it('cancel retire le pointeur', () => {
    const g = createGestureTracker();
    g.handle(ev('down', 1, 10, 10));
    g.handle(ev('cancel', 1, 10, 10));
    expect(g.handle(ev('move', 1, 50, 50))).toEqual([]);
    // un nouveau doigt est de nouveau seul : pas de geste à deux doigts
    expect(g.handle(ev('down', 2, 7, 8))).toEqual([{ type: 'deplacer', x: 7, y: 8 }]);
  });
});

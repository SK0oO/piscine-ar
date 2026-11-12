const dEntre = (a, b) => ({ dx: b.x - a.x, dy: b.y - a.y });

// Ramène un écart d'angle dans [-π, π] (déroule le passage de ±π).
const derouler = (d) => {
  const t = 2 * Math.PI;
  return d - t * Math.round(d / t);
};

export function createGestureTracker() {
  const pointeurs = new Map();
  let multi = false;
  let angle = 0;
  let distance = 0;

  const mesure = () => {
    const [a, b] = [...pointeurs.values()];
    const { dx, dy } = dEntre(a, b);
    return { angle: Math.atan2(dy, dx), distance: Math.hypot(dx, dy) };
  };

  const retirer = (id) => {
    pointeurs.delete(id);
    if (pointeurs.size === 0) multi = false;
  };

  const handle = ({ type, id, x, y }) => {
    if (type === 'up' || type === 'cancel') {
      retirer(id);
      return [];
    }
    if (type === 'down') {
      if (pointeurs.has(id) || pointeurs.size >= 2 || (multi && pointeurs.size < 2)) return [];
      pointeurs.set(id, { x, y });
      if (pointeurs.size === 2) {
        multi = true;
        ({ angle, distance } = mesure());
        return [];
      }
      return [{ type: 'deplacer', x, y }];
    }
    if (type === 'move') {
      if (!pointeurs.has(id)) return [];
      pointeurs.set(id, { x, y });
      if (multi) {
        if (pointeurs.size < 2) return [];
        const m = mesure();
        const dRad = -derouler(m.angle - angle);
        const facteur = distance > 0 ? m.distance / distance : 1;
        angle = m.angle;
        distance = m.distance;
        return [
          { type: 'tourner', dRad },
          { type: 'pincer', facteur },
        ];
      }
      return [{ type: 'deplacer', x, y }];
    }
    return [];
  };

  return { handle };
}

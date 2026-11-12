const un = (n) => n.toFixed(1).replace('.', ',');

export function formatMetres(longueur, largeur, scale) {
  return `${un(longueur * scale)} × ${un(largeur * scale)} m`;
}

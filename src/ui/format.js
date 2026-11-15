// Cote au format de la maquette de Maxime : virgule, deux décimales (« 8,00 × 4,00 m »).
const deux = (n) => n.toFixed(2).replace('.', ',');

export function formatMetres(longueur, largeur, scale) {
  return `${deux(longueur * scale)} × ${deux(largeur * scale)} m`;
}

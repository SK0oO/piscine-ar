export const CODES = Object.freeze([
  'config-invalide',
  'camera-refusee',
  'camera-indisponible',
  'modele-introuvable',
  'modele-invalide',
  'webxr-echec',
  'photo-indisponible',
  'photo-echec',
]);

export class PiscineArError extends Error {
  constructor(code, message) {
    super(message ?? code);
    this.name = 'PiscineArError';
    this.code = code;
  }
}

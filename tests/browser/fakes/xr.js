// Faux navigator.xr : la RA est « supportée » mais requestSession est rejeté (le vrai WebXR est testé au terrain E6).
// À injecter avec page.addInitScript(installerXr) AVANT le chargement. Fonction autonome (sérialisée).
// Côté page : window.__xr = { demandes: [mode, ...] }.
export function installerXr() {
  const demandes = [];
  const xr = {
    isSessionSupported: async (mode) => mode === 'immersive-ar',
    requestSession: (mode) => {
      demandes.push(mode);
      return Promise.reject(new DOMException('Session refusée (faux)', 'NotSupportedError'));
    },
    addEventListener() {},
    removeEventListener() {},
  };
  Object.defineProperty(navigator, 'xr', { value: xr, configurable: true });
  window.__xr = { demandes };
}

// Faux DeviceOrientationEvent.requestPermission + émission d'événements `deviceorientation`.
// À injecter avec page.addInitScript(installerOrientation, { reponse }) AVANT le chargement.
// La fonction est sérialisée par Playwright : elle doit rester autonome (aucune variable extérieure).
// Côté page : window.__orientation = { appels, emettre({alpha, beta, gamma}) }.
export function installerOrientation({ reponse = 'granted' } = {}) {
  const etat = { appels: 0, reponse };
  const Base = window.DeviceOrientationEvent || function DeviceOrientationEvent() {};
  Base.requestPermission = () => {
    etat.appels += 1;
    return Promise.resolve(etat.reponse);
  };
  window.DeviceOrientationEvent = Base;
  window.__orientation = {
    get appels() { return etat.appels; },
    emettre({ alpha = 0, beta = 90, gamma = 0 } = {}) {
      const e = new Event('deviceorientation');
      Object.assign(e, { alpha, beta, gamma, absolute: false });
      window.dispatchEvent(e);
    },
  };
}

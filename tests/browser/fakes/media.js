// Enveloppe de getUserMedia et de HTMLMediaElement.play, au-dessus de la fausse caméra de Chromium.
// À injecter avec page.addInitScript(installerMedia, { refuser, rejeterPlay }) AVANT le chargement. Autonome (sérialisée).
// Côté page : window.__media = { appels (nombre de getUserMedia), flux (flux ouverts), contraintes }.
export function installerMedia({ refuser = false, rejeterPlay = false } = {}) {
  const etat = { appels: 0, flux: [], contraintes: [] };
  const reel = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = (c) => {
    etat.appels += 1;
    etat.contraintes.push(c);
    if (refuser) return Promise.reject(new DOMException('Permission refusée (faux)', 'NotAllowedError'));
    return reel(c).then((f) => { etat.flux.push(f); return f; });
  };
  if (rejeterPlay) {
    HTMLMediaElement.prototype.play = () => Promise.reject(new DOMException('Lecture bloquée (faux)', 'NotAllowedError'));
  }
  window.__media = etat;
}

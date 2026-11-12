// Page de démo : charge le bundle publié, reçoit la photo, dessine le QR code de la page.
// Rien n'est envoyé : la photo reste dans cette page.
import QRCode from 'qrcode';

// Le composant vient du même fichier que celui que Maxime colle chez le pisciniste.
const urlScript = new URL('../piscine-ar.js', document.baseURI).href;
import(/* @vite-ignore */ urlScript).catch((e) => {
  console.error('piscine-ar.js introuvable', e);
  window.__demoErreur = String((e && e.message) || e);
});

let urlPhoto = null;
const section = document.getElementById('devis');
const image = document.getElementById('photo-vue');
const message = document.getElementById('devis-message');

document.addEventListener('piscine-ar:photo', (e) => {
  if (urlPhoto) URL.revokeObjectURL(urlPhoto);
  urlPhoto = URL.createObjectURL(e.detail.blob);
  image.src = urlPhoto;
  message.hidden = true;
  section.hidden = false;
});

document.getElementById('devis-bouton').addEventListener('click', () => {
  message.hidden = false;
});

QRCode.toCanvas(document.getElementById('qr-canvas'), location.href, { width: 200, margin: 1 }, (err) => {
  if (err) console.error('QR code', err);
});

// Pages de démo (index.html et integree.html) : charge le bundle publié, applique une palette de marque,
// reçoit la photo, dessine le QR code de la page. Rien n'est envoyé : la photo reste dans cette page.
import QRCode from 'qrcode';

// Les quatre palettes de la maquette de Maxime (app.js, PRESETS). ?palette=<nom> dans l'adresse.
const PALETTES = {
  lagon: { water: '#19B5C8', deep: '#062A30', sand: '#EFF5F2', accent: '#FFD23F' },
  riviera: { water: '#2F86E0', deep: '#0B1B3F', sand: '#FBF5EA', accent: '#FF6B4A' },
  mineral: { water: '#5FA08C', deep: '#1B2420', sand: '#EEEBE3', accent: '#E9B872' },
  terre: { water: '#2BA8A0', deep: '#3A1D14', sand: '#F7EDE2', accent: '#E2582F' },
};

const luminance = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  const lin = (v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
};
const contraste = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
// Texte sur une couleur : le plus contrasté des deux, foncé ou blanc.
const texteSur = (fond, fonce) => (contraste(fond, fonce) >= contraste(fond, '#FFFFFF') ? fonce : '#FFFFFF');

const nom = new URLSearchParams(location.search).get('palette');
const palette = Object.hasOwn(PALETTES, nom ?? '') ? PALETTES[nom] : null;
if (palette) {
  const s = document.documentElement.style;
  for (const [cle, valeur] of Object.entries(palette)) s.setProperty(`--${cle}`, valeur);
  s.setProperty('--on-accent', texteSur(palette.accent, '#1B1600'));
  s.setProperty('--on-deep', luminance(palette.deep) < 0.4 ? '#F2FBFA' : '#101314'); // règle de la maquette
  s.setProperty('--ink', luminance(palette.sand) > 0.4 ? '#101314' : '#F4F7F6');
}

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
  if (!section) return;
  if (urlPhoto) URL.revokeObjectURL(urlPhoto);
  urlPhoto = URL.createObjectURL(e.detail.blob);
  image.src = urlPhoto;
  message.hidden = true;
  section.hidden = false;
});

document.getElementById('devis-bouton')?.addEventListener('click', () => {
  message.hidden = false;
});

const qr = document.getElementById('qr-canvas');
if (qr) {
  QRCode.toCanvas(qr, location.href, { width: 200, margin: 1 }, (err) => {
    if (err) console.error('QR code', err);
  });
}

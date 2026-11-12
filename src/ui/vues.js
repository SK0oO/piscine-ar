// Construction du DOM : createElement + textContent uniquement, jamais innerHTML.
const el = (tag, { classe, role, texte, attrs = {} } = {}, ...enfants) => {
  const n = globalThis.document.createElement(tag);
  if (classe) n.className = classe;
  if (role) n.dataset.role = role;
  if (texte !== undefined) n.textContent = texte;
  for (const [cle, valeur] of Object.entries(attrs)) n.setAttribute(cle, valeur);
  n.append(...enfants);
  return n;
};

const bouton = (texte, classe, surClic, attrs = {}) => {
  const b = el('button', { classe, texte, attrs: { type: 'button', ...attrs } });
  b.addEventListener('click', surClic);
  return b;
};

// Les barres ne doivent pas déclencher de « select » WebXR sous les doigts.
const protegerXr = (n) => {
  n.addEventListener('beforexrselect', (e) => e.preventDefault());
  return n;
};

export function vueMessage(texte) {
  return el('div', { classe: 'ecran' }, el('p', { texte }));
}

// Écran d'explication avant toute demande ; avec `erreur`, c'est l'écran « Réessayer ».
export function vueExplication({ textes, config, erreur, reessayer, sansCamera, surActiver, surSansCamera }) {
  const ecran = el('div', { classe: 'ecran', role: 'explication' });
  if (config) ecran.append(el('p', { classe: 'marque', texte: config.pisciniste.nom }));
  ecran.append(el('h2', { texte: textes.titre }));
  if (erreur) ecran.append(el('p', { classe: 'erreur', texte: erreur, attrs: { role: 'alert' } }));
  else ecran.append(el('p', { texte: textes.explication }));
  ecran.append(bouton(reessayer ? textes.reessayer : textes.autoriser, 'btn principal', surActiver));
  if (sansCamera) ecran.append(bouton(textes.voirSansCamera, 'lien', surSansCamera));
  return ecran;
}

// Vue principale. Renvoie la racine et les éléments que le composant pilote.
export function vuePiscine({ config, textes, canvas, avecVideo, surVignette, surFiger, surRecentrer, surEnregistrer, surReprendre }) {
  let video = null;
  const racine = el('div', { classe: 'piscine attente' });
  if (avecVideo) {
    video = el('video', { attrs: { autoplay: '', muted: '', playsinline: '', 'aria-hidden': 'true' } });
    video.muted = true;
    video.playsInline = true;
    racine.append(video);
  }
  racine.append(canvas);

  const gestes = el('div', { role: 'gestes' });
  const calque = el('div', { classe: 'calque', role: 'calque' });
  const cote = el('div', { classe: 'pastille', role: 'cote' });

  const pastille = el('div', { classe: 'pastille' });
  if (config.pisciniste.logo) pastille.append(el('img', { attrs: { src: config.pisciniste.logo, alt: '' } }));
  pastille.append(el('span', { texte: config.pisciniste.nom }));
  const haut = protegerXr(el('div', { classe: 'haut' }, pastille, cote));

  const aide = el('p', { classe: 'aide', texte: textes.aide });
  const vignettes = new Map();
  const modeles = el('div', { classe: 'modeles' });
  for (const m of config.modeles) {
    const b = el('button', { classe: 'modele', attrs: { type: 'button', 'data-modele': m.id, 'aria-pressed': 'false' } },
      el('img', { attrs: { src: m.vignette, alt: '' } }), el('span', { texte: m.nom }));
    b.addEventListener('click', () => surVignette(m));
    vignettes.set(m.id, b);
    modeles.append(b);
  }
  const figer = bouton(textes.figer, 'btn principal', surFiger);
  const recentrer = bouton('↻', 'btn rond', surRecentrer, { 'aria-label': textes.recentrer });
  const lienRA = el('div', { classe: 'lien-ra', role: 'lien-ra' });
  const barre = protegerXr(el('div', { classe: 'bas' }, aide, modeles, el('div', { classe: 'boutons' }, recentrer, lienRA, figer)));

  const photo = el('img', { role: 'photo', attrs: { alt: '' } });
  photo.hidden = true;
  const bandeau = el('div', { classe: 'bandeau' }, el('span', { classe: 'pastille', texte: textes.photoPrete }));
  bandeau.hidden = true;
  const barrePhoto = protegerXr(el('div', { classe: 'bas photo' },
    el('div', { classe: 'boutons' }, bouton(textes.reprendre, 'btn', surReprendre), bouton(textes.enregistrer, 'btn principal', surEnregistrer))));
  barrePhoto.hidden = true;

  racine.append(gestes, calque, haut, barre, photo, bandeau, barrePhoto);
  return { racine, video, calque, lienRA, gestes, cote, aide, vignettes, barre, barrePhoto, photo, bandeau };
}

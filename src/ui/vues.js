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

// Vignettes de sélection des modèles (écran de la piscine et accueil Quick Look).
function vignettesModeles(config, surVignette) {
  const vignettes = new Map();
  const modeles = el('div', { classe: 'modeles' });
  for (const m of config.modeles) {
    const b = el('button', { classe: 'modele', attrs: { type: 'button', 'data-modele': m.id, 'aria-pressed': 'false' } },
      el('img', { attrs: { src: m.vignette, alt: '' } }), el('span', { texte: m.nom }));
    b.addEventListener('click', () => surVignette(m));
    vignettes.set(m.id, b);
    modeles.append(b);
  }
  return { modeles, vignettes };
}

// Accueil iPhone : vignettes, lien Quick Look (construit par le composant dans `lienRA`) et lien secondaire « Aperçu caméra ».
export function vueQuickLook({ textes, config, surVignette, surCamera }) {
  const ecran = el('div', { classe: 'ecran', role: 'explication-quicklook' });
  ecran.append(el('p', { classe: 'marque', texte: config.pisciniste.nom }));
  ecran.append(el('h2', { texte: textes.titre }));
  ecran.append(el('p', { texte: textes.explicationQuickLook }));
  const { modeles, vignettes } = vignettesModeles(config, surVignette);
  protegerXr(modeles);
  const lienRA = el('div', { classe: 'lien-ra', role: 'lien-ra' });
  ecran.append(modeles, lienRA, bouton(textes.apercuCamera, 'lien', surCamera));
  return { ecran, vignettes, lienRA };
}

// Télécommande : pavé 3 × 3 (⟲ ↑ ⟳ / ← · → / − ↓ +). Appui long = répétition, gérée par `surTelecommande(action, actif)`.
const TOUCHES = [
  ['tournerG', '⟲', 'teleTournerGauche'], ['avant', '↑', 'teleAvant'], ['tournerD', '⟳', 'teleTournerDroite'],
  ['gauche', '←', 'teleGauche'], null, ['droite', '→', 'teleDroite'],
  ['moins', '−', 'teleReduire'], ['arriere', '↓', 'teleArriere'], ['plus', '+', 'teleAgrandir'],
];

function vueTelecommande(textes, surTelecommande) {
  const pave = el('div', { classe: 'telecommande', role: 'telecommande' });
  const boutons = {};
  for (const touche of TOUCHES) {
    if (!touche) {
      pave.append(el('span'));
      continue;
    }
    const [action, symbole, cle] = touche;
    const b = el('button', { classe: 'touche', texte: symbole, role: `tele-${action}`, attrs: { type: 'button', 'aria-label': textes[cle] } });
    const arreter = () => surTelecommande(action, false);
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      surTelecommande(action, true);
    });
    for (const nom of ['pointerup', 'pointercancel', 'pointerleave', 'lostpointercapture']) b.addEventListener(nom, arreter);
    b.addEventListener('click', (e) => {
      if (e.detail === 0) surTelecommande(action, true, true); // clavier : un seul pas
    });
    b.addEventListener('contextmenu', (e) => e.preventDefault());
    boutons[action] = b;
    pave.append(b);
  }
  return { pave, plus: boutons.plus, moins: boutons.moins };
}

// Vue principale. Renvoie la racine et les éléments que le composant pilote.
export function vuePiscine({ config, textes, canvas, avecVideo, surVignette, surFiger, surFixer, surRecentrer, surEnregistrer, surReprendre, surTelecommande, surFermer }) {
  let video = null;
  const racine = el('div', { classe: 'piscine attente' });
  if (avecVideo) {
    video = el('video', { attrs: { autoplay: '', muted: '', playsinline: '', 'aria-hidden': 'true' } });
    video.muted = true;
    video.playsInline = true;
    racine.append(video);
  }
  racine.append(canvas);

  const gestes = el('div', { classe: 'gestes', role: 'gestes' });
  const calque = el('div', { classe: 'calque', role: 'calque' });
  const cote = el('div', { classe: 'pastille', role: 'cote' });

  const pastille = el('div', { classe: 'pastille' });
  if (config.pisciniste.logo) pastille.append(el('img', { attrs: { src: config.pisciniste.logo, alt: '' } }));
  pastille.append(el('span', { texte: config.pisciniste.nom }));
  const haut = protegerXr(el('div', { classe: 'haut' }, pastille, cote));

  const aide = el('p', { classe: 'aide', texte: textes.aide });
  const { modeles, vignettes } = vignettesModeles(config, surVignette);
  const telecommande = vueTelecommande(textes, surTelecommande);
  const figer = bouton(textes.figer, 'btn principal', surFiger); // « Photo » ; le composant l'adoucit si une autre action est principale
  const fixer = bouton(textes.fixerSol, 'btn', surFixer); // « Fixer au sol » (RA Android) : pose au centre
  fixer.hidden = true;
  const recentrer = bouton('↻', 'btn rond', surRecentrer, { 'aria-label': textes.recentrer });
  const lienRA = el('div', { classe: 'lien-ra', role: 'lien-ra' });
  const barre = protegerXr(el('div', { classe: 'bas' }, aide, telecommande.pave, modeles, el('div', { classe: 'boutons' }, recentrer, lienRA, fixer, figer)));

  const photo = el('img', { role: 'photo', attrs: { alt: '' } });
  photo.hidden = true;
  const bandeau = el('div', { classe: 'bandeau' }, el('span', { classe: 'pastille', texte: textes.photoPrete }));
  bandeau.hidden = true;
  const barrePhoto = protegerXr(el('div', { classe: 'bas photo' },
    el('div', { classe: 'boutons' }, bouton(textes.reprendre, 'btn', surReprendre), bouton(textes.enregistrer, 'btn principal', surEnregistrer))));
  barrePhoto.hidden = true;

  const fermer = protegerXr(bouton('×', 'fermer', surFermer, { 'aria-label': textes.fermer }));
  racine.append(gestes, calque, haut, fermer, barre, photo, bandeau, barrePhoto);
  return { racine, video, calque, lienRA, gestes, cote, aide, vignettes, barre, barrePhoto, photo, bandeau, figer, fixer, recentrer, plus: telecommande.plus, moins: telecommande.moins };
}

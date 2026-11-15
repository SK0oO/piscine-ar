// CSS du composant (Shadow DOM). DA de la maquette de Maxime (plan §13) : les jetons de la page (--accent, --deep,
// --water, --sand, --on-accent, --on-deep, --fd, --fb) traversent le Shadow DOM ; le composant ne les redéclare jamais,
// il les lit dans ses variables --pa-*, avec la palette « lagon » en repli. Aucune police chargée ici.
// Texte 16 px minimum, cibles 44 px minimum, blanc sur verre sombre en vue caméra.
export const STYLES = `
:host { display: block; position: relative; overflow: hidden; -webkit-tap-highlight-color: transparent;
  --pa-water: var(--water, #19B5C8);
  --pa-deep: var(--deep, #062A30);
  --pa-sand: var(--sand, #EFF5F2);
  --pa-accent: var(--accent, #FFD23F);
  --pa-on-accent: var(--on-accent, #1B1600);
  --pa-on-deep: var(--on-deep, #F2FBFA);
  --pa-fd: var(--fd, "Bricolage Grotesque", "Avenir Next", system-ui, sans-serif);
  --pa-fb: var(--fb, "Onest", "Helvetica Neue", system-ui, sans-serif);
  --pa-verre: rgba(6,16,18,.55);
  --pa-r: 22px;
  --pa-ease: cubic-bezier(.2,.8,.2,1);
  background: var(--pa-deep); color: var(--pa-on-deep); font: 400 16px/1.45 var(--pa-fb); }
* { box-sizing: border-box; }
/* Modes caméra : l'hôte couvre tout l'écran ; !important pour résister aux styles de la page hôte. */
:host(.plein-ecran) { position: fixed !important; inset: 0 !important; width: 100% !important; height: 100% !important; max-width: none !important; max-height: none !important; margin: 0 !important; z-index: 2147483000 !important; overscroll-behavior: none; touch-action: none; }
[hidden] { display: none !important; }
.racine { position: absolute; inset: 0; container: piscine / size; }
button { font: 500 16px/1.2 var(--pa-fb); color: #fff; cursor: pointer; }
:focus-visible { outline: 3px solid var(--pa-accent); outline-offset: 3px; }

/* ---------- Vue caméra ---------- */
.piscine { position: absolute; inset: 0; }
.piscine.attente { visibility: hidden; }
.piscine video, .piscine canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.piscine video { object-fit: cover; background: var(--pa-deep); }
.gestes { position: absolute; inset: 0; z-index: 2; touch-action: none; }
.calque { position: absolute; inset: 0; z-index: 3; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; pointer-events: none; }
.calque > * { pointer-events: auto; }
.haut { position: absolute; z-index: 4; top: calc(16px + env(safe-area-inset-top)); left: 68px; right: 68px; display: flex; flex-direction: column; align-items: center; gap: 12px; pointer-events: none; }
.pastille { display: inline-flex; align-items: center; gap: 8px; max-width: 100%; padding: 10px 16px; border-radius: 999px; background: var(--pa-verre); -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); color: #fff; font: 600 16px/1.2 var(--pa-fb); }
.pastille span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pastille img { display: block; height: 24px; width: auto; }
/* Cote de Maxime : pastille sombre posée sur une ligne de cote fine à taquets. */
.pastille[data-role="cote"] { position: relative; overflow: visible; font-variant-numeric: tabular-nums; }
.pastille[data-role="cote"]::before, .pastille[data-role="cote"]::after { content: ""; position: absolute; top: calc(50% - 7px); width: 28px; height: 14px; background: linear-gradient(#fff, #fff) center / 100% 1.5px no-repeat; filter: drop-shadow(0 1px 1px rgba(0,0,0,.45)); }
.pastille[data-role="cote"]::before { right: calc(100% + 4px); border-left: 1.5px solid #fff; }
.pastille[data-role="cote"]::after { left: calc(100% + 4px); border-right: 1.5px solid #fff; }
.fermer { position: absolute; z-index: 6; top: calc(16px + env(safe-area-inset-top)); right: 16px; width: 44px; height: 44px; padding: 0; border: 0; border-radius: 50%; background: var(--pa-verre); -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); color: #fff; font-size: 26px; line-height: 1; }

.bas { position: absolute; z-index: 5; left: 0; right: 0; bottom: 0; padding: 40px 16px calc(20px + env(safe-area-inset-bottom)); background: linear-gradient(180deg, transparent, rgba(6,16,18,.7) 45%); background: linear-gradient(180deg, transparent, color-mix(in oklab, var(--pa-deep) 82%, transparent) 45%); }
.aide { margin: 0 auto 12px; width: fit-content; max-width: 100%; text-align: center; padding: 10px 16px; border-radius: 999px; background: var(--pa-verre); -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); color: #fff; font: 600 16px/1.3 var(--pa-fb); pointer-events: none; }
.telecommande { display: grid; grid-template-columns: repeat(3, 48px); gap: 8px; margin: 0 0 14px auto; width: fit-content; padding: 8px; border-radius: var(--pa-r); background: var(--pa-verre); -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); box-shadow: 0 18px 36px -18px rgba(0,0,0,.6); }
.touche { width: 48px; height: 48px; min-width: 44px; min-height: 44px; padding: 0; border: 0; border-radius: 50%; background: rgba(255,255,255,.16); color: #fff; font-size: 22px; line-height: 1; touch-action: manipulation; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
.touche:active { background: var(--pa-accent); color: var(--pa-on-accent); }
.modeles { display: flex; gap: 10px; margin-bottom: 14px; }
.modele { flex: 1; min-width: 0; padding: 6px 6px 10px; border: 0; border-radius: 16px; background: rgba(255,255,255,.1); box-shadow: inset 0 0 0 1.5px rgba(255,255,255,.18); -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); text-align: center; color: #fff; font: 500 16px/1.2 var(--pa-fb); }
.modele img { display: block; width: 100%; height: 64px; object-fit: cover; border-radius: 11px; margin-bottom: 8px; }
.modele span { display: block; overflow-wrap: anywhere; text-wrap: balance; }
.modele[aria-pressed="true"] { background: rgba(255,255,255,.2); box-shadow: inset 0 0 0 3px var(--pa-accent); }

/* ---------- Boutons : pilules de Maxime ---------- */
.boutons { display: flex; gap: 10px; }
.btn { flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 10px; min-height: 54px; padding: 0 20px; border: 1.5px solid rgba(255,255,255,.55); border-radius: 999px; background: rgba(255,255,255,.08); -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); color: #fff; font: 600 17px/1 var(--pa-fb); white-space: nowrap; }
.btn.principal { border-color: transparent; background: var(--pa-accent); color: var(--pa-on-accent); box-shadow: 0 12px 26px -12px rgba(0,0,0,.55); }
.btn.rond { flex: 0 0 54px; padding: 0; font-size: 22px; }
/* Icône d'obturateur de Maxime (.photo__snap i) : anneau et point, en couleur du texte. */
.obturateur { position: relative; flex: none; width: 20px; height: 20px; border-radius: 50%; border: 2px solid currentColor; }
.obturateur::after { content: ""; position: absolute; inset: 3px; border-radius: 50%; background: currentColor; }
.lien-ra { display: contents; }
.lien-ra a { flex: 1; min-height: 54px; display: inline-flex; align-items: center; justify-content: center; gap: 10px; padding: 0 16px; border: 1.5px solid rgba(255,255,255,.55); border-radius: 999px; background: rgba(255,255,255,.08); color: #fff; font: 600 16px/1.1 var(--pa-fb); text-decoration: none; }
.lien-ra a.principal { border-color: transparent; background: var(--pa-accent); color: var(--pa-on-accent); box-shadow: 0 12px 26px -12px rgba(0,0,0,.55); }
.lien-ra a img { height: 34px; width: 34px; object-fit: cover; border-radius: 50%; }
.lien { min-height: 44px; padding: 10px 12px; border: 0; background: none; color: inherit; font: 500 16px/1.3 var(--pa-fb); text-decoration: underline; text-decoration-thickness: 1.5px; text-underline-offset: 5px; text-align: center; }
@media (prefers-reduced-motion: no-preference) {
  .btn, .lien-ra a, .touche, .modele { transition: transform .35s var(--pa-ease), background-color .25s, box-shadow .25s; }
  .btn:active, .lien-ra a:active { transform: scale(.97); }
}

/* ---------- Photo figée ---------- */
[data-role="photo"] { position: absolute; inset: 0; z-index: 6; width: 100%; height: 100%; object-fit: cover; outline: 6px solid #fff; outline-offset: -6px; }
.bandeau { position: absolute; z-index: 7; top: calc(16px + env(safe-area-inset-top)); left: 16px; right: 16px; text-align: center; }
.bas.photo { z-index: 7; }

/* ---------- Écrans d'accueil (fond --deep, titres Bricolage serrés) ---------- */
.ecran { position: absolute; inset: 0; z-index: 20; display: flex; flex-direction: column; justify-content: flex-end; padding: 28px 24px calc(28px + env(safe-area-inset-bottom)); overflow: auto;
  background-color: var(--pa-deep); color: var(--pa-on-deep);
  background-image: radial-gradient(120% 55% at 85% 0%, color-mix(in oklab, var(--pa-water) 26%, transparent), transparent 70%); }
.ecran > :not(.apercu) { position: relative; z-index: 1; }
.ecran .marque { margin: 0 0 10px; font: 500 16px/1.3 var(--pa-fb); opacity: .8; }
.ecran h2 { margin: 0 0 14px; font: 700 clamp(28px, 8.6cqw, 34px)/1.02 var(--pa-fd); letter-spacing: -.02em; text-wrap: balance; }
.ecran p { margin: 0 0 22px; font: 400 17px/1.5 var(--pa-fb); color: color-mix(in oklab, var(--pa-on-deep) 78%, transparent); text-wrap: pretty; }
.ecran .erreur { padding: 12px 16px; border-radius: 16px; background: rgba(255,255,255,.1); box-shadow: inset 0 0 0 1.5px color-mix(in oklab, var(--pa-accent) 70%, transparent); color: var(--pa-on-deep); font-size: 16px; }
.ecran .apercu { position: relative; flex: 1 1 0; min-height: 0; max-height: calc((100cqw - 48px) * .75); margin: 0 0 22px; border-radius: var(--pa-r); overflow: hidden; background: color-mix(in oklab, var(--pa-deep) 88%, var(--pa-water)); box-shadow: 0 0 0 1px color-mix(in oklab, var(--pa-on-deep) 18%, transparent), 0 30px 60px -30px #000; }
.ecran .apercu img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; }
.ecran .btn { flex: 0 0 auto; width: 100%; margin-bottom: 10px; }
.ecran .modeles { margin-bottom: 18px; }
.ecran .lien-ra a { flex: 0 0 auto; width: 100%; margin-bottom: 10px; }
.ecran .lien { align-self: center; }
/* La grande vignette seulement quand la place le permet. */
@container piscine (max-height: 599px) { .ecran .apercu { display: none; } }
@container piscine (max-height: 819px) { .ecran[data-role="explication-quicklook"] .apercu { display: none; } }

/* ---------- Accueil compact : intégré dans la boîte 4:3 de la page, sous ses onglets (64 px du haut libres) ---------- */
.compact .ecran { padding: 64px 16px 12px; background-image: none; }
/* Seuls les accueils s'allègent ; « Chargement… » et l'erreur de config restent lisibles. */
.compact .ecran .marque, .compact .ecran h2, .compact [data-role^="explication"] p:not(.erreur), .compact .ecran .modeles, .compact .ecran .lien-ra a img { display: none; }
.compact .ecran .erreur { margin-bottom: 10px; padding: 8px 12px; background: var(--pa-verre); line-height: 1.35; }
.compact .ecran .apercu { display: block; position: absolute; inset: 0; z-index: 0; max-height: none; margin: 0; border-radius: 0; box-shadow: none; }
.compact .ecran .apercu::after { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, color-mix(in oklab, var(--pa-deep) 45%, transparent) 0, transparent 34%, transparent 42%, color-mix(in oklab, var(--pa-deep) 88%, transparent) 100%); }
.compact .ecran .btn, .compact .ecran .lien-ra a { margin-bottom: 4px; box-shadow: 0 12px 26px -10px rgba(0,0,0,.6); }
.compact .ecran .lien { padding-block: 8px; color: #fff; text-shadow: 0 1px 3px rgba(0,0,0,.6); }
`;

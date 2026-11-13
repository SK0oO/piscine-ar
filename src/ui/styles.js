// CSS du composant (Shadow DOM). Texte 16 px minimum, blanc sur fond sombre semi-opaque.
export const STYLES = `
:host { display: block; position: relative; overflow: hidden; background: #0f1419; color: #fff;
  font: 16px/1.4 -apple-system, "Segoe UI", system-ui, sans-serif; -webkit-tap-highlight-color: transparent;
  --accent: #1f6f9f; --fond: rgba(15, 20, 25, .72); }
* { box-sizing: border-box; }
[hidden] { display: none !important; }
.racine { position: absolute; inset: 0; }
button { font: inherit; font-size: 16px; color: #fff; cursor: pointer; }

.piscine { position: absolute; inset: 0; }
.piscine.attente { visibility: hidden; }
.piscine video, .piscine canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.piscine video { object-fit: cover; background: #0f1419; }
.gestes { position: absolute; inset: 0; z-index: 2; touch-action: none; }
.calque { position: absolute; inset: 0; z-index: 3; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; pointer-events: none; }
.calque > * { pointer-events: auto; }
.haut { position: absolute; z-index: 4; top: calc(16px + env(safe-area-inset-top)); left: 16px; right: 16px; display: flex; flex-direction: column; align-items: center; gap: 10px; pointer-events: none; }
.pastille { display: inline-flex; align-items: center; gap: 8px; background: var(--fond); color: #fff; font-size: 16px; padding: 10px 14px; border-radius: 14px; }
.pastille img { display: block; height: 24px; width: auto; }

.bas { position: absolute; z-index: 5; left: 0; right: 0; bottom: 0; padding: 14px 16px calc(20px + env(safe-area-inset-bottom)); background: linear-gradient(180deg, transparent, rgba(15, 20, 25, .85) 40%); }
.aide { margin: 0 auto 12px; width: fit-content; max-width: 100%; text-align: center; background: var(--fond); color: #fff; font-size: 16px; padding: 10px 16px; border-radius: 14px; pointer-events: none; }
.modeles { display: flex; gap: 12px; margin-bottom: 14px; }
.modele { flex: 1; min-width: 0; background: rgba(255, 255, 255, .12); border: 2px solid transparent; border-radius: 16px; padding: 8px; text-align: center; }
.modele img { display: block; width: 100%; height: 64px; object-fit: cover; border-radius: 10px; margin-bottom: 6px; }
.modele span { display: block; overflow-wrap: anywhere; }
.modele[aria-pressed="true"] { border-color: #fff; background: rgba(255, 255, 255, .22); box-shadow: 0 0 0 2px var(--accent); }
.boutons { display: flex; gap: 12px; }
.btn { flex: 1; min-height: 56px; padding: 0 16px; border: 0; border-radius: 18px; font-size: 17px; font-weight: 600; background: rgba(255, 255, 255, .18); }
.btn.principal { background: #fff; color: #111; }
.lien-ra { display: contents; }
.lien-ra a { flex: 1; min-height: 56px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 0 12px; border-radius: 18px; background: rgba(255, 255, 255, .18); color: #fff; font-size: 16px; font-weight: 600; text-decoration: none; }
.lien-ra a.principal { background: #fff; color: #111; }
.lien-ra a img { height: 32px; width: 32px; object-fit: cover; border-radius: 8px; }
.btn.rond { flex: 0 0 56px; padding: 0; }

[data-role="photo"] { position: absolute; inset: 0; z-index: 6; width: 100%; height: 100%; object-fit: cover; outline: 6px solid #fff; outline-offset: -6px; }
.bandeau { position: absolute; z-index: 7; top: calc(16px + env(safe-area-inset-top)); left: 16px; right: 16px; text-align: center; }
.bas.photo { z-index: 7; }

.ecran { position: absolute; inset: 0; z-index: 20; background: #0f1419; display: flex; flex-direction: column; justify-content: flex-end; padding: 28px 24px calc(44px + env(safe-area-inset-bottom)); overflow: auto; }
.ecran::before { content: ""; position: absolute; left: 0; right: 0; top: 0; height: 45%; background: linear-gradient(180deg, #9fc6e8, #5c8a3f); opacity: .9; }
.ecran > * { position: relative; }
.ecran h2 { margin: 0 0 10px; font-size: 26px; line-height: 1.2; }
.ecran p { margin: 0 0 22px; font-size: 17px; line-height: 1.45; color: #d7dde3; }
.ecran .marque { margin: 0 0 12px; font-size: 16px; color: #9fb3c4; }
.ecran .erreur { padding: 10px 14px; border-radius: 14px; background: rgba(255, 255, 255, .12); color: #fff; }
.ecran .btn { flex: 0 0 56px; width: 100%; margin-bottom: 12px; }
.ecran .modeles { margin-bottom: 18px; }
.ecran .lien-ra a { flex: 0 0 56px; width: 100%; margin-bottom: 12px; }
.ecran .lien { background: none; border: 0; padding: 12px; font-size: 16px; color: #cfe0ee; text-decoration: underline; text-align: center; }
`;

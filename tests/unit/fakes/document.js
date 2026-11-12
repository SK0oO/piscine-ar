// Faux document minimal (sans jsdom) pour l'adaptateur Quick Look.
// createElement(tag) -> élément factice : tagName, attributs, children, href/src/hidden/textContent, relList.supports.
export function creerDocumentFactice({ supporteAr = true } = {}) {
  const creer = (tag) => {
    const el = {
      tagName: String(tag).toUpperCase(),
      children: [],
      attributs: {},
      hidden: false,
      style: {},
      textContent: '',
      relList: { supports: (jeton) => (jeton === 'ar' ? supporteAr : false) },
      appendChild(c) { el.children.push(c); return c; },
      append(...cs) { el.children.push(...cs); },
      replaceChildren(...cs) { el.children = [...cs]; },
      setAttribute(k, v) { el.attributs[k] = String(v); if (k === 'href') el.href = String(v); },
      getAttribute(k) { return k in el.attributs ? el.attributs[k] : null; },
      addEventListener() {},
      removeEventListener() {},
      remove() {},
      click() { el.clics = (el.clics ?? 0) + 1; },
    };
    return el;
  };
  return { createElement: creer };
}

// Cherche récursivement les éléments d'un tag donné sous `racine`.
export function trouver(racine, tag) {
  const T = tag.toUpperCase();
  const out = [];
  const parcourir = (n) => {
    for (const c of n.children ?? []) {
      if (c.tagName === T) out.push(c);
      parcourir(c);
    }
  };
  parcourir(racine);
  return out;
}

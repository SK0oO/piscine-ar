import { describe, it, expect } from 'vitest';
import { STYLES } from '../../src/ui/styles.js';

// Lot V5 (plan §13) : les jetons de la page de Maxime traversent le Shadow DOM ; le composant n'en masque aucun.
const norme = STYLES.replace(/\s+/g, ' ').toLowerCase();

// Déclarations de la règle dont le sélecteur est exactement `selecteur`.
const regle = (selecteur) => {
  const m = STYLES.match(new RegExp(`(?:^|\\})\\s*${selecteur.replace(/[.[\]]/g, '\\$&')}\\s*\\{([^}]*)\\}`));
  return m ? m[1] : null;
};

describe('STYLES — jetons de la DA', () => {
  it('ne déclare jamais --accent (il masquerait celui de la page)', () => {
    expect(STYLES).not.toMatch(/(^|[^\w-])--accent\s*:/);
  });

  it('ne déclare jamais --fond', () => {
    expect(STYLES).not.toMatch(/(^|[^\w-])--fond\s*:/);
  });

  it.each(['var(--accent,', 'var(--deep,', 'var(--water,', 'var(--fd,', 'var(--fb,'])('lit %s sur la page', (jeton) => {
    expect(norme).toContain(jeton);
  });

  it.each([
    ['--pa-water', 'var(--water, #19b5c8)'],
    ['--pa-deep', 'var(--deep, #062a30)'],
    ['--pa-sand', 'var(--sand, #eff5f2)'],
    ['--pa-accent', 'var(--accent, #ffd23f)'],
    ['--pa-on-accent', 'var(--on-accent, #1b1600)'],
    ['--pa-on-deep', 'var(--on-deep, #f2fbfa)'],
  ])('%s se replie sur la palette lagon', (nom, valeur) => {
    expect(norme).toContain(`${nom}: ${valeur}`);
  });

  it('--pa-r vaut 22px et --pa-ease la courbe de Maxime', () => {
    expect(norme).toContain('--pa-r: 22px');
    expect(norme).toContain('--pa-ease: cubic-bezier(.2,.8,.2,1)');
  });
});

describe('STYLES — bouton principal', () => {
  it('.btn.principal prend --pa-accent, pas du blanc', () => {
    const decl = regle('.btn.principal');
    expect(decl).not.toBeNull();
    expect(decl).toContain('var(--pa-accent)');
    expect(decl).not.toMatch(/#fff\b|#ffffff\b|white/i);
  });

  it('.btn.principal écrit son texte en --pa-on-accent', () => {
    expect(regle('.btn.principal')).toContain('var(--pa-on-accent)');
  });

  it('le lien Quick Look principal suit le bouton principal (--pa-accent)', () => {
    const decl = regle('.lien-ra a.principal');
    expect(decl).not.toBeNull();
    expect(decl).toContain('var(--pa-accent)');
    expect(decl).not.toMatch(/#fff\b|#ffffff\b|white/i);
  });
});

import { fontSize, lineHeightFor, radius, space } from '../../theme/tokens';

/**
 * F6 (A11Y-14 / TYPO-01): tipografska skala.
 *
 * Zašto test: skala je prije imala `label: 9` i `meta: 10` — mikro-labele ispod
 * svake granice čitljivosti, a `MonoLabel`/`MonoMeta` su najčešći elementi u
 * aplikaciji. Veličine se lako „vrate" pri nekoj doradi, pa ih ovaj test drži.
 */

describe('tipografska skala', () => {
  it('nijedna veličina nije manja od 11 px', () => {
    for (const [name, value] of Object.entries(fontSize)) {
      expect(value).toBeGreaterThanOrEqual(11);
    }
  });

  it('skala je strogo rastuća (hijerarhija je očuvana)', () => {
    const ordered = [
      fontSize.label,
      fontSize.meta,
      fontSize.body,
      fontSize.bodyLg,
      fontSize.section,
      fontSize.title,
      fontSize.readoutLg,
      fontSize.readoutXl,
    ];
    for (let index = 1; index < ordered.length; index += 1) {
      expect(ordered[index]).toBeGreaterThan(ordered[index - 1]);
    }
  });

  it('visina reda je 1,35× veličine (dovoljno za 200% uvećanje)', () => {
    expect(lineHeightFor(13)).toBe(18);
    expect(lineHeightFor(15)).toBe(20);
    // Najmanje 1,3 — ispod toga se redovi preklapaju u uskim kolonama.
    for (const value of Object.values(fontSize)) {
      expect(lineHeightFor(value) / value).toBeGreaterThanOrEqual(1.3);
    }
  });
});

describe('spacing', () => {
  it('skala je 4/8/12/16/24/32 i svi su višekratnici od 4', () => {
    expect(Object.values(space)).toEqual([4, 8, 12, 16, 24, 32]);
  });

  it('radijusi su konzervativni: 2 / 3 / 4, pill samo za LED', () => {
    expect(radius.tag).toBe(2);
    expect(radius.control).toBe(3);
    expect(radius.panel).toBe(4);
    expect(radius.pill).toBe(999);
  });
});

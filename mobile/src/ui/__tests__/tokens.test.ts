import {
  darkTokens,
  lightTokens,
  themeTokens,
  tokensFor,
  space,
  radius,
  fontFamily,
  systemFontFamily,
  MIN_TOUCH,
} from '../../theme/tokens';

/**
 * F0 ugovor: token sloj mora biti potpun i simetričan.
 *
 * Zašto test: cilj refaktora je da se 228 `useColorModeValue` poziva zamijeni
 * imenima tokena. Ako jedno ime postoji samo u dark temi, ekran u svijetloj
 * temi dobija `undefined` boju — a to se u RN-u vidi kao crni tekst na crnom,
 * ne kao greška. Zato simetrija mora biti testirana, ne pretpostavljena.
 */
describe('design tokens', () => {
  it('definiše isti skup imena u obje teme', () => {
    const darkKeys = Object.keys(darkTokens).sort();
    const lightKeys = Object.keys(lightTokens).sort();
    expect(lightKeys).toEqual(darkKeys);
  });

  it('nema praznih vrijednosti', () => {
    for (const [mode, tokens] of Object.entries(themeTokens)) {
      for (const [key, value] of Object.entries(tokens)) {
        expect(`${mode}.${key}="${value}"`).toMatch(/="#|="rgba\(/);
      }
    }
  });

  it('dark i light se razlikuju za podlogu, tekst i ivicu', () => {
    expect(darkTokens.canvas).not.toBe(lightTokens.canvas);
    expect(darkTokens.ink).not.toBe(lightTokens.ink);
    expect(darkTokens.line).not.toBe(lightTokens.line);
  });

  it('signal je brand narandžasta u obje teme', () => {
    // Ista familija boje kao web `--signal: 255 107 61`; svijetla varijanta je
    // zatamnjeni signal zbog kontrasta na bijelom.
    //
    // F6 (A11Y-01): svijetla varijanta je zatamnjena sa #e85223 na #c2410c.
    // #e85223 je davao 3,71:1 na panelu i 3,46:1 na `canvas` — pada AA za
    // normalan tekst, a pošto je signal i podloga primarnog dugmeta, i bijeli
    // tekst na njemu je bio ispod granice. Nova vrijednost je 5,18 / 4,84.
    expect(darkTokens.signal).toBe('#ff6b3d');
    // 2026-11-21: #c2410c je prolazio na podlozi, ali je kao tekst na vlastitoj
    // 10% podlozi (`signalSoft`) davao 4,14:1. #b43a0c daje 4,61:1 — v. web
    // `design/__tests__/contrast.test.ts`, koji poredi obje palete.
    expect(lightTokens.signal).toBe('#b43a0c');
  });

  it('`tokensFor` vraća dark za nepoznatu vrijednost (fail-safe na default)', () => {
    expect(tokensFor('dark')).toBe(darkTokens);
    expect(tokensFor('light')).toBe(lightTokens);
    // @ts-expect-error — namjerno nevalidan ulaz
    expect(tokensFor('nešto')).toBe(darkTokens);
  });

  it('skala razmaka je 4px baza', () => {
    expect(space.xs).toBe(4);
    expect(space.sm).toBe(8);
    expect(space.md).toBe(12);
    expect(space.lg).toBe(16);
    expect(space.xl).toBe(24);
    expect(space.xxl).toBe(32);
  });

  it('radijusi su 2 / 3 / 4 (instrument panel, ne pill)', () => {
    expect(radius.tag).toBe(2);
    expect(radius.control).toBe(3);
    expect(radius.panel).toBe(4);
  });

  it('IBM Plex familije su registrovane pod imenima koja odgovaraju ttf fajlovima', () => {
    expect(fontFamily.sans).toBe('IBMPlexSans_400Regular');
    expect(fontFamily.mono).toBe('IBMPlexMono_400Regular');
    // Fallback mora imati ista polja da `resolveFontFamilies` ne mijenja oblik.
    expect(Object.keys(systemFontFamily).sort()).toEqual(Object.keys(fontFamily).sort());
  });

  it('dodirna zona nije manja od 44px', () => {
    expect(MIN_TOUCH).toBeGreaterThanOrEqual(44);
  });
});

import {
  darkTokens,
  lightTokens,
  MIN_TOUCH,
  space,
  type ThemeTokens,
} from '../../theme/tokens';

/**
 * F6 (A11Y-01): WCAG 2.2 AA je minimalni standard za cijeli mobilni UI, AAA gdje
 * je praktično.
 *
 * Ovaj test je „čuvar palete": mjeri stvarni kontrast svakog tekstualnog tokena
 * na sve tri podloge (`panel`, `canvas`, `raised`) i pada ako neko sljedećom
 * izmjenom boja vrati vrijednost koja je nekada bila ispod granice. Prije F6:
 * u svijetloj temi `ok` je imao 3,30:1, `signal` 3,71:1, `info` 4,10:1, a u
 * tamnoj `inkDim` 4,22:1 — dakle četiri tokena ispod AA za normalan tekst.
 */

type Rgb = [number, number, number];

function toRgb(hex: string): Rgb {
  const clean = hex.replace('#', '');
  return [0, 2, 4].map((index) => parseInt(clean.slice(index, index + 2), 16) / 255) as Rgb;
}

function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4),
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.2 kontrastni odnos, zaokružen na dvije decimale. */
export function contrastRatio(foreground: string, background: string): number {
  const a = luminance(foreground);
  const b = luminance(background);
  const [light, dark] = a > b ? [a, b] : [b, a];
  return Math.round(((light + 0.05) / (dark + 0.05)) * 100) / 100;
}

const SURFACES = ['panel', 'canvas', 'raised'] as const;

/** Tokeni koji se koriste kao boja teksta (`Text`, `MonoLabel`, `MonoMeta`). */
const TEXT_TOKENS = [
  'ink',
  'inkMuted',
  'inkDim',
  'signal',
  'signalInk',
  'ok',
  'warn',
  'fault',
  'info',
] as const;

describe.each([
  ['dark', darkTokens],
  ['light', lightTokens],
] as const)('%s tema', (_name, tokens: ThemeTokens) => {
  it.each(TEXT_TOKENS)('%s prolazi AA (4,5:1) na svakoj podlozi', (token) => {
    for (const surface of SURFACES) {
      const ratio = contrastRatio(tokens[token], tokens[surface]);
      expect({ token, surface, ratio }).toEqual({
        token,
        surface,
        ratio: expect.any(Number),
      });
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('tekst na signalnoj podlozi (dugme) prolazi AA', () => {
    expect(contrastRatio(tokens.onSignal, tokens.signal)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(tokens.onSignal, tokens.ok)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(tokens.onSignal, tokens.fault)).toBeGreaterThanOrEqual(4.5);
  });

  it('primarni tekst prolazi AAA (7:1)', () => {
    for (const surface of SURFACES) {
      expect(contrastRatio(tokens.ink, tokens[surface])).toBeGreaterThanOrEqual(7);
    }
  });
});

describe('skala razmaka i dodirnih zona', () => {
  it('dodirna zona nije manja od 44 pt (WCAG 2.2 — 2.5.8 Target Size)', () => {
    expect(MIN_TOUCH).toBeGreaterThanOrEqual(44);
  });

  it('razmaci su višekratnici od 4, pa vertikalni ritam ostaje konzistentan', () => {
    for (const value of Object.values(space)) {
      expect(value % 4).toBe(0);
    }
  });
});

import { describe, expect, it } from 'vitest';
import { pageWindow } from '../../lib/page-window';

/**
 * Granice stranice (`36`). Brojevi se prikazuju korisniku, pa off-by-one nije
 * kozmetika: „41–40 od 302" ili „303 od 302" je greška koju vidi odmah.
 */
describe('pageWindow', () => {
  it('prva strana počinje od 1', () => {
    expect(pageWindow(302, 0, 20)).toMatchObject({ from: 1, to: 20 });
  });

  it('srednja strana pokazuje tačan raspon', () => {
    expect(pageWindow(302, 20, 20)).toMatchObject({ from: 21, to: 40 });
  });

  it('zadnja strana se reže na ukupan broj', () => {
    expect(pageWindow(302, 300, 20)).toMatchObject({ from: 301, to: 302 });
  });

  it('nazad nema na prvoj strani, naprijed nema na zadnjoj', () => {
    expect(pageWindow(302, 0, 20)).toMatchObject({ canPrev: false, canNext: true });
    expect(pageWindow(302, 300, 20)).toMatchObject({ canPrev: true, canNext: false });
  });

  it('prazna tabela nema raspon ni navigaciju', () => {
    expect(pageWindow(0, 0, 20)).toEqual({
      from: 0,
      to: 0,
      canPrev: false,
      canNext: false,
    });
  });

  it('offset izvan opsega ne izmišlja redove', () => {
    expect(pageWindow(10, 20, 20)).toMatchObject({ from: 10, to: 10, canNext: false });
  });
});

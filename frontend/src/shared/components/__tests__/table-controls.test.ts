import { describe, expect, it } from 'vitest';
import { pageList, pageWindow } from '../../lib/page-window';

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

describe('pageList', () => {
  it('vraća sve stranice kad ih je malo', () => {
    expect(pageList(3, 1)).toEqual([1, 2, 3]);
    expect(pageList(7, 4)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('na prvoj strani drži početak i zadnju', () => {
    // Prozor je 5 brojeva; prva strana nema lijevi „…", pa se prikaže 6 uzastopnih.
    expect(pageList(16, 1)).toEqual([1, 2, 3, 4, 5, 6, 'gap', 16]);
  });

  it('u sredini pokaže prozor oko aktivne strane', () => {
    expect(pageList(16, 8)).toEqual([1, 'gap', 6, 7, 8, 9, 10, 'gap', 16]);
  });

  it('na zadnjoj strani drži kraj i prvu', () => {
    expect(pageList(16, 16)).toEqual([1, 'gap', 11, 12, 13, 14, 15, 16]);
  });

  it('ne izlazi iz granica ni za pogrešan ulaz', () => {
    expect(pageList(0, 1)).toEqual([1]);
    expect(pageList(16, 0)).toEqual([1, 2, 3, 4, 5, 6, 'gap', 16]);
    expect(pageList(16, 99)).toEqual([1, 'gap', 11, 12, 13, 14, 15, 16]);
  });
});

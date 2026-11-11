import { BadRequestException } from '@nestjs/common';
import {
  parsePage,
  setTotalCount,
  slicePage,
  TOTAL_COUNT_HEADER,
} from '../pagination';

/**
 * Straničenje (`33`).
 *
 * Zašto testirati parsiranje: `limit` dolazi kao string iz query-ja, a pogrešno
 * protumačen `limit` je najlakši način da jedan zahtjev povuče cijelu tabelu —
 * ili da vrati nulu redova i time „nema podataka".
 */

describe('parsePage', () => {
  const limits = { defaultLimit: 50, maxLimit: 200 };

  it('bez parametara koristi zadane vrijednosti', () => {
    expect(parsePage({}, limits)).toEqual({ limit: 50, offset: 0 });
  });

  it('prazan string se čita kao „nije poslano"', () => {
    expect(parsePage({ limit: '', offset: '' }, limits)).toEqual({
      limit: 50,
      offset: 0,
    });
  });

  it('prihvata ispravne vrijednosti', () => {
    expect(parsePage({ limit: '10', offset: '20' }, limits)).toEqual({
      limit: 10,
      offset: 20,
    });
  });

  it('dozvoljava offset 0 i najveći dozvoljeni limit', () => {
    expect(parsePage({ limit: '200', offset: '0' }, limits)).toEqual({
      limit: 200,
      offset: 0,
    });
  });

  it.each(['0', '-5', '1.5', 'abc', '201'])('odbija limit %s', (raw) => {
    expect(() => parsePage({ limit: raw }, limits)).toThrow(
      BadRequestException,
    );
  });

  it.each(['-1', '2.5', 'abc'])('odbija offset %s', (raw) => {
    expect(() => parsePage({ offset: raw }, limits)).toThrow(
      BadRequestException,
    );
  });

  it('poruka kaže dozvoljeni raspon, ne samo „neispravno"', () => {
    expect(() => parsePage({ limit: '999' }, limits)).toThrow(/1\.\.200/);
  });
});

describe('setTotalCount', () => {
  it('postavlja zaglavlje kao string', () => {
    const headers: Record<string, string> = {};
    setTotalCount(
      { setHeader: (k: string, v: string) => (headers[k] = v) } as never,
      299,
    );
    expect(headers[TOTAL_COUNT_HEADER]).toBe('299');
  });

  it('ne pada kad odgovor nije dostupan', () => {
    expect(() => setTotalCount(undefined, 5)).not.toThrow();
  });
});

describe('slicePage', () => {
  const rows = Array.from({ length: 5 }, (_, index) => index);

  it('vraća traženu stranu', () => {
    expect(slicePage(rows, { limit: 2, offset: 2 })).toEqual([2, 3]);
  });

  it('posljednja strana može biti kraća', () => {
    expect(slicePage(rows, { limit: 2, offset: 4 })).toEqual([4]);
  });

  it('offset izvan niza daje praznu stranu, ne grešku', () => {
    expect(slicePage(rows, { limit: 2, offset: 10 })).toEqual([]);
  });
});

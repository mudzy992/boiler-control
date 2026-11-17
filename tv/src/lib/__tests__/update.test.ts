import { compareVersions, newVersionAvailable } from '../update';

/**
 * Update provjera na TV-u.
 *
 * Najvažnije: **pogrešno poređenje nudi update koji ne postoji** ili, gore,
 * tvrdi da je TV ažuran kad nije. Oba se vide kao „TV ne radi kako treba", bez
 * ijedne greške u logu.
 */

const response = (version: string) =>
  ({ release: { version, buildNumber: 1, sizeBytes: 1, notes: null, publishedAt: '', downloadUrl: '/x' } }) as never;

describe('poređenje verzija', () => {
  it.each([
    ['2.0.0', '1.9.9', 1],
    ['1.9.9', '2.0.0', -1],
    ['1.0.0', '1.0.0', 0],
    // Brojevi se porede NUMERIČKI, ne leksikografski: "1.10.0" je novija od
    // "1.9.0", iako je kao tekst manja.
    ['1.10.0', '1.9.0', 1],
  ])('%s vs %s → %s', (a, b, expected) => {
    expect(compareVersions(a, b)).toBe(expected);
  });

  it('nepoznat oblik vraća null, ne 0', () => {
    // `0` bi značilo „iste su", a to je tvrdnja koju ne možemo dokazati.
    expect(compareVersions('2.0.0-beta', '2.0.0')).toBeNull();
    expect(compareVersions('', '1.0.0')).toBeNull();
  });
});

describe('ima li nove verzije', () => {
  it('nudi noviju verziju', () => {
    expect(newVersionAvailable('1.0.0', response('1.1.0'))).toMatchObject({
      version: '1.1.0',
    });
  });

  it('istu verziju NE nudi — „već imam" nije update', () => {
    expect(newVersionAvailable('1.0.0', response('1.0.0'))).toBeNull();
  });

  it('stariju verziju NE nudi (objavljena greškom)', () => {
    // Nudenje starije verzije kao „nove" navelo bi korisnika da vrati TV na
    // stariju verziju i izgubi ispravke.
    expect(newVersionAvailable('2.0.0', response('1.9.0'))).toBeNull();
  });

  it('nema objavljenog izdanja → ništa se ne nudi', () => {
    expect(newVersionAvailable('1.0.0', { release: null })).toBeNull();
  });

  it('nepoznata verzija → ništa se ne tvrdi', () => {
    expect(newVersionAvailable('1.0.0', response('neispravno'))).toBeNull();
    expect(newVersionAvailable('neispravno', response('1.0.0'))).toBeNull();
  });
});

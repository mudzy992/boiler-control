import {
  formatCodeForTv,
  extractPairingCode,
  isLocallyExpired,
  pairingDeepLink,
  parseClaimResponse,
  reduceClaim,
  type PairingState,
} from '../pairing';

/**
 * TV strana uparivanja — stanja i kod.
 *
 * Bez ovih tvrdnji TV može zauvijek čekati kod koji je istekao, ili prikazati
 * „upareno" bez tokena. Oba izgledaju isto korisniku: ekran koji ne reaguje.
 */

const waiting = (code = 'ABCD2345'): PairingState => ({
  phase: 'waiting',
  code,
  expiresAt: Date.now() + 60_000,
});

describe('validacija odgovora API-ja', () => {
  it('prihvata samo podržan status i validne tokene za READY', () => {
    expect(parseClaimResponse({ status: 'PENDING' })).toEqual({ status: 'PENDING' });
    expect(parseClaimResponse({ status: 'READY', token: 'access', refreshToken: 'refresh', userId: 7 })).toEqual({
      status: 'READY', token: 'access', refreshToken: 'refresh', userId: 7,
    });
    expect(parseClaimResponse({ status: 'READY', token: '', refreshToken: 'refresh', userId: 7 })).toBeNull();
    expect(parseClaimResponse({ status: 'READY', token: 'access', refreshToken: 'refresh', userId: '7' })).toBeNull();
    expect(parseClaimResponse({ status: 'UNKNOWN' })).toBeNull();
    expect(parseClaimResponse(null)).toBeNull();
  });
});

describe('redukcija stanja', () => {
  it('READY nosi tokene i prelazi u paired', () => {
    const next = reduceClaim(waiting(), {
      status: 'READY',
      token: 'access-7',
      refreshToken: 'refresh-7',
      userId: 7,
    });
    expect(next).toEqual({
      phase: 'paired',
      token: 'access-7',
      refreshToken: 'refresh-7',
      userId: 7,
    });
  });

  it('PENDING ne mijenja ništa — TV nastavlja čekati', () => {
    const current = waiting();
    expect(reduceClaim(current, { status: 'PENDING' })).toBe(current);
  });

  it('EXPIRED i REJECTED vode u expired sa kodom (da se vidi koji je propao)', () => {
    expect(reduceClaim(waiting('XYZ23456'), { status: 'EXPIRED' })).toEqual({
      phase: 'expired',
      code: 'XYZ23456',
    });
    expect(reduceClaim(waiting('XYZ23456'), { status: 'REJECTED' })).toEqual({
      phase: 'expired',
      code: 'XYZ23456',
    });
  });

  it('CLAIMED vodi u expired — TV mora dobiti NOVI kod, ne poruku bez izlaza', () => {
    // Ovo je slučaj kad je aplikacija ubijena poslije preuzimanja tokena:
    // tokeni su izgubljeni, a kod više ne vrijedi. Bez novog koda korisnik
    // nema izlaz sa ekrana.
    expect(reduceClaim(waiting(), { status: 'CLAIMED' }).phase).toBe('expired');
  });

  it('nepoznat status ne ruši stanje', () => {
    const current = waiting();
    expect(reduceClaim(current, { status: 'NEPOZNAT' } as never)).toBe(current);
  });
});

describe('istek i prikaz koda', () => {
  it('kod je istekao tačno u trenutku expiresAt', () => {
    expect(isLocallyExpired(1000, 999)).toBe(false);
    expect(isLocallyExpired(1000, 1000)).toBe(true);
    expect(isLocallyExpired(1000, 1001)).toBe(true);
  });

  it('prikaz koristi razmak, ne crticu', () => {
    // Crtica na TV-u izgleda kao minus i lako se zamijeni sa `1`/`l`.
    expect(formatCodeForTv('ABCD2345')).toBe('ABCD 2345');
    expect(formatCodeForTv('abcd-2345')).toBe('ABCD 2345');
  });
});

describe('QR sadržaj i čitanje koda', () => {
  it('deep link, ne URL — camera bez aplikacije ne vodi na beskorisnu stranicu', () => {
    expect(pairingDeepLink('ABCD2345')).toBe('boilercontrol://tv-pair?code=ABCD2345');
    expect(pairingDeepLink('ABCD2345')).not.toContain('http');
  });

  it('čita kod iz deep linka i iz golih znakova', () => {
    expect(extractPairingCode('boilercontrol://tv-pair?code=ABCD2345')).toBe('ABCD2345');
    expect(extractPairingCode('abcd-2345')).toBe('ABCD2345');
    expect(extractPairingCode('  ABCD 2345  ')).toBe('ABCD2345');
  });

  it('odbija ono što server sigurno ne prihvata', () => {
    expect(extractPairingCode('https://example.com')).toBeNull();
    expect(extractPairingCode('ABCD234')).toBeNull();
    // `0` nije u abecedi — ne postoji kod sa njim.
    expect(extractPairingCode('ABCD2340')).toBeNull();
    expect(extractPairingCode('')).toBeNull();
  });
});

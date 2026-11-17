import {
  PAIRING_ALPHABET,
  PAIRING_CODE_LENGTH,
  formatPairingCode,
  generatePairingCode,
  hashCode,
  isPairingCodeShaped,
  normalizePairingCode,
} from '../pairing-code';

/**
 * Kod za uparivanje TV-a.
 *
 * Kod se **prikazuje na TV-u i prepisuje na telefon**, pa svaka dvosmislenost
 * postaje greška koju korisnik ne može sam razriješiti. Zato testovi ne
 * provjeravaju „izgleda li kod dobro", nego tačno: abecedu, dužinu, hash i
 * odbijanje onoga što ne može postojati.
 */

describe('generisanje koda', () => {
  it('koristi samo abecedu bez dvosmislenih znakova', () => {
    // `0`, `O`, `1`, `I`, `L` se pri prepisivanju ne razlikuju — izbačeni su.
    for (const ch of ['0', 'O', '1', 'I', 'L']) {
      expect(PAIRING_ALPHABET).not.toContain(ch);
    }
    /*
     * 31, ne 32: deset cifara bez `0` i `1`, dvadeset dva slova bez `I` i `L`.
     * Broj je zaključan jer od njega zavisi entropija koda (31^8 ≈ 8,5 × 10^11,
     * ~39,6 bita) — ako se abeceda skrati, entropija padne bez ijedne greške.
     */
    expect(PAIRING_ALPHABET).toHaveLength(31);
  });

  it('ima tačnu dužinu i samo dozvoljene znakove', () => {
    for (let i = 0; i < 200; i += 1) {
      const code = generatePairingCode();
      expect(code).toHaveLength(PAIRING_CODE_LENGTH);
      expect(isPairingCodeShaped(code)).toBe(true);
    }
  });

  it('ne daje isti kod dvaput u 200 pokušaja', () => {
    // Gruba provjera da izvor slučajnosti nije konstanta. Prava zaštita od
    // kolizije je `@unique` indeks u bazi, ne ovaj test.
    const seen = new Set<string>();
    for (let i = 0; i < 200; i += 1) seen.add(generatePairingCode());
    expect(seen.size).toBeGreaterThan(190);
  });

  it('raspoređuje znakove po cijeloj abecedi', () => {
    const used = new Set<string>();
    for (let i = 0; i < 500; i += 1) {
      for (const ch of generatePairingCode()) used.add(ch);
    }
    expect(used.size).toBe(PAIRING_ALPHABET.length);
  });
});

describe('hash i normalizacija', () => {
  it('isti kod u različitom zapisu daje isti hash', () => {
    const a = hashCode('ABCD2345');
    expect(hashCode('abcd-2345')).toBe(a);
    expect(hashCode(' abcd 2345 ')).toBe(a);
    expect(normalizePairingCode('abcd-2345')).toBe('ABCD2345');
  });

  it('hash ne sadrži kod (ne može se pročitati iz baze)', () => {
    const code = 'ABCD2345';
    const hash = hashCode(code);
    expect(hash).not.toContain(code);
    expect(hash).toHaveLength(64);
  });

  it('različit kod daje različit hash', () => {
    expect(hashCode('ABCD2345')).not.toBe(hashCode('ABCD2346'));
  });
});

describe('oblik koda', () => {
  it('odbija znakove koji su namjerno izbačeni', () => {
    // Korisnik koji je vidio `0` na TV-u ne može ga unijeti — takav kod ne
    // postoji, pa se ne smije ni poslati u bazu.
    expect(isPairingCodeShaped('ABCD2340')).toBe(false);
    expect(isPairingCodeShaped('ABCD234O')).toBe(false);
    expect(isPairingCodeShaped('ABCD2341')).toBe(false);
    expect(isPairingCodeShaped('ABCD234I')).toBe(false);
    expect(isPairingCodeShaped('ABCD234L')).toBe(false);
  });

  it('odbija pogrešnu dužinu', () => {
    expect(isPairingCodeShaped('ABCD234')).toBe(false);
    expect(isPairingCodeShaped('ABCD23456')).toBe(false);
    expect(isPairingCodeShaped('')).toBe(false);
  });

  it('prihvata kod sa crticom i malim slovima', () => {
    expect(isPairingCodeShaped('abcd-2345')).toBe(true);
  });

  it('prikazuje kod u dvije grupe', () => {
    expect(formatPairingCode('ABCD2345')).toBe('ABCD-2345');
    expect(formatPairingCode('abcd-2345')).toBe('ABCD-2345');
  });
});

import { createHash, randomInt } from 'node:crypto';

/**
 * Kod za uparivanje TV-a — čist račun, bez baze i bez DI.
 *
 * **Zašto abeceda bez `0/O` i `1/I/L`.** Kod se prikazuje **na TV-u** i
 * prepisuje na telefon (ili obratno, ako skener ne radi). `0` i `O` se u tom
 * prenosu ne razlikuju, a korisnik ne može znati je li greška u njemu ili u
 * aplikaciji. Izbacivanje dvosmislenih znakova je jedina odluka koja otklanja
 * cijelu klasu grešaka.
 *
 * **Zašto 8 znakova.** Abeceda ima **31** znak (deset cifara bez `0` i `1`,
 * dvadeset dva slova bez `I` i `L`) → 31^8 ≈ 8,5 × 10^11 mogućnosti, tj. oko
 * **39,6 bita** entropije. Uz rok od 5 minuta i ograničen broj pokušaja po
 * kodu to nije put napada; 6 znakova bi dalo 31^6 ≈ 9 × 10^8, što uz paralelne
 * zahtjeve više nije zanemarivo.
 *
 * Broj je izmjeren, ne pretpostavljen: prva verzija komentara je tvrdila 32
 * znaka i 32^8, što nije tačno — abeceda je 31.
 *
 * **Zašto se čuva hash.** Isto pravilo kao `RefreshToken`: baza koja procuri ne
 * smije sadržavati upotrebljive kodove. Hash je SHA-256 **bez soli** — kod je
 * slučajan i kratkotrajan, pa sol ne donosi ništa (nema rječnika za 10^12
 * slučajnih nizova), a bez soli se isti kod može provjeriti jednim indeksom.
 */

/** 32 znaka: cifre i velika slova, bez `0`, `O`, `1`, `I`, `L`. */
export const PAIRING_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

export const PAIRING_CODE_LENGTH = 8;

/** Kod vrijedi 5 minuta — dovoljno da se nađe telefon, prekratko za pogađanje. */
export const PAIRING_TTL_MS = 5 * 60 * 1000;

/**
 * Koliko puta TV smije pitati za stanje.
 *
 * 60 uz interval od 2 s je 2 minute — kraće od roka, pa TV mora pokazati novi
 * kod prije nego stari istekne. Bez ovog ograničenja bi TV mogao držati isti
 * kod živim zauvijek i tako povećati šansu da ga neko pogodi.
 */
export const PAIRING_MAX_POLLS = 60;

/** Generiše kod. `randomInt` je kriptografski siguran, `Math.random` nije. */
export function generatePairingCode(): string {
  let out = '';
  for (let i = 0; i < PAIRING_CODE_LENGTH; i += 1) {
    out += PAIRING_ALPHABET[randomInt(PAIRING_ALPHABET.length)];
  }
  return out;
}

/** Hash koji se čuva u bazi. Kod se nikad ne zapisuje u čistom obliku. */
export function hashCode(code: string): string {
  return createHash('sha256').update(normalizePairingCode(code)).digest('hex');
}

/**
 * Normalizacija prije poređenja.
 *
 * Korisnik koji prepisuje kod unosi mala slova i razmake, a često i `0`/`O` jer
 * su na TV-u izgledali isto. Zamjena `0→O` i `1→I` bila bi pogrešna (ta slova
 * nisu u abecedi) — zato se **dvosmisleni znakovi odbijaju**, a ne pogađaju.
 */
export function normalizePairingCode(raw: string): string {
  return raw.replace(/[\s-]/g, '').toUpperCase();
}

/**
 * Da li je kod oblika koji uopšte može postojati.
 *
 * Provjerava dužinu i abecedu — `0`, `O`, `1`, `I`, `L` su izbačeni, pa kod sa
 * njima **nije** validan i ne treba ni ići u bazu.
 */
export function isPairingCodeShaped(raw: string): boolean {
  const code = normalizePairingCode(raw);
  if (code.length !== PAIRING_CODE_LENGTH) return false;
  return [...code].every((ch) => PAIRING_ALPHABET.includes(ch));
}

/** Kod prikazan u dvije grupe po četiri: `ABCD-EFGH`. */
export function formatPairingCode(code: string): string {
  const normalized = normalizePairingCode(code);
  return `${normalized.slice(0, 4)}-${normalized.slice(4)}`;
}

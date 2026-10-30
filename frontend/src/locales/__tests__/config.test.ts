import { describe, expect, it, afterEach } from 'vitest';
import i18n from '../config';

/**
 * FE2-11 — i18n fallback.
 *
 * Izmjereno prije pisanja testa: `en-US` i `bs-BS` imaju **181/181 istih
 * ključeva**, nijedan ne nedostaje. Znači `fallbackLng` se u praksi nikad ne
 * aktivira samo od sebe — da bi test bio išta dokazao, mora ga **izazvati**.
 *
 * Zato test privremeno ukloni ključ iz `bs-BS` resursa i provjeri da se
 * vratí engleski, pa resurs vrati. Bez toga bi test prošao i da `fallbackLng`
 * uopšte nije postavljen.
 */

afterEach(async () => {
  // Vrati jezik na zadano da testovi ne cure jedan u drugi.
  await i18n.changeLanguage('en-US');
});

describe('i18n — inicijalizacija', () => {
  it('fallbackLng je en-US', () => {
    // `options.fallbackLng` je izvor istine; bez ovog bi testovi prolazili
    // i da fallback nije konfigurisan. i18next normalizira string u NIZ, pa
    // se poredi s nizom (izmjereno: `["en-US"]`).
    expect(i18n.options.fallbackLng).toEqual(['en-US']);
  });

  it('oba jezika su registrovana kao resursi', () => {
    expect(i18n.hasResourceBundle('en-US', 'translation')).toBe(true);
    expect(i18n.hasResourceBundle('bs-BS', 'translation')).toBe(true);
  });

  it('paritet ključeva: bs-BS ne zaostaje za en-US', () => {
    const flat = (obj: Record<string, unknown>, prefix = ''): string[] =>
      Object.entries(obj).flatMap(([k, v]) =>
        v !== null && typeof v === 'object'
          ? flat(v as Record<string, unknown>, `${prefix}${k}.`)
          : [`${prefix}${k}`],
      );

    const en = flat(i18n.getResourceBundle('en-US', 'translation'));
    const bs = new Set(flat(i18n.getResourceBundle('bs-BS', 'translation')));

    const missing = en.filter((k) => !bs.has(k));
    expect(missing).toEqual([]);
    // Čuva i broj: 183 je izmjereno rekurzivnim flattenom (uključuje
    // ugnijezdene `gas.units.m3` i `gas.units.m3h`). Pad znači da je neko
    // obrisao ključ ili dodao novi bez prijevoda.
    expect(en.length).toBe(183);
  });
});

describe('i18n — prevodi', () => {
  it('bosanski jezik vraća bosanski tekst', async () => {
    await i18n.changeLanguage('bs-BS');
    expect(i18n.t('gas.addReading')).toBe('Dodaj čitanje');
    expect(i18n.t('common.cancel')).toBe('Otkaži');
  });

  it('engleski jezik vraća engleski tekst', async () => {
    await i18n.changeLanguage('en-US');
    expect(i18n.t('gas.addReading')).toBe('Add Reading');
    expect(i18n.t('common.cancel')).toBe('Cancel');
  });

  it('NEPOSTOJEĆI ključ vraća sam ključ, ne prazan string', async () => {
    await i18n.changeLanguage('en-US');
    // i18next default za nepostojeći ključ; bitno je da UI ne prikaže "".
    expect(i18n.t('gas.thisKeyDoesNotExist')).toBe('gas.thisKeyDoesNotExist');
  });
});

describe('i18n — fallback kada ključ nedostaje u aktivnom jeziku', () => {
  const KEY = 'gas.addReading';
  const EN_VALUE = 'Add Reading';

  it('ključ koji nedostaje u bs-BS pada na en-US', async () => {
    await i18n.changeLanguage('bs-BS');
    // Preduslov: bez ovoga test ne bi dokazivao fallback.
    expect(i18n.t(KEY)).toBe('Dodaj čitanje');

    const bundle = i18n.getResourceBundle('bs-BS', 'translation');
    const original = bundle.gas[KEY.split('.')[1]];
    expect(original).toBe('Dodaj čitanje');

    try {
      delete bundle.gas[KEY.split('.')[1]];

      // Ključ je stvarno uklonjen iz bs-BS...
      expect(i18n.getResourceBundle('bs-BS', 'translation').gas.addReading).toBeUndefined();
      // ...i prevod se vraća na engleski, što dokazuje da fallbackLng radi.
      expect(i18n.t(KEY)).toBe(EN_VALUE);
    } finally {
      bundle.gas[KEY.split('.')[1]] = original;
    }

    // Restauracija potvrđena — test ne smije ostaviti trajnu rupu.
    expect(i18n.t(KEY)).toBe('Dodaj čitanje');
  });
});

describe('i18n — <html lang> (FE2-6)', () => {
  it('document.documentElement.lang prati odabrani jezik', async () => {
    await i18n.changeLanguage('bs-BS');
    expect(document.documentElement.lang).toBe('bs-BS');

    await i18n.changeLanguage('en-US');
    expect(document.documentElement.lang).toBe('en-US');
  });
});

import {
  FALLBACK_TIME_ZONE,
  INTERVAL_KEY_VERSION,
  canonicalIntervalKey,
  dayPart,
  dayType,
  intervalKey,
  intervalKeyCandidates,
  isCanonicalIntervalKey,
  readIntervalKey,
  weekdayInZone,
  weekdayOfLocalDate,
  zoneForDevice,
} from '../interval-key';

/**
 * F5.2 — ključ intervala učenja: jedno mjesto, jedna zona.
 *
 * Prije ove izmjene isti ključ se računao na četiri mjesta i u tri formata, sa
 * **serverskim** satom. Test zato ne provjerava samo „vraća string", nego tri
 * stvari koje su bile stvarno pokvarene:
 *
 *  1. sat i dan dolaze iz **zone kuće**, ne iz zone servera;
 *  2. stariji format (`1_afternoon`) se **čita**, da promjena ne izgubi učenje;
 *  3. nema ključa kad nema podatka — bolje ništa nego ključ iz serverskog sata.
 */
describe('F5.2 — intervalKey', () => {
  describe('podjela dana je nepromijenjena', () => {
    // Granice su preuzete iz tri identične kopije koje su postojale u servisima.
    // Ako se mijenjaju, mijenjaju se namjerno — a ne slučajno pri refaktoru.
    it.each([
      [0, 'night'],
      [5, 'night'],
      [6, 'morning'],
      [8, 'morning'],
      [9, 'late_morning'],
      [11, 'late_morning'],
      [12, 'afternoon'],
      [16, 'afternoon'],
      [17, 'evening'],
      [21, 'evening'],
      [22, 'night'],
      [23, 'night'],
    ])('sat %i → %s', (hour, expected) => {
      expect(dayPart(hour)).toBe(expected);
    });

    it('subota i nedjelja su weekend, ostalo weekday', () => {
      expect(dayType(0)).toBe('weekend');
      expect(dayType(6)).toBe('weekend');
      for (const day of [1, 2, 3, 4, 5]) expect(dayType(day)).toBe('weekday');
    });
  });

  describe('zona, ne serverski sat', () => {
    /*
     * Ovo je suština zadatka. Trenutak je 23:30 UTC: u Sarajevu je to 00:30
     * sljedećeg dana (zimi +1 h), dakle **drugi dan i drugi dio dana**. Stari
     * kod bi uzeo serverski sat (23) i dan po serveru — pa bi ključ bio
     * `weekday_night` umjesto `weekend_night` i učenje bi otišlo u pogrešan
     * interval. Test je zato na granici dana, gdje se greška vidi najjasnije.
     */
    it('isti trenutak daje različit ključ u različitim zonama', () => {
      const at = new Date('2026-11-14T23:30:00Z'); // subota 23:30 UTC
      expect(intervalKey({ at, timeZone: 'UTC' })).toBe('weekend_night');
      // Sarajevo je zimi UTC+1 → nedjelja 00:30.
      expect(intervalKey({ at, timeZone: 'Europe/Sarajevo' })).toBe(
        'weekend_night',
      );
      // New York je UTC−5 → subota 18:30, dakle `evening`.
      expect(intervalKey({ at, timeZone: 'America/New_York' })).toBe(
        'weekend_evening',
      );
    });

    it('dan u sedmici se čita u zadatoj zoni, ne u serverskoj', () => {
      // Petak 23:30 UTC = subota 00:30 u Sarajevu (zimi). U UTC-u je petak (5),
      // u Sarajevu subota (6) — a tip dana se od toga mijenja.
      const at = new Date('2026-11-13T23:30:00Z');
      expect(weekdayInZone(at, 'UTC')).toBe(5);
      expect(weekdayInZone(at, 'Europe/Sarajevo')).toBe(6);
      expect(intervalKey({ at, timeZone: 'Europe/Sarajevo' })).toBe(
        'weekend_night',
      );
    });

    it('neispravna zona ne baca — vraća null', () => {
      expect(
        intervalKey({
          at: new Date('2026-11-13T12:00:00Z'),
          timeZone: 'Nije/Zona',
        }),
      ).toBeNull();
    });
  });

  describe('lokalni dan', () => {
    it('dan u sedmici za YYYY-MM-DD je isti u svakoj zoni', () => {
      // `new Date('2026-11-12')` je ponoć UTC; dan u sedmici se računa u UTC
      // polu, pa ne zavisi od zone servera.
      expect(weekdayOfLocalDate('2026-11-12')).toBe(4); // četvrtak
      expect(weekdayOfLocalDate('2026-11-14')).toBe(6); // subota
      expect(weekdayOfLocalDate('2026-11-15')).toBe(0); // nedjelja
    });

    it('neispravan datum daje null, ne izmišljen dan', () => {
      expect(weekdayOfLocalDate('12.11.2026')).toBeNull();
      expect(weekdayOfLocalDate('2026-13-45')).toBeNull();
    });

    it('dnevni zapis koristi jutro, kao i prije', () => {
      // `intervalKeyForLocalDate` je uvijek vraćao `_morning`; to se ne mijenja,
      // samo se sada računa kroz isti modul.
      expect(
        intervalKey({ localDate: '2026-11-12', timeZone: 'Europe/Sarajevo' }),
      ).toBe('weekday_morning');
      expect(
        intervalKey({ localDate: '2026-11-14', timeZone: 'Europe/Sarajevo' }),
      ).toBe('weekend_morning');
    });
  });

  describe('nema ključa kad nema podatka', () => {
    it('bez trenutka i bez dana vraća null', () => {
      // Namjerno: ključ iz serverskog sata je greška koju ovaj modul uklanja, a
      // prazan string bi se tiho upisao u bazu kao interval.
      expect(intervalKey({ timeZone: 'Europe/Sarajevo' })).toBeNull();
    });
  });

  describe('stariji formati se čitaju', () => {
    it('v1 (dan kao broj) se prevodi u kanonski', () => {
      expect(readIntervalKey('1_afternoon')).toBe('weekday_afternoon');
      expect(readIntervalKey('5_night')).toBe('weekday_night');
      expect(readIntervalKey('0_night')).toBe('weekend_night');
      expect(readIntervalKey('6_evening')).toBe('weekend_evening');
    });

    it('kanonski ključ ostaje nepromijenjen', () => {
      expect(readIntervalKey('weekday_late_morning')).toBe(
        'weekday_late_morning',
      );
    });

    it('nepoznat format se vraća kakav jeste, ali nije kanonski', () => {
      // Ne izmišlja se tumačenje; pozivalac dobija signal da format nije poznat.
      expect(readIntervalKey('synthetic_afternoon')).toBe(
        'synthetic_afternoon',
      );
      expect(isCanonicalIntervalKey('synthetic_afternoon')).toBe(false);
    });

    it('kandidati pokrivaju sve dane koje tip dana obuhvata', () => {
      // Ovo je ono što spašava historiju: jedinstveni indeks
      // (homeProfileId, intervalKey) ne spaja formate, pa čitanje mora probati
      // oba. `weekday` = 1–5, `weekend` = 0 i 6.
      expect(intervalKeyCandidates('weekday_morning')).toEqual([
        'weekday_morning',
        '1_morning',
        '2_morning',
        '3_morning',
        '4_morning',
        '5_morning',
      ]);
      expect(intervalKeyCandidates('weekend_evening')).toEqual([
        'weekend_evening',
        '0_evening',
        '6_evening',
      ]);
    });

    it('kandidati za nekanonski ključ ne izmišljaju alternative', () => {
      expect(intervalKeyCandidates('synthetic_afternoon')).toEqual([
        'synthetic_afternoon',
      ]);
    });
  });

  describe('zona uređaja', () => {
    it('prednost: zona kuće, pa zona korisnika, pa zadana', () => {
      expect(
        zoneForDevice({
          homeProfile: {
            weatherTimezone: 'Europe/Sarajevo',
            user: { timezone: 'UTC' },
          },
        }),
      ).toBe('Europe/Sarajevo');
      expect(
        zoneForDevice({
          homeProfile: {
            weatherTimezone: null,
            user: { timezone: 'Europe/Berlin' },
          },
        }),
      ).toBe('Europe/Berlin');
      expect(zoneForDevice({ homeProfile: null })).toBe(FALLBACK_TIME_ZONE);
    });

    it('neispravna zona kuće se preskače, ne baca', () => {
      // Cron ne smije pasti zbog jednog lošeg reda u bazi.
      expect(
        zoneForDevice({
          homeProfile: {
            weatherTimezone: 'Nije/Zona',
            user: { timezone: 'UTC' },
          },
        }),
      ).toBe('UTC');
    });
  });

  it('verzija formata je zabilježena', () => {
    // Bez ovoga se poslije ne zna u kom je formatu zapis, a formata je već bilo dva.
    expect(INTERVAL_KEY_VERSION).toBe(2);
    expect(canonicalIntervalKey('weekday', 'morning')).toBe('weekday_morning');
  });
});

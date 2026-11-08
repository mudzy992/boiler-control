import {
  DEFAULT_HOME_TIME_ZONE,
  intervalKeyForLocalDate,
  isAutoOutOfSeason,
  isProposalDue,
  isWithinProposalWindow,
  localDateKey,
  localMinuteOfDay,
  resolveHomeTimeZone,
} from '../proposal-schedule';
import { selectDueHomes } from '../daily-record.due';

const SARAJEVO = 'Europe/Sarajevo';

describe('lokalni dan i prag 06:00', () => {
  it('dan se lomi po lokalnom vremenu, ne po UTC', () => {
    // 23:30 UTC je 00:30 sljedećeg dana u Sarajevu (zima, UTC+1).
    expect(localDateKey(new Date('2026-11-08T23:30:00Z'), SARAJEVO)).toBe(
      '2026-11-09',
    );
    expect(localDateKey(new Date('2026-11-08T22:30:00Z'), SARAJEVO)).toBe(
      '2026-11-08',
    );
  });

  it('ljeti je pomak +2, zimi +1 — isti UTC sat daje različit lokalni sat', () => {
    expect(localMinuteOfDay(new Date('2026-07-15T04:00:00Z'), SARAJEVO)).toBe(
      6 * 60,
    );
    expect(localMinuteOfDay(new Date('2026-11-08T05:00:00Z'), SARAJEVO)).toBe(
      6 * 60,
    );
    // Isti "zidni" sat, različit UTC trenutak.
    expect(localMinuteOfDay(new Date('2026-07-15T03:00:00Z'), SARAJEVO)).toBe(
      5 * 60,
    );
  });

  it('predlog nije "dužan" prije 06:00 lokalno', () => {
    expect(isProposalDue(new Date('2026-07-15T03:59:00Z'), SARAJEVO)).toBe(false);
    expect(isProposalDue(new Date('2026-07-15T04:00:00Z'), SARAJEVO)).toBe(true);
  });

  it('prozor pisanja je [06:00, 12:00) lokalno', () => {
    expect(
      isWithinProposalWindow(new Date('2026-07-15T03:59:00Z'), SARAJEVO),
    ).toBe(false);
    expect(
      isWithinProposalWindow(new Date('2026-07-15T04:00:00Z'), SARAJEVO),
    ).toBe(true);
    expect(
      isWithinProposalWindow(new Date('2026-07-15T09:59:00Z'), SARAJEVO),
    ).toBe(true);
    expect(
      isWithinProposalWindow(new Date('2026-07-15T10:00:00Z'), SARAJEVO),
    ).toBe(false);
  });

  it('DST: proljetni skok i jesenji povratak ne pomjeraju dan ni prag', () => {
    // 29.03.2026: u 02:00 lokalno sat skače na 03:00.
    expect(localDateKey(new Date('2026-03-29T01:00:00Z'), SARAJEVO)).toBe(
      '2026-03-29',
    );
    // 25.10.2026: 02:30 postoji dvaput (CEST i CET).
    const first = new Date('2026-10-25T00:30:00Z');
    const second = new Date('2026-10-25T01:30:00Z');
    expect(localDateKey(first, SARAJEVO)).toBe('2026-10-25');
    expect(localDateKey(second, SARAJEVO)).toBe('2026-10-25');
    // Prag 06:00 pada poslije prelaza (CET), dakle u 05:00Z, ne 04:00Z.
    expect(isProposalDue(new Date('2026-10-25T04:59:00Z'), SARAJEVO)).toBe(false);
    expect(isProposalDue(new Date('2026-10-25T05:00:00Z'), SARAJEVO)).toBe(true);
  });
});

describe('vremenska zona kuće', () => {
  it('prednost ima zona kuće, pa korisnika, pa fallback', () => {
    expect(
      resolveHomeTimeZone({
        homeTimeZone: 'Europe/Vienna',
        userTimeZone: 'Europe/Sarajevo',
      }),
    ).toEqual({ zone: 'Europe/Vienna', source: 'HOME' });

    expect(
      resolveHomeTimeZone({
        homeTimeZone: null,
        userTimeZone: 'America/New_York',
      }),
    ).toEqual({ zone: 'America/New_York', source: 'USER' });

    expect(resolveHomeTimeZone({})).toEqual({
      zone: DEFAULT_HOME_TIME_ZONE,
      source: 'DEFAULT',
    });
  });

  it('neispravno ime zone se preskače, ne baca izuzetak', () => {
    // Numerički offset nije IANA zona; cron ne smije pasti zbog lošeg reda.
    expect(
      resolveHomeTimeZone({ homeTimeZone: '+02:00', userTimeZone: null }),
    ).toEqual({ zone: DEFAULT_HOME_TIME_ZONE, source: 'DEFAULT' });

    expect(
      resolveHomeTimeZone({
        homeTimeZone: 'Nepostoji/Grad',
        userTimeZone: 'Europe/Sarajevo',
      }),
    ).toEqual({ zone: 'Europe/Sarajevo', source: 'USER' });
  });

  it('zona koja nije puni sat radi (Asia/Kathmandu +05:45)', () => {
    expect(
      localMinuteOfDay(new Date('2026-07-15T00:15:00Z'), 'Asia/Kathmandu'),
    ).toBe(6 * 60);
  });
});

describe('interval ključ', () => {
  it('računa se iz lokalnog datuma, ne iz dana servera', () => {
    // 09.11.2026 je ponedjeljak.
    expect(intervalKeyForLocalDate('2026-11-09')).toBe('weekday_morning');
    expect(intervalKeyForLocalDate('2026-11-07')).toBe('weekend_morning');
    expect(intervalKeyForLocalDate('2026-11-08')).toBe('weekend_morning');
  });
});

describe('grijna granica za AUTO', () => {
  it('prosjek ispod 15 °C grije, 15 i više ne', () => {
    expect(isAutoOutOfSeason({ tempMin: 5, tempMax: 14 })).toBe(false);
    expect(isAutoOutOfSeason({ tempMin: 10, tempMax: 20 })).toBe(true);
    // Granica je uključena u "ne grije".
    expect(isAutoOutOfSeason({ tempMin: 15, tempMax: 15 })).toBe(true);
    expect(isAutoOutOfSeason({ tempMin: 14.9, tempMax: 15 })).toBe(false);
  });
});

describe('koja kuća je "dužna" u ovom trenutku', () => {
  const home = (
    id: number,
    userId: number,
    activeHomeProfileId: number | null,
    extra: { weatherTimezone?: string | null; timezone?: string | null } = {},
  ) => ({
    id,
    weatherTimezone:
      extra.weatherTimezone === undefined ? SARAJEVO : extra.weatherTimezone,
    user: {
      id: userId,
      timezone: extra.timezone ?? null,
      activeHomeProfileId,
    },
  });

  it('koristi aktivnu kuću, a ne prvu u nizu', () => {
    const homes = [home(10, 1, 20), home(20, 1, 20)];
    const due = selectDueHomes(homes, new Date('2026-11-08T05:30:00Z'));
    expect(due).toEqual([
      {
        homeProfileId: 20,
        userId: 1,
        localDate: '2026-11-08',
        timeZone: SARAJEVO,
      },
    ]);
  });

  it('bez aktivne kuće uzima najstariju — isto kao stari kod', () => {
    const homes = [home(30, 2, null), home(10, 2, null)];
    const due = selectDueHomes(homes, new Date('2026-11-08T05:30:00Z'));
    expect(due.map((d) => d.homeProfileId)).toEqual([10]);
  });

  it('ako aktivna kuća ne postoji u nizu, korisnik se preskače', () => {
    const homes = [home(10, 3, 99)];
    expect(selectDueHomes(homes, new Date('2026-11-08T05:30:00Z'))).toEqual([]);
  });

  it('prije 06:00 lokalno nema koga zvati', () => {
    const homes = [home(10, 1, null)];
    expect(selectDueHomes(homes, new Date('2026-11-08T04:00:00Z'))).toEqual([]);
  });

  it('dvije zone u istom trenutku daju različit "danas"', () => {
    const homes = [
      home(10, 1, null, { weatherTimezone: SARAJEVO }),
      home(20, 2, null, { weatherTimezone: 'America/New_York' }),
    ];
    // 05:30Z = 06:30 Sarajevo (dužan), 00:30 New York (nije dužan).
    const due = selectDueHomes(homes, new Date('2026-11-08T05:30:00Z'));
    expect(due).toHaveLength(1);
    expect(due[0]).toMatchObject({
      homeProfileId: 10,
      localDate: '2026-11-08',
    });
  });
});

import {
  DEGREE_DAY_BASE_C,
  NIGHT_HOURS,
  daySummaryFrom,
  isNightHourOf,
  nightMinimumFrom,
  previousLocalDate,
  type NightHourSample,
} from '../night-forecast';

/**
 * Noć je 22:00 → 06:00 **lokalno** i prelazi ponoć. Testovi zato ne koriste
 * jednu zonu: `Europe/Sarajevo` (CET/CEST, ljetno vrijeme) i `America/New_York`
 * (prelaz DST-a u novembru) — da se ne bi desilo da rješenje radi samo zato
 * što je offset cijeli sat.
 */

const SARAJEVO = 'Europe/Sarajevo';
const NEW_YORK = 'America/New_York';

/** Sat u UTC koji odgovara lokalnom satu `hour` dana `date` u zoni. */
function localHour(date: string, hour: number, zone: string): Date {
  // Traži UTC trenutak u kojem je u zoni tačno `date` `hour`:00.
  for (let offset = -14; offset <= 14; offset += 0.25) {
    const candidate = new Date(
      Date.parse(`${date}T00:00:00Z`) + hour * 3600_000 + offset * 3600_000,
    );
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(candidate);
    const got = Object.fromEntries(parts.map((p) => [p.type, p.value]));
    if (
      `${got.year}-${got.month}-${got.day}` === date &&
      Number(got.hour) === hour
    ) {
      return candidate;
    }
  }
  throw new Error(`nema UTC sata za ${date} ${hour}h u ${zone}`);
}

function night(
  day: string,
  tempByHour: Record<number, number | null>,
  zone = SARAJEVO,
): NightHourSample[] {
  const samples: NightHourSample[] = [];
  for (const [hour, temperatureC] of Object.entries(tempByHour)) {
    samples.push({
      at: localHour(day, Number(hour), zone),
      temperatureC,
    });
  }
  return samples;
}

describe('previousLocalDate', () => {
  it('prelazi mjesec i godinu bez Date/zone', () => {
    expect(previousLocalDate('2026-03-01')).toBe('2026-02-28');
    expect(previousLocalDate('2026-01-01')).toBe('2025-12-31');
    expect(previousLocalDate('2026-11-08')).toBe('2026-11-07');
  });
});

describe('isNightHourOf — granice prozora', () => {
  const DAY = '2026-11-08';

  it('22:00 prethodnog dana je noć, 21:00 nije', () => {
    expect(
      isNightHourOf(localHour('2026-11-07', 22, SARAJEVO), DAY, SARAJEVO),
    ).toBe(true);
    expect(
      isNightHourOf(localHour('2026-11-07', 21, SARAJEVO), DAY, SARAJEVO),
    ).toBe(false);
  });

  it('05:00 je noć, 06:00 nije — kraj prozora je isključen', () => {
    expect(
      isNightHourOf(localHour('2026-11-08', 5, SARAJEVO), DAY, SARAJEVO),
    ).toBe(true);
    expect(
      isNightHourOf(localHour('2026-11-08', 6, SARAJEVO), DAY, SARAJEVO),
    ).toBe(false);
  });

  it('sat iz trećeg dana ne pripada noći, ni u jednoj zoni', () => {
    expect(
      isNightHourOf(localHour('2026-11-06', 23, SARAJEVO), DAY, SARAJEVO),
    ).toBe(false);
    expect(
      isNightHourOf(localHour('2026-11-06', 23, NEW_YORK), DAY, NEW_YORK),
    ).toBe(false);
  });
});

describe('nightMinimumFrom', () => {
  const DAY = '2026-11-08';

  it('uzima najhladniji sat u prozoru 22:00 → 06:00', () => {
    const result = nightMinimumFrom(
      [
        ...night('2026-11-07', { 22: -2, 23: -5 }),
        ...night(DAY, {
          2: -7,
          5: -6,
          6: -9, // 06:00 nije noć — mora biti ignorisano
          12: -10, // dan — ignorisano
        }),
      ],
      DAY,
      SARAJEVO,
    );

    expect(result?.nightMinC).toBe(-7);
    expect(result?.hoursUsed).toBe(4); // 22, 23, 2, 5
    expect(NIGHT_HOURS).toBe(8);
  });

  it('noć koja prelazi ponoć se ne cijepa na dva minimuma', () => {
    // Dan ima samo -1 °C (u 00:00–06:00), a prethodna večer -8 °C.
    const result = nightMinimumFrom(
      [...night('2026-11-07', { 22: -8 }), ...night(DAY, { 0: -1, 3: -2 })],
      DAY,
      SARAJEVO,
    );
    expect(result?.nightMinC).toBe(-8);
    expect(result?.hoursUsed).toBe(3);
  });

  it('radi u zoni koja nije puni sat i nije Sarajevo', () => {
    const result = nightMinimumFrom(
      [
        ...night('2026-11-07', { 23: 4 }, NEW_YORK),
        ...night(DAY, { 5: 1 }, NEW_YORK),
        ...night(DAY, { 7: -20 }, NEW_YORK), // dan — ne ulazi
      ],
      DAY,
      NEW_YORK,
    );
    expect(result?.nightMinC).toBe(1);
    expect(result?.hoursUsed).toBe(2);
  });

  it('bez ijednog sata vraća null, nikad nulu', () => {
    expect(nightMinimumFrom([], DAY, SARAJEVO)).toBeNull();
    expect(
      nightMinimumFrom(night(DAY, { 3: null, 4: null }), DAY, SARAJEVO),
    ).toBeNull();
  });

  it('null temperatura se ne pretvara u 0 i ne ruši minimum', () => {
    const result = nightMinimumFrom(
      [...night('2026-11-07', { 23: -6 }), ...night(DAY, { 1: null, 2: -4 })],
      DAY,
      SARAJEVO,
    );
    expect(result?.nightMinC).toBe(-6);
    expect(result?.hoursUsed).toBe(2);
  });

  it('zapisuje stvarni prozor koji je ušao u proračun', () => {
    const result = nightMinimumFrom(
      [...night('2026-11-07', { 22: 2 }), ...night(DAY, { 5: -3 })],
      DAY,
      SARAJEVO,
    );
    expect(result?.firstHourAt).toEqual(localHour('2026-11-07', 22, SARAJEVO));
    expect(result?.lastHourAt).toEqual(localHour(DAY, 5, SARAJEVO));
  });
});

describe('daySummaryFrom', () => {
  const DAY = '2026-11-08';

  it('prosjek, maksimum i stepen-sati samo za taj lokalni dan', () => {
    const result = daySummaryFrom(
      [
        ...night('2026-11-07', { 23: 20 }), // prethodni dan — ne ulazi
        ...night(DAY, { 0: 10, 12: 20 }),
      ],
      DAY,
      SARAJEVO,
    );

    expect(result).not.toBeNull();
    expect(result!.hoursUsed).toBe(2);
    expect(result!.dayMeanC).toBe(15);
    expect(result!.dayMaxC).toBe(20);
    // 10 °C: 15 − 10 = 5; 20 °C: 0 (iznad osnove se ne broji negativno).
    expect(result!.degreeHours).toBe(5);
    expect(DEGREE_DAY_BASE_C).toBe(15);
  });

  it('stepen-sati nikad nisu negativni', () => {
    const result = daySummaryFrom(
      night(DAY, { 12: 30, 13: 31 }),
      DAY,
      SARAJEVO,
    );
    expect(result!.degreeHours).toBe(0);
  });

  it('bez sata dana vraća null', () => {
    expect(
      daySummaryFrom(night('2026-11-07', { 23: 5 }), DAY, SARAJEVO),
    ).toBeNull();
  });
});

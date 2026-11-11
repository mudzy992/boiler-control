import { dailyWeatherInputFromV2 } from '../daily-weather-input';

/**
 * Prognoza → `DailyWeatherInput`. Testovi čuvaju tri stvari koje su ranije
 * bile tihe greške:
 *
 * 1. noćni minimum se čita iz **satne** prognoze, a ne iz dnevnog min/max;
 * 2. kad satne nema, pada na dnevni minimum — ali se to **vidi** u
 *    `nightMinSource`;
 * 3. nedostatak se nikad ne pretvara u `0 °C`.
 */

const ZONE = 'Europe/Sarajevo';
const NOW = new Date('2026-11-08T05:30:00Z'); // 06:30 Sarajevo

/** Jednostavan satni niz: `hooks` ključ je `YYYY-MM-DDTHH` u UTC-u. */
function hourly(hours: Array<{ at: string; temperatureC: number | null }>) {
  return hours.map((hour) => ({
    at: hour.at,
    temperatureC: hour.temperatureC,
    apparentTemperatureC: null,
    humidityPercent: null,
    precipitationProbabilityPercent: null,
    precipitationMm: null,
    windKph: null,
    gustKph: null,
    windDirectionDegrees: null,
    conditionCode: null,
    conditionKey: 'clear',
    conditionI18nKey: 'weather.clear',
    isDay: null,
  }));
}

function response(options: {
  daily?: unknown[];
  hourly?: unknown[];
  date?: string;
}) {
  return {
    version: 2,
    status: 'ok',
    location: { timezone: ZONE },
    daily: options.daily ?? [
      {
        date: options.date ?? '2026-11-08',
        temperatureMinC: -9,
        temperatureMaxC: -1,
        precipitationMm: null,
        precipitationProbabilityPercent: null,
        uvIndex: null,
        sunrise: null,
        sunset: null,
        conditionCode: null,
        conditionKey: 'clear',
        conditionI18nKey: 'weather.clear',
      },
    ],
    hourly: options.hourly ?? [],
  } as any;
}

describe('dailyWeatherInputFromV2 — noćni minimum', () => {
  it('uzima najhladniji sat noći, ne dnevni minimum', () => {
    // Noć 07.11 22:00 → 08.11 06:00 lokalno (CET = UTC+1).
    const input = dailyWeatherInputFromV2(
      response({
        hourly: hourly([
          { at: '2026-11-07T21:00:00Z', temperatureC: 2 }, // 22:00 — noć
          { at: '2026-11-08T01:00:00Z', temperatureC: -4 }, // 02:00 — noć, najhladnije
          { at: '2026-11-08T02:00:00Z', temperatureC: -3 }, // 03:00
          { at: '2026-11-08T05:00:00Z', temperatureC: 0 }, // 06:00 — NIJE noć
          { at: '2026-11-08T12:00:00Z', temperatureC: 8 }, // 13:00 — dan
        ]),
      }),
      NOW,
    );

    expect(input).not.toBeNull();
    expect(input!.tempMin).toBe(-9); // dnevni min ostaje iz `daily` bloka
    expect(input!.tempMax).toBe(-1);
    expect(input!.nightMinC).toBe(-4); // sat, ne -9
    expect(input!.nightMinSource).toBe('HOURLY');
    expect(input!.nightHoursUsed).toBe(3);
  });

  it('dnevni prosjek i stepen-sati pokrivaju cijeli lokalni dan', () => {
    const input = dailyWeatherInputFromV2(
      response({
        hourly: hourly([
          { at: '2026-11-07T22:00:00Z', temperatureC: 99 }, // 23:00 prethodnog dana
          { at: '2026-11-08T00:00:00Z', temperatureC: 0 }, // 01:00
          { at: '2026-11-08T11:00:00Z', temperatureC: 10 }, // 12:00
          { at: '2026-11-08T21:00:00Z', temperatureC: 20 }, // 22:00
        ]),
      }),
      NOW,
    );

    // 99 ne ulazi: to je prethodni lokalni dan.
    expect(input!.dayMeanC).toBe(10); // (0 + 10 + 20) / 3
    expect(input!.dayMaxC).toBe(20);
    // 15−0 = 15, 15−10 = 5, 15−20 = 0 (ne negativno)
    expect(input!.degreeHours).toBe(20);
  });

  it('bez satne prognoze noćni minimum je dnevni — i to je označeno', () => {
    const input = dailyWeatherInputFromV2(response({ hourly: [] }), NOW);

    expect(input!.nightMinC).toBe(-9);
    expect(input!.nightMinSource).toBe('DAILY_MIN');
    expect(input!.nightHoursUsed).toBe(0);
    // Ono što se iz dnevnog min/max ne može izvesti ostaje null, a ne nula.
    expect(input!.dayMeanC).toBeNull();
    expect(input!.dayMaxC).toBeNull();
    expect(input!.degreeHours).toBeNull();
  });

  it('nula iz prognoze ostaje nula, a ne „nema podatka"', () => {
    const input = dailyWeatherInputFromV2(
      response({
        daily: [
          {
            date: '2026-11-08',
            temperatureMinC: 0,
            temperatureMaxC: 0,
            precipitationMm: null,
            precipitationProbabilityPercent: null,
            uvIndex: null,
            sunrise: null,
            sunset: null,
            conditionCode: null,
            conditionKey: 'clear',
            conditionI18nKey: 'weather.clear',
          },
        ],
        hourly: hourly([{ at: '2026-11-08T01:00:00Z', temperatureC: 0 }]),
      }),
      NOW,
    );

    expect(input!.nightMinC).toBe(0);
    expect(input!.nightMinSource).toBe('HOURLY');
  });

  it('svi sati bez temperature ne prave 0 °C nego padaju na dnevni minimum', () => {
    const input = dailyWeatherInputFromV2(
      response({
        hourly: hourly([
          { at: '2026-11-08T01:00:00Z', temperatureC: null },
          { at: '2026-11-08T02:00:00Z', temperatureC: null },
        ]),
      }),
      NOW,
    );

    expect(input!.nightMinC).toBe(-9);
    expect(input!.nightMinSource).toBe('DAILY_MIN');
  });

  it('nedostatak dnevnih temperatura i dalje vraća null za cijeli dan', () => {
    const response0 = response({
      daily: [
        {
          date: '2026-11-08',
          temperatureMinC: null,
          temperatureMaxC: 5,
          precipitationMm: null,
          precipitationProbabilityPercent: null,
          uvIndex: null,
          sunrise: null,
          sunset: null,
          conditionCode: null,
          conditionKey: 'clear',
          conditionI18nKey: 'weather.clear',
        },
      ],
    });

    expect(dailyWeatherInputFromV2(response0, NOW)).toBeNull();
  });

  it('nema prognoze za taj dan — nema ni noći', () => {
    const input = dailyWeatherInputFromV2(
      response({ date: '2026-11-01' }),
      NOW,
    );
    expect(input).toBeNull();
  });
});

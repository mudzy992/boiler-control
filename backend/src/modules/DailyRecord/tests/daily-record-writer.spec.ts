jest.mock('../../../prisma/prisma.service', () => ({
  PrismaService: class {},
}));
jest.mock('../../Weather/recommendation-weather.service', () => ({
  RecommendationWeatherService: class {},
}));
jest.mock('../../Heating/engine/flow-temperature.engine', () => ({
  FlowTemperatureEngine: { calculate: jest.fn() },
}));

import { FlowTemperatureEngine } from '../../Heating/engine/flow-temperature.engine';
import type { FlowTempResult } from '../../Heating/engine/types';
import {
  DAILY_RECORD_MODEL_VERSION,
  DailyRecordWriter,
  clampFlowTemp,
  flowSetSnapshot,
} from '../daily-record.writer';

const engineResult: FlowTempResult = {
  baseCurveTemp: 50,
  weightedExternalTemp: -5,
  appliedOffsets: { home: 0, interval: 0, events: 0 },
  finalTemp: 45,
  confidence: 0.5,
};
const engineCalculate = Reflect.get(
  FlowTemperatureEngine,
  'calculate',
) as jest.Mock;

const NOW_IN_WINDOW = new Date('2026-11-08T05:30:00Z'); // 06:30 Sarajevo (CET)
const NOW_AFTER_WINDOW = new Date('2026-11-08T12:30:00Z'); // 13:30 Sarajevo
const NOW_BEFORE_DAWN = new Date('2026-11-08T04:00:00Z'); // 05:00 Sarajevo

const baseHome = () => ({
  id: 10,
  floorArea: 150,
  learningOffset: 0,
  learningConfidence: 0.5,
  seasonMode: 'WINTER',
  weatherTimezone: 'Europe/Sarajevo',
  user: {
    id: 1,
    timezone: null,
    homeLocation: 'Visoko',
    activeHomeProfileId: 10,
    currentBoilerFlowTemp: 50,
    currentBoilerFlowTempSetAt: new Date('2026-11-01T08:00:00Z'),
  },
});

function setup(options: {
  home?: Record<string, unknown> | null;
  v2Weather?: unknown;
  cachedWeather?: unknown;
  uniqueViolation?: boolean;
}) {
  const dailyRecords: any[] = [];
  const recommendations: any[] = [];
  const tx = {
    dailyRecord: {
      create: jest.fn(async ({ data }: any) => {
        if (options.uniqueViolation) {
          const error = new Error('Unique constraint failed') as Error & {
            code: string;
          };
          error.code = 'P2002';
          throw error;
        }
        dailyRecords.push(data);
        return data;
      }),
    },
    recommendation: {
      create: jest.fn(async ({ data }: any) => {
        recommendations.push(data);
        return data;
      }),
    },
  };

  const prisma = {
    homeProfile: {
      findUnique: jest
        .fn()
        .mockResolvedValue(
          options.home === undefined ? baseHome() : options.home,
        ),
    },
    weatherCache: {
      findFirst: jest
        .fn()
        .mockResolvedValue(
          options.cachedWeather === undefined
            ? { temp_min: 8, temp_max: 12 }
            : options.cachedWeather,
        ),
    },
    heatingIntervalLearning: { findUnique: jest.fn().mockResolvedValue(null) },
    $transaction: jest.fn(async (callback: any) => callback(tx)),
  };

  const weather = {
    getV2WeatherInput: jest
      .fn()
      .mockResolvedValue(
        options.v2Weather === undefined
          ? { tempMin: -9, tempMax: -1 }
          : options.v2Weather,
      ),
  };

  const writer = new DailyRecordWriter(prisma as any, weather as any);
  return { writer, prisma, weather, tx, dailyRecords, recommendations };
}

beforeEach(() => {
  engineCalculate.mockReset();
  engineCalculate.mockReturnValue(engineResult);
});

describe('pisanje dnevnog zapisa', () => {
  it('predlog i red za klijente nastaju u istoj transakciji', async () => {
    const { writer, dailyRecords, recommendations, prisma } = setup({});

    const result = await writer.writeForHome(10, NOW_IN_WINDOW);

    expect(result.status).toBe('created');
    expect(result.proposedFlowTemp).toBe(45);
    expect(result.localDate).toBe('2026-11-08');
    expect(result.timeZone).toBe('Europe/Sarajevo');

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(dailyRecords).toHaveLength(1);
    expect(recommendations).toHaveLength(1);
    expect(recommendations[0].recommendedFlowTemp).toBe(45);
    expect(dailyRecords[0].proposedFlowTemp).toBe(45);
    expect(recommendations[0].recommendedFlowTemp).toBe(
      dailyRecords[0].proposedFlowTemp,
    );
  });

  it('zapis nosi polaznu na snazi i verziju modela', async () => {
    const { writer, dailyRecords } = setup({});
    await writer.writeForHome(10, NOW_IN_WINDOW);

    expect(dailyRecords[0].flowSetC).toBe(50);
    expect(dailyRecords[0].flowSetSource).toBe('USER');
    expect(dailyRecords[0].flowSetSince).toEqual(
      new Date('2026-11-01T08:00:00Z'),
    );
    expect(dailyRecords[0].modelVersion).toBe(DAILY_RECORD_MODEL_VERSION);
    expect(dailyRecords[0].skipReason).toBeNull();
  });

  it('params čuvaju ulaz i izlaz motora — zapis je preračunljiv', async () => {
    const { writer, dailyRecords } = setup({});
    await writer.writeForHome(10, NOW_IN_WINDOW);

    const params = dailyRecords[0].params;
    expect(params.version).toBe(1);
    expect(params.timeZone).toBe('Europe/Sarajevo');
    expect(params.input.weather).toEqual({ tempMin: -9, tempMax: -1 });
    expect(params.input.mode).toBe('PROFILE_ONLY');
    expect(params.input.intervalKey).toBe('weekend_morning');
    expect(params.result.finalTemp).toBe(45);
    expect(params.clamp.applied).toBe(false);
  });

  it('drugi pokušaj istog dana vraća "exists" i ne piše ništa novo', async () => {
    const { writer, dailyRecords, recommendations } = setup({
      uniqueViolation: true,
    });

    const result = await writer.writeForHome(10, NOW_IN_WINDOW);

    expect(result.status).toBe('exists');
    expect(result.proposedFlowTemp).toBeNull();
    expect(dailyRecords).toHaveLength(0);
    expect(recommendations).toHaveLength(0);
  });

  it('prije 06:00 lokalno ne nastaje ni red', async () => {
    const { writer, dailyRecords, prisma } = setup({});

    const result = await writer.writeForHome(10, NOW_BEFORE_DAWN);

    expect(result.status).toBe('not-due');
    expect(result.localDate).toBe('2026-11-08');
    expect(dailyRecords).toHaveLength(0);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('zapis koji nije nastao ne baca izuzetak, ali ni ne laže', async () => {
    const { writer, dailyRecords, recommendations } = setup({});
    const result = await writer.writeForHome(10, NOW_IN_WINDOW);
    expect(result.status).toBe('created');
    // Zapis postoji: proposedAt je trenutak pisanja, ne "zadnje viđeno".
    expect(dailyRecords[0].proposedAt).toEqual(NOW_IN_WINDOW);
    expect(recommendations[0].date).toEqual(NOW_IN_WINDOW);
  });
});

describe('kada predloga nema', () => {
  it('SUMMER: red nastaje sa razlogom, motor se ne poziva', async () => {
    const home = baseHome();
    home.seasonMode = 'SUMMER';
    const { writer, dailyRecords, recommendations } = setup({ home });

    const result = await writer.writeForHome(10, NOW_IN_WINDOW);

    expect(result.status).toBe('skipped');
    expect(result.skipReason).toBe('OUT_OF_SEASON');
    expect(engineCalculate).not.toHaveBeenCalled();
    expect(recommendations).toHaveLength(0);
    expect(dailyRecords[0].proposedFlowTemp).toBeNull();
    expect(dailyRecords[0].skipReason).toBe('OUT_OF_SEASON');
  });

  it('AUTO odlučuje po prosjeku, a granica je 15 °C', async () => {
    const warm = baseHome();
    warm.seasonMode = 'AUTO';
    const warmSetup = setup({
      home: warm,
      v2Weather: { tempMin: 15, tempMax: 25 },
    });
    const warmResult = await warmSetup.writer.writeForHome(10, NOW_IN_WINDOW);
    expect(warmResult.skipReason).toBe('OUT_OF_SEASON');
    expect(engineCalculate).not.toHaveBeenCalled();

    engineCalculate.mockReturnValue(engineResult);
    const cold = baseHome();
    cold.seasonMode = 'AUTO';
    const coldSetup = setup({
      home: cold,
      v2Weather: { tempMin: 1, tempMax: 6 },
    });
    const coldResult = await coldSetup.writer.writeForHome(10, NOW_IN_WINDOW);
    expect(coldResult.status).toBe('created');
  });

  it('nema prognoze: NO_WEATHER, a ne predlog izmišljen iz 0 °C', async () => {
    const home = baseHome();
    home.user.homeLocation = null;
    const { writer, dailyRecords, recommendations } = setup({
      home,
      v2Weather: null,
      cachedWeather: null,
    });

    const result = await writer.writeForHome(10, NOW_IN_WINDOW);

    expect(result.skipReason).toBe('NO_WEATHER');
    expect(engineCalculate).not.toHaveBeenCalled();
    expect(dailyRecords[0].skipReason).toBe('NO_WEATHER');
    expect(recommendations).toHaveLength(0);
  });

  it('poslije 12:00 lokalno: MISSED_WINDOW', async () => {
    const { writer, dailyRecords } = setup({});
    const result = await writer.writeForHome(10, NOW_AFTER_WINDOW);

    expect(result.skipReason).toBe('MISSED_WINDOW');
    expect(dailyRecords).toHaveLength(1);
    expect(dailyRecords[0].proposedFlowTemp).toBeNull();
  });

  it('noć se upisuje i kad je prozor promašen', async () => {
    // F1: red bez predloga i dalje nosi ono što je predlog trebao pokriti.
    const { writer, dailyRecords } = setup({
      v2Weather: {
        tempMin: -9,
        tempMax: -1,
        nightMinC: -7,
        nightMinSource: 'HOURLY',
        nightHoursUsed: 8,
        dayMeanC: -5,
        dayMaxC: -1,
        degreeHours: 160,
      },
    });
    await writer.writeForHome(10, NOW_AFTER_WINDOW);

    expect(dailyRecords[0].proposedFlowTemp).toBeNull();
    expect(dailyRecords[0].nightMinC).toBe(-7);
    expect(dailyRecords[0].dayMeanC).toBe(-5);
    expect(dailyRecords[0].dayMaxC).toBe(-1);
    expect(dailyRecords[0].degreeHours).toBe(160);
    expect(dailyRecords[0].params.forecast.nightMinSource).toBe('HOURLY');
  });

  it('bez prognoze preskočen red ima null noć, a ne nulu', async () => {
    const home = baseHome();
    home.user.homeLocation = null;
    const { writer, dailyRecords } = setup({
      home,
      v2Weather: null,
      cachedWeather: null,
    });

    await writer.writeForHome(10, NOW_IN_WINDOW);

    expect(dailyRecords[0].skipReason).toBe('NO_WEATHER');
    expect(dailyRecords[0].nightMinC).toBeNull();
    expect(dailyRecords[0].dayMeanC).toBeNull();
    expect(dailyRecords[0].params.forecast).toBeNull();
  });

  it('neaktivna kuća: ne piše se ništa', async () => {
    const home = baseHome();
    home.user.activeHomeProfileId = 99;
    const { writer, dailyRecords, prisma } = setup({ home });

    const result = await writer.writeForHome(10, NOW_IN_WINDOW);

    expect(result.status).toBe('not-active');
    expect(dailyRecords).toHaveLength(0);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('kuća koja ne postoji je greška, ne tihi preskok', async () => {
    const { writer } = setup({ home: null });
    await expect(writer.writeForHome(999, NOW_IN_WINDOW)).rejects.toThrow(
      'HomeProfile 999 ne postoji',
    );
  });
});

describe('vremenska zona u zapisu', () => {
  it('lokalni dan se računa u zoni kuće, ne u UTC-u', async () => {
    // 23:30 UTC 08.11. je 00:30 09.11. u Sarajevu.
    const { writer, dailyRecords } = setup({});
    const result = await writer.writeForHome(
      10,
      new Date('2026-11-08T23:30:00Z'),
    );

    expect(result.status).toBe('not-due');
    expect(result.localDate).toBe('2026-11-09');
    expect(dailyRecords).toHaveLength(0);
  });

  it('bez ijedne zone koristi se dokumentovani fallback', async () => {
    const home = baseHome();
    home.weatherTimezone = null;
    const { writer } = setup({ home });

    const result = await writer.writeForHome(10, NOW_IN_WINDOW);

    expect(result.timeZone).toBe('Europe/Sarajevo');
    expect(result.timeZoneSource).toBe('DEFAULT');
  });
});

describe('prognoza: v2 prvo, pa gradski keš', () => {
  it('v2 ulaz ima prednost i keš se ne čita', async () => {
    const { writer, prisma } = setup({
      v2Weather: { tempMin: -9, tempMax: -1 },
    });
    await writer.writeForHome(10, NOW_IN_WINDOW);

    expect(engineCalculate.mock.calls[0][0].weather).toEqual({
      tempMin: -9,
      tempMax: -1,
    });
    expect(prisma.weatherCache.findFirst).not.toHaveBeenCalled();
  });

  it('bez v2 ulaza koristi se postojeći gradski keš', async () => {
    const { writer, prisma } = setup({
      v2Weather: null,
      cachedWeather: { temp_min: 8, temp_max: 12 },
    });
    await writer.writeForHome(10, NOW_IN_WINDOW);

    expect(prisma.weatherCache.findFirst).toHaveBeenCalledWith({
      where: { city: 'Visoko' },
      orderBy: { fetchedAt: 'desc' },
    });
    expect(engineCalculate.mock.calls[0][0].weather).toEqual({
      tempMin: 8,
      tempMax: 12,
    });
  });
});

describe('F1 — noć i dnevni prosjek u zapisu', () => {
  const forecast = {
    tempMin: -9,
    tempMax: -1,
    nightMinC: -7.5,
    nightMinSource: 'HOURLY',
    nightHoursUsed: 8,
    dayMeanC: -5.25,
    dayMaxC: -1,
    degreeHours: 162,
  };

  it('zapis nosi noćni minimum i dnevni prosjek iz prognoze', async () => {
    const { writer, dailyRecords } = setup({ v2Weather: forecast });
    await writer.writeForHome(10, NOW_IN_WINDOW);

    expect(dailyRecords[0].nightMinC).toBe(-7.5);
    expect(dailyRecords[0].dayMeanC).toBe(-5.25);
    expect(dailyRecords[0].dayMaxC).toBe(-1);
    expect(dailyRecords[0].degreeHours).toBe(162);
  });

  it('motor i dalje dobija samo min/max — F1 ne mijenja predlog', async () => {
    const { writer } = setup({ v2Weather: forecast });
    await writer.writeForHome(10, NOW_IN_WINDOW);

    expect(engineCalculate.mock.calls[0][0].weather).toEqual({
      tempMin: -9,
      tempMax: -1,
    });
  });

  it('params razdvaja ulaz motora od podataka zapisa', async () => {
    const { writer, dailyRecords } = setup({ v2Weather: forecast });
    await writer.writeForHome(10, NOW_IN_WINDOW);

    const params = dailyRecords[0].params;
    // Motor je dobio samo ovo dvoje — i to mora ostati preračunljivo.
    expect(params.input.weather).toEqual({ tempMin: -9, tempMax: -1 });
    expect(params.input.forecast.nightMinC).toBe(-7.5);
    expect(params.input.forecast.nightMinSource).toBe('HOURLY');
    expect(params.input.forecast.nightHoursUsed).toBe(8);
    expect(params.input.forecast.dayMeanC).toBe(-5.25);
    expect(params.input.forecast.dayMaxC).toBe(-1);
    expect(params.input.forecast.degreeHours).toBe(162);
  });

  it('verzija zapisa je podignuta — stari i novi redovi se ne miješaju', async () => {
    const { writer, dailyRecords } = setup({ v2Weather: forecast });
    await writer.writeForHome(10, NOW_IN_WINDOW);

    expect(DAILY_RECORD_MODEL_VERSION).toBe('daily-2');
    expect(dailyRecords[0].modelVersion).toBe('daily-2');
  });

  it('stariji izvor bez satne prognoze: noć = dnevni minimum, označeno', async () => {
    const { writer, dailyRecords } = setup({
      v2Weather: null,
      cachedWeather: { temp_min: 8, temp_max: 12 },
    });
    await writer.writeForHome(10, NOW_IN_WINDOW);

    expect(dailyRecords[0].nightMinC).toBe(8);
    expect(dailyRecords[0].params.input.forecast.nightMinSource).toBe(
      'DAILY_MIN',
    );
    // Iz dnevnog min/max se prosjek ne može izvesti — ostaje null.
    expect(dailyRecords[0].dayMeanC).toBeNull();
    expect(dailyRecords[0].degreeHours).toBeNull();
  });

  it('nula iz prognoze ostaje nula, ne pretvara se u „nema podatka"', async () => {
    const { writer, dailyRecords } = setup({
      v2Weather: {
        tempMin: 0,
        tempMax: 0,
        nightMinC: 0,
        nightMinSource: 'HOURLY',
      },
    });
    await writer.writeForHome(10, NOW_IN_WINDOW);

    expect(dailyRecords[0].nightMinC).toBe(0);
  });

  it('pad prognoze pri promašenom prozoru ne oduzima red', async () => {
    const { writer, dailyRecords, weather } = setup({});
    weather.getV2WeatherInput.mockRejectedValue(new Error('Open-Meteo 503'));

    const result = await writer.writeForHome(10, NOW_AFTER_WINDOW);

    expect(result.status).toBe('skipped');
    expect(result.skipReason).toBe('MISSED_WINDOW');
    expect(dailyRecords).toHaveLength(1);
    expect(dailyRecords[0].nightMinC).toBeNull();
  });
});

describe('granice', () => {
  it('motor izvan raspona ne prolazi u bazu', async () => {
    engineCalculate.mockReturnValue({ ...engineResult, finalTemp: 58.4 });
    const high = setup({});
    const highResult = await high.writer.writeForHome(10, NOW_IN_WINDOW);
    expect(highResult.proposedFlowTemp).toBe(55);
    expect(high.dailyRecords[0].params.clamp.applied).toBe(true);
    expect(high.dailyRecords[0].params.clamp.rawFinalTemp).toBe(58.4);

    engineCalculate.mockReturnValue({ ...engineResult, finalTemp: 21 });
    const low = setup({});
    const lowResult = await low.writer.writeForHome(10, NOW_IN_WINDOW);
    expect(lowResult.proposedFlowTemp).toBe(30);
  });

  it('clampFlowTemp je identitet unutar raspona', () => {
    expect(clampFlowTemp(30)).toBe(30);
    expect(clampFlowTemp(49.74)).toBe(49.74);
    expect(clampFlowTemp(55)).toBe(55);
    expect(clampFlowTemp(-100)).toBe(30);
    expect(clampFlowTemp(1000)).toBe(55);
  });

  it('flowSetSnapshot: bez unosa nema ni vrijednosti ni lažnog izvora', () => {
    expect(flowSetSnapshot(null)).toEqual({
      c: null,
      since: null,
      source: 'UNKNOWN',
    });
    expect(
      flowSetSnapshot({
        currentBoilerFlowTemp: null,
        currentBoilerFlowTempSetAt: null,
      }),
    ).toEqual({ c: null, since: null, source: 'UNKNOWN' });
    expect(
      flowSetSnapshot({
        currentBoilerFlowTemp: 50,
        currentBoilerFlowTempSetAt: null,
      }),
    ).toEqual({ c: 50, since: null, source: 'USER' });
  });
});

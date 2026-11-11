/**
 * `DashboardService` uvozi `PrismaService`, koji uvozi generisani Prisma
 * klijent — a taj se generiše tek u CI `prepare` koraku. Bez ovih zamjena ovaj
 * test ne bi bio izvršiv lokalno, pa bi opet bio „dekorativan".
 */
jest.mock('../../../prisma/prisma.service', () => ({
  PrismaService: class {},
}));
jest.mock('../../Boiler/boiler.service', () => ({ BoilerService: class {} }));
jest.mock('../../Weather/weather.service', () => ({
  WeatherService: class {},
}));

import { DashboardService } from '../dashboard.service';

/**
 * Dashboard ne smije zavisiti od Open-Meteo-a.
 *
 * Nalaz 2026-11-07 (CI): `GET /api/dashboard` je vraćao **500** ulogovanom
 * korisniku kad god Open-Meteo ne odgovori. Putanja je bila
 * `getDashboard` → `homeDailyFlow` → `boilerService.calculateFlowTemp` →
 * `weatherService.getTodayWeather`, koja baca grešku kad nema svježeg keša i
 * fetch padne (2 × 10 s timeout, pa `throw`).
 *
 * To nije samo problem testa: jutarnji predlog za dan već postoji u
 * `DailyRecord`-u i **ne zavisi od mreže**, pa je cijeli dashboard pad`o zbog
 * podatka koji mu nije ni potreban. Test zato ne provjerava status 200 kao
 * takav, nego da se pad formule degradira u `basis: 'NONE'` / `null`.
 */
describe('Dashboard kad formula nema vremenski ulaz', () => {
  const userId = 7;
  const home = {
    id: 11,
    maxHeatingFlowC: null,
    weatherTimezone: null,
  };

  function serviceWith(overrides: {
    calculateFlowTemp: jest.Mock;
    record?: unknown;
  }) {
    const prisma = {
      dailyRecord: {
        findFirst: jest.fn().mockResolvedValue(overrides.record ?? null),
      },
      user: { findUnique: jest.fn().mockResolvedValue({ timezone: null }) },
    };
    const service = new DashboardService(
      prisma as never,
      { calculateFlowTemp: overrides.calculateFlowTemp } as never,
      {} as never,
      {} as never,
      {} as never,
    );
    return { service, prisma };
  }

  it('homeDailyFlow vraća predlog iz DailyRecord-a kad formula padne', async () => {
    const calculateFlowTemp = jest
      .fn()
      .mockRejectedValue(
        new Error('Failed to fetch Open-Meteo data for Visoko'),
      );
    const { service } = serviceWith({
      calculateFlowTemp,
      record: {
        proposedFlowTemp: 48.5,
        outcomeAt: null,
        undershootC: null,
        nightUndershootC: null,
      },
    });

    const result = await (
      service as unknown as {
        homeDailyFlow: (
          userId: number,
          home: unknown,
          history: unknown,
        ) => Promise<Record<string, unknown>>;
      }
    ).homeDailyFlow(userId, home, null);

    // Jutarnji predlog je glavni broj i ne smije se izgubiti zbog mreže.
    expect(result.morningFlowC).toBe(48.5);
    // Nema formule, pa nema ni trenutnog broja — otvoreno, a ne izmišljeno.
    expect(result.currentFlowC).toBeNull();
    expect(result.basis).toBe('MORNING');
  });

  it('homeDailyFlow ne baca kad nema ni predloga ni formule', async () => {
    const calculateFlowTemp = jest.fn().mockRejectedValue(new Error('timeout'));
    const { service } = serviceWith({ calculateFlowTemp, record: null });

    const result = await (
      service as unknown as {
        homeDailyFlow: (
          userId: number,
          home: unknown,
          history: unknown,
        ) => Promise<Record<string, unknown>>;
      }
    ).homeDailyFlow(userId, home, null);

    expect(result.basis).toBe('NONE');
    expect(result.morningFlowC).toBeNull();
    expect(result.currentFlowC).toBeNull();
  });

  it('anonimni dashboard vraća 0 umjesto da padne', async () => {
    const calculateFlowTemp = jest
      .fn()
      .mockRejectedValue(new Error('Failed to fetch Open-Meteo data'));

    const prisma = {
      dailyRecord: { findFirst: jest.fn() },
      user: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const service = new DashboardService(
      prisma as never,
      { calculateFlowTemp } as never,
      {} as never,
      {} as never,
      {} as never,
    );
    // Anonimna putanja prvo zove `getLatestWeather`, koja čita bazu; preskačemo
    // je jer ovaj test cilja isključivo `calculateFlowTemp` pad.
    (
      service as unknown as { getLatestWeather: () => Promise<null> }
    ).getLatestWeather = () => Promise.resolve(null);

    const result = (await service.getDashboard(undefined)) as {
      system: { recommendation: { recommendedFlowTemp: number } };
    };

    expect(result.system.recommendation.recommendedFlowTemp).toBe(0);
  });
});

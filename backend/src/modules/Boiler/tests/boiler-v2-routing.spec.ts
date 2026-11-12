jest.mock('../../../prisma/prisma.service', () => ({
  PrismaService: class {},
}));
jest.mock('../../Weather/weather.service', () => ({
  WeatherService: class {},
}));
jest.mock('../../Heating/engine/flow-temperature.engine', () => ({
  FlowTemperatureEngine: { calculate: jest.fn() },
}));

import { FlowTemperatureEngine } from '../../Heating/engine/flow-temperature.engine';
import type { FlowTempResult } from '../../Heating/engine/types';
import { BoilerService } from '../boiler.service';

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

function makeHarness(v2Weather: { tempMin: number; tempMax: number } | null) {
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue({ homeLocation: 'Visoko' }),
    },
    homeProfile: {
      findFirst: jest.fn().mockResolvedValue({
        id: 10,
        floorArea: 150,
        learningOffset: 0,
        learningConfidence: 0.5,
        seasonMode: 'WINTER',
      }),
    },
    // F5.2: `calculateFlowTemp` sada čita učenje po ključu intervala
    // (`findMany` sa kandidatima), a ne po jednom ključu (`findUnique`). Mock
    // mora imati onu metodu koju kod stvarno zove — `findUnique` je ostavljen
    // jer ga zove `getOrCreate`, ali ga ovaj test ne dostiže.
    heatingIntervalLearning: {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
    heatingEvent: { findMany: jest.fn().mockResolvedValue([]) },
    // F4.5: `calculateFlowTemp` sada traži današnji zapis prije nego vrati
    // broj. `null` = zapisa nema, pa je motorov broj jedini — zato ovi testovi
    // i dalje provjeravaju weather routing, a ne izbor broja (to radi
    // `daily-flow.spec.ts`).
    dailyRecord: { findFirst: jest.fn().mockResolvedValue(null) },
  };
  const legacyWeather = {
    getTodayWeather: jest.fn().mockResolvedValue({ temp_min: 8, temp_max: 12 }),
  };
  const boilerWeather = {
    getV2WeatherInput: jest.fn().mockResolvedValue(v2Weather),
  };
  const service = Reflect.construct(BoilerService, [
    prisma,
    legacyWeather,
    {},
    boilerWeather,
  ]) as BoilerService;
  return { service, prisma, legacyWeather, boilerWeather };
}

describe('BoilerService weather routing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    engineCalculate.mockReturnValue(engineResult);
  });

  it('uses cached v2 weather from the same profile used for calculation', async () => {
    const { service, legacyWeather, boilerWeather } = makeHarness({
      tempMin: -9,
      tempMax: -1,
    });

    await service.calculateFlowTemp(1);

    expect(boilerWeather.getV2WeatherInput).toHaveBeenCalledWith(1, 10);
    expect(engineCalculate).toHaveBeenCalledWith(
      expect.objectContaining({ weather: { tempMin: -9, tempMax: -1 } }),
    );
    expect(legacyWeather.getTodayWeather).not.toHaveBeenCalled();
  });

  it('keeps the legacy profile-user city fallback when v2 returns null', async () => {
    const { service, legacyWeather } = makeHarness(null);

    await service.calculateFlowTemp(1);

    expect(legacyWeather.getTodayWeather).toHaveBeenCalledWith('Visoko');
    expect(engineCalculate).toHaveBeenCalledWith(
      expect.objectContaining({ weather: { tempMin: 8, tempMax: 12 } }),
    );
  });

  it('keeps legacy user weather when no profile exists', async () => {
    const { service, prisma, legacyWeather, boilerWeather } = makeHarness(null);
    prisma.homeProfile.findFirst.mockResolvedValue(null);

    await service.calculateFlowTemp(1);

    expect(boilerWeather.getV2WeatherInput).not.toHaveBeenCalled();
    expect(legacyWeather.getTodayWeather).toHaveBeenCalledWith('Visoko');
    expect(engineCalculate).toHaveBeenCalledWith(
      expect.objectContaining({ weather: { tempMin: 8, tempMax: 12 } }),
    );
  });

  it('keeps anonymous legacy weather without requesting a profile v2 read', async () => {
    const { service, prisma, legacyWeather, boilerWeather } = makeHarness(null);

    await service.calculateFlowTemp();

    expect(prisma.homeProfile.findFirst).not.toHaveBeenCalled();
    expect(boilerWeather.getV2WeatherInput).not.toHaveBeenCalled();
    expect(legacyWeather.getTodayWeather).toHaveBeenCalledWith('Visoko');
    expect(engineCalculate).toHaveBeenCalledWith(
      expect.objectContaining({ weather: { tempMin: 8, tempMax: 12 } }),
    );
  });

  /*
   * F4.5 — najvažnija provjera u ovom fajlu.
   *
   * Ostali testovi imaju `dailyRecord = null`, pa dokazuju samo da se ništa ne
   * ruši. Ovaj dokazuje da izbor **radi**: kad za danas postoji predlog, motorov
   * broj (45) NE ide na kotao — ide 48 iz zapisa. Bez ovog testa bi F4.5 mogao
   * biti „spojen" a da i dalje vraća motorov broj.
   */
  describe('F4.5 — danas važi zapisani predlog, ne motorov broj', () => {
    it('vraća predlog iz zapisa i imenuje izvor', async () => {
      const { service, prisma } = makeHarness(null);
      prisma.dailyRecord.findFirst.mockResolvedValue({
        proposedFlowTemp: 48,
        outcomeAt: null,
        undershootC: null,
        nightUndershootC: null,
      });

      const result = await service.calculateFlowTemp(1);

      expect(result.flowTemp).toBe(48);
      expect(result.flowSource).toBe('DAILY_RECORD');
      // Motorov broj ostaje vidljiv — bez toga se ne zna je li se formula
      // razišla sa predlogom.
      expect(result.curveFlowTemp).toBe(45);
    });

    it('bez zapisa vraća motorov broj i to kaže', async () => {
      const { service } = makeHarness(null);

      const result = await service.calculateFlowTemp(1);

      expect(result.flowTemp).toBe(45);
      expect(result.flowSource).toBe('CURVE');
    });

    it('traži zapis za lokalni dan kuće, ne za serverski', async () => {
      // F5.2 je već uklonio serverski sat iz ključa intervala; isti razlog
      // važi ovdje: u 00:30 po UTC-u u Sarajevu je već novi dan.
      const { service, prisma } = makeHarness(null);

      await service.calculateFlowTemp(1);

      const where = prisma.dailyRecord.findFirst.mock.calls[0][0].where;
      expect(where.homeProfileId).toBe(10);
      expect(where.localDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });
});

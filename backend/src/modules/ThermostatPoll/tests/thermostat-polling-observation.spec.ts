import { ThermostatPollingService } from '../thermostat.polling.service';
import { POLL_PAGINATION_FLAG } from '../polling-pagination';
import { SNAPSHOT_GUARD_FLAG } from '../../Boiler/adapter/snapshot-guard';
import { MetricsService } from '../../../common/metrics.service';

jest.mock('../../../prisma/prisma.service', () => ({
  PrismaService: class {},
}));
jest.mock('../../Notification/notifications.service', () => ({
  NotificationsService: class {},
}));
jest.mock('../../Boiler/boiler.service', () => ({ BoilerService: class {} }));
jest.mock('../../HeatingRecommendation/heating.recommendation.service', () => ({
  HeatingRecommendationService: class {},
}));
jest.mock('../../Weather/polling-weather.service', () => ({
  PollingWeatherService: class {},
}));
jest.mock('../../Observation/thermostat-observation.service', () => ({
  // Sam pisac serije ima svoj spec; ovdje je predmet da ga polling ZOVE
  // ispravnim vrijednostima, i to samo kad očitanje postoji.
  ThermostatObservationService: class {},
}));

/**
 * Povezivanje pollinga i serije (`17` §13 korak 2). Tri stvari se ovdje mogu
 * pokvariti tiho: serija upiše `?? 0` umjesto `null`, upiše stanje PRIJE
 * prelaza umjesto poslije, ili greška serije obori uspješan ciklus.
 */

const STARTED_5_MIN_AGO = new Date(Date.now() - 5 * 60_000);

function openEvent() {
  return {
    id: 77,
    deviceId: 1,
    userId: 7,
    timestampStart: STARTED_5_MIN_AGO,
    timestampEnd: null,
    roomCurrentTemp: 20,
    roomTargetTemp: 22,
  };
}

function makeHarness(options: {
  snapshot?: { currentTemp: number | null; targetTemp: number | null; powerOn: boolean | null };
  lastEvent?: ReturnType<typeof openEvent> | null;
  v2Temperature?: number | null;
  device?: Record<string, unknown>;
  recordImpl?: () => Promise<string>;
  due?: boolean;
} = {}) {
  process.env[POLL_PAGINATION_FLAG] = 'on';
  const due = options.due ?? true;

  const device = {
    id: 1,
    userId: 7,
    homeProfileId: 10,
    deviceId: 'dev-1',
    lastSnapshotAt: null,
    roomCurrentTemp: 20,
    roomTargetTemp: 22,
    user: { homeLocation: 'Visoko', currentBoilerFlowTemp: 48 },
    ...(options.device ?? {}),
  };

  const prisma = {
    thermostatDevice: {
      findMany: jest.fn((args: any) => {
        if (!args?.select) return Promise.resolve([device]);
        const projected: any = {};
        for (const key of Object.keys(args.select)) {
          projected[key] = (device as any)[key];
        }
        return Promise.resolve([projected]);
      }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    heatingEvent: {
      findFirst: jest
        .fn()
        .mockResolvedValue(
          options.lastEvent === undefined ? openEvent() : options.lastEvent,
        ),
      create: jest
        .fn()
        .mockImplementation(({ data }: any) => Promise.resolve({ id: 1, ...data })),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    boilerHistory: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest
        .fn()
        .mockImplementation(({ data }: any) => Promise.resolve({ id: 2, ...data })),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({ currentBoilerFlowTemp: 48 }),
    },
    weatherCache: { findFirst: jest.fn().mockResolvedValue(null) },
    $transaction: jest.fn((operations: Promise<unknown>[]) =>
      Promise.all(operations),
    ),
  };

  const observation = {
    isDue: jest.fn(() => due),
    record: jest.fn(options.recordImpl ?? (async () => 'created')),
  };
  const metrics = new MetricsService();

  const service = new ThermostatPollingService(
    prisma as any,
    {
      fetchSnapshot: jest.fn().mockResolvedValue(
        options.snapshot ?? { currentTemp: 20.5, targetTemp: 22, powerOn: true },
      ),
    } as any,
    { calculateFlowTemp: jest.fn().mockResolvedValue({ flowTemp: 45 }) } as any,
    { notifyUser: jest.fn().mockResolvedValue(undefined) } as any,
    { processHeatingEvent: jest.fn().mockResolvedValue(undefined) } as any,
    metrics,
    {
      getV2CurrentTemperature: jest
        .fn()
        .mockResolvedValue(
          options.v2Temperature === undefined ? -3 : options.v2Temperature,
        ),
    } as any,
    observation as any,
  );

  return { service, observation, prisma, metrics };
}

const originalGuard = process.env[SNAPSHOT_GUARD_FLAG];

afterEach(() => {
  delete process.env[POLL_PAGINATION_FLAG];
  if (originalGuard === undefined) delete process.env[SNAPSHOT_GUARD_FLAG];
  else process.env[SNAPSHOT_GUARD_FLAG] = originalGuard;
});

describe('polling upisuje u seriju', () => {
  it('očitanje ide u seriju sa stvarnim vrijednostima i stanjem grijanja', async () => {
    const { service, observation } = makeHarness();

    await service.pollAll();

    expect(observation.record).toHaveBeenCalledTimes(1);
    expect(observation.record.mock.calls[0][0]).toMatchObject({
      deviceId: 1,
      homeProfileId: 10,
      roomTempC: 20.5,
      targetTempC: 22,
      isHeating: true,
      outdoorTempC: -3,
      flowSetC: 48,
      source: 'TUYA',
    });
  });

  it('stanje je ono POSLIJE prelaza: start se bilježi kao grijanje', async () => {
    const { service, observation } = makeHarness({
      lastEvent: null,
      snapshot: { currentTemp: 20, targetTemp: 22, powerOn: true },
    });

    await service.pollAll();

    expect(observation.record.mock.calls[0][0]).toMatchObject({
      isHeating: true,
    });
  });

  it('stanje je ono POSLIJE prelaza: kraj se bilježi kao mirovanje', async () => {
    const { service, observation } = makeHarness({
      snapshot: { currentTemp: 20.5, targetTemp: 22, powerOn: false },
    });

    await service.pollAll();

    expect(observation.record.mock.calls[0][0]).toMatchObject({
      isHeating: false,
    });
  });

  it('nepotpun snapshot ostaje null, ne postaje 0 °C', async () => {
    process.env[SNAPSHOT_GUARD_FLAG] = 'off';
    const { service, observation } = makeHarness({
      snapshot: { currentTemp: null, targetTemp: 22, powerOn: true },
    });

    await service.pollAll();

    expect(observation.record.mock.calls[0][0]).toMatchObject({
      roomTempC: null,
      targetTempC: 22,
    });
  });

  it('greška serije ne obara uspješan ciklus', async () => {
    const { service, metrics } = makeHarness({
      recordImpl: () => Promise.reject(new Error('serija je pala')),
    });

    await service.pollAll();

    // Ciklus je završio i uređaj je obrađen uprkos grešci serije: nije
    // prebačen u `failed`, a sam ciklus nije pao.
    const all = metrics.getMetrics();
    expect(all.poll_devices_success).toBe(1);
    expect(all.poll_devices_failed).toBe(0);
    expect(all.poll_runs_success).toBe(1);
  });

  it('kad bucket nije nov, ne čita se ni vanjska temperatura', async () => {
    const { service, observation } = makeHarness({ due: false });

    await service.pollAll();

    expect(observation.record).not.toHaveBeenCalled();
    // Vanjska temperatura se ne čita uzalud — provjera bucketa je prije I/O.
    expect(observation.isDue).toHaveBeenCalledWith(1, expect.any(Date));
  });

  it('bez kuće se ne upisuje, ali se ciklus ne prekida', async () => {
    const { service, observation } = makeHarness({
      device: { homeProfileId: null },
    });

    await service.pollAll();

    expect(observation.record).not.toHaveBeenCalled();
  });
});

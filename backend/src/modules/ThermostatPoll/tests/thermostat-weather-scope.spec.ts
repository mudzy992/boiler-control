jest.mock('../../../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));
jest.mock('../../Notification/notifications.service', () => ({
  NotificationsService: class NotificationsService {},
}));
jest.mock('../../Boiler/boiler.service', () => ({
  BoilerService: class BoilerService {},
}));
jest.mock('../../HeatingRecommendation/heating.recommendation.service', () => ({
  HeatingRecommendationService: class HeatingRecommendationService {},
}));
import { ThermostatPollingService } from '../thermostat.polling.service';
import {
  POLL_BATCH_SIZE_FLAG,
  POLL_PAGINATION_FLAG,
} from '../polling-pagination';

type WeatherRow = { city: string; temperature: number };

function makeHarness(rows: WeatherRow[], pagination: 'on' | 'off') {
  process.env[POLL_PAGINATION_FLAG] = pagination;
  const device = {
    id: 1,
    userId: 7,
    deviceId: 'dev-1',
    lastSnapshotAt: null,
    roomCurrentTemp: 20,
    roomTargetTemp: 22,
    user: { homeLocation: 'Visoko' },
  };
  const weatherCache = {
    findFirst: jest.fn((args: any) => {
      const city = args?.where?.city;
      return Promise.resolve(
        city
          ? (rows.find((row) => row.city === city) ?? null)
          : (rows[0] ?? null),
      );
    }),
  };
  const boilerHistory = {
    findFirst: jest.fn().mockResolvedValue(null),
    create: jest
      .fn()
      .mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 2, ...data }),
      ),
  };
  const prisma = {
    thermostatDevice: {
      findMany: jest.fn((args: any) => {
        if (args?.include) return Promise.resolve([device]);
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
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest
        .fn()
        .mockImplementation(({ data }: any) =>
          Promise.resolve({ id: 1, ...data }),
        ),
    },
    boilerHistory,
    user: {
      findUnique: jest.fn().mockResolvedValue({ currentBoilerFlowTemp: null }),
    },
    weatherCache,
    $transaction: jest.fn((operations: Promise<unknown>[]) =>
      Promise.all(operations),
    ),
  };
  const service = new ThermostatPollingService(
    prisma as any,
    {
      fetchSnapshot: jest.fn().mockResolvedValue({
        currentTemp: 20,
        targetTemp: 22,
        powerOn: true,
      }),
    } as any,
    {
      calculateFlowTemp: jest.fn().mockResolvedValue({ flowTemp: 45 }),
    } as any,
    { notifyUser: jest.fn().mockResolvedValue(undefined) } as any,
    { processHeatingEvent: jest.fn().mockResolvedValue(undefined) } as any,
    {
      incrementCounter: jest.fn(),
      setGauge: jest.fn(),
    } as any,
  );
  return { service, weatherCache, boilerHistory };
}

describe('ThermostatPollingService weather cache location', () => {
  const originalPagination = process.env[POLL_PAGINATION_FLAG];
  const originalBatchSize = process.env[POLL_BATCH_SIZE_FLAG];

  beforeEach(() => {
    delete process.env[POLL_BATCH_SIZE_FLAG];
  });

  afterEach(() => {
    if (originalPagination === undefined) {
      delete process.env[POLL_PAGINATION_FLAG];
    } else {
      process.env[POLL_PAGINATION_FLAG] = originalPagination;
    }
    if (originalBatchSize === undefined) {
      delete process.env[POLL_BATCH_SIZE_FLAG];
    } else {
      process.env[POLL_BATCH_SIZE_FLAG] = originalBatchSize;
    }
  });

  it.each(['on', 'off'] as const)(
    'does not store another city temperature with pagination=%s',
    async (pagination) => {
      const { service, weatherCache, boilerHistory } = makeHarness(
        [{ city: 'Mostar', temperature: 9 }],
        pagination,
      );

      await service.pollAll();

      expect(boilerHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ externalTemp: 0 }),
      });
      expect(weatherCache.findFirst).toHaveBeenCalledWith({
        where: { city: 'Visoko' },
        orderBy: { fetchedAt: 'desc' },
      });
    },
  );

  it('keeps the matching-city temperature', async () => {
    const { service, boilerHistory } = makeHarness(
      [{ city: 'Visoko', temperature: -4 }],
      'on',
    );

    await service.pollAll();

    expect(boilerHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ externalTemp: -4 }),
    });
  });
});

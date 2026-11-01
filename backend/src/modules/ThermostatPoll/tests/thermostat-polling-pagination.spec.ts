import { ThermostatPollingService } from '../thermostat.polling.service';
import { MetricsService } from '../../../common/metrics.service';
import {
  POLL_BATCH_SIZE_FLAG,
  POLL_DEVICE_SELECT,
  POLL_PAGINATION_FLAG,
} from '../polling-pagination';

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

type FakeDevice = {
  id: number;
  userId: number;
  deviceId: string;
  lastSnapshotAt: Date | null;
  roomCurrentTemp: number | null;
  roomTargetTemp: number | null;
};

function device(id: number): FakeDevice {
  return {
    id,
    userId: id,
    deviceId: `dev-${id}`,
    lastSnapshotAt: null,
    roomCurrentTemp: null,
    roomTargetTemp: null,
  };
}

function makeHarness(options: {
  devices: FakeDevice[];
  failListingOnCall?: number;
  snapshotFor?: (deviceId: string) => unknown;
}) {
  const listingCalls: any[] = [];
  const snapshotCalls: string[] = [];
  let call = 0;
  const db = {
    thermostatDevice: {
      findMany: async (args: any) => {
        await Promise.resolve();
        call += 1;
        listingCalls.push(args);
        if (options.failListingOnCall === call) {
          throw new Error('synthetic listing failure');
        }
        if (args?.include) {
          return options.devices;
        }
        const cursor = args?.where?.id?.gt ?? 0;
        const direction = args?.orderBy?.id === 'desc' ? -1 : 1;
        const rows = options.devices
          .filter((d) => d.id > cursor)
          .sort((a, b) => direction * (a.id - b.id));
        const taken =
          args?.take === undefined ? rows : rows.slice(0, args.take);
        if (args?.select) {
          return taken.map((row) => {
            const out: any = {};
            for (const key of Object.keys(args.select)) out[key] = row[key];
            return out;
          });
        }
        return taken;
      },
      updateMany: async () => {
        await Promise.resolve();
        return { count: 1 };
      },
    },
    heatingEvent: {
      findFirst: async () => {
        await Promise.resolve();
        return null;
      },
    },
  };
  const adapter = {
    fetchSnapshot: async (deviceId: string) => {
      await Promise.resolve();
      snapshotCalls.push(deviceId);
      return (
        options.snapshotFor?.(deviceId) ?? {
          currentTemp: 20,
          targetTemp: 22,
          powerOn: false,
        }
      );
    },
  };
  const boiler = {
    calculateFlowTemp: async () => {
      await Promise.resolve();
      return { flowTemp: 45 };
    },
  };
  const metrics = new MetricsService();
  const service = new ThermostatPollingService(
    db as any,
    adapter as any,
    boiler as any,
    {} as any,
    {} as any,
    metrics,
  );
  return { service, metrics, listingCalls, snapshotCalls };
}

describe('ThermostatPollingService pagination (PERF-2)', () => {
  const originalFlag = process.env[POLL_PAGINATION_FLAG];
  const originalBatch = process.env[POLL_BATCH_SIZE_FLAG];

  beforeEach(() => {
    delete process.env[POLL_PAGINATION_FLAG];
    process.env[POLL_BATCH_SIZE_FLAG] = '2';
  });

  afterEach(() => {
    if (originalFlag === undefined) delete process.env[POLL_PAGINATION_FLAG];
    else process.env[POLL_PAGINATION_FLAG] = originalFlag;
    if (originalBatch === undefined) delete process.env[POLL_BATCH_SIZE_FLAG];
    else process.env[POLL_BATCH_SIZE_FLAG] = originalBatch;
  });

  it('default-on keyset listing obradjuje svaki uredjaj tacno jednom', async () => {
    const { service, metrics, listingCalls, snapshotCalls } = makeHarness({
      devices: [device(1), device(2), device(3), device(4), device(5)],
    });

    await service.pollAll();

    expect(snapshotCalls).toEqual([
      'dev-1',
      'dev-2',
      'dev-3',
      'dev-4',
      'dev-5',
    ]);
    expect(listingCalls).toHaveLength(3);
    expect(listingCalls.map((c) => c.where.id.gt)).toEqual([0, 2, 4]);
    expect(listingCalls.every((c) => c.take === 2)).toBe(true);
    expect(listingCalls.every((c) => c.orderBy.id === 'asc')).toBe(true);
    expect(listingCalls.every((c) => c.include === undefined)).toBe(true);
    expect(listingCalls[0].select).toEqual(POLL_DEVICE_SELECT);
    expect(metrics.getMetrics()).toMatchObject({
      poll_runs_total: 1,
      poll_runs_success: 1,
      poll_runs_failed: 0,
      poll_devices_total: 5,
      poll_devices_success: 5,
    });
  });

  it('tacno djeljiv broj uredjaja ne duplira zadnji batch', async () => {
    const { service, metrics, listingCalls, snapshotCalls } = makeHarness({
      devices: [device(1), device(2), device(3), device(4)],
    });

    await service.pollAll();

    expect(snapshotCalls).toEqual(['dev-1', 'dev-2', 'dev-3', 'dev-4']);
    expect(listingCalls).toHaveLength(3);
    expect(listingCalls[2].where.id.gt).toBe(4);
    expect(metrics.getMetrics().poll_devices_total).toBe(4);
  });

  it('prazna lista zavrsava ciklus bez device brojava', async () => {
    const { service, metrics, listingCalls, snapshotCalls } = makeHarness({
      devices: [],
    });

    await service.pollAll();

    expect(listingCalls).toHaveLength(1);
    expect(snapshotCalls).toEqual([]);
    expect(metrics.getMetrics()).toMatchObject({
      poll_runs_total: 1,
      poll_runs_success: 1,
      poll_devices_total: 0,
    });
  });

  it('flag off vraca legacy include listing', async () => {
    process.env[POLL_PAGINATION_FLAG] = 'off';
    const { service, metrics, listingCalls, snapshotCalls } = makeHarness({
      devices: [device(1), device(2), device(3)],
    });

    await service.pollAll();

    expect(listingCalls).toHaveLength(1);
    expect(listingCalls[0].include).toEqual({
      user: true,
      homeProfile: { include: { intervalLearnings: true } },
    });
    expect(listingCalls[0].take).toBeUndefined();
    expect(snapshotCalls).toEqual(['dev-1', 'dev-2', 'dev-3']);
    expect(metrics.getMetrics().poll_devices_total).toBe(3);
  });

  it('greska jednog uredjaja ne prekida ostale', async () => {
    const { service, metrics, snapshotCalls } = makeHarness({
      devices: [device(1), device(2), device(3)],
      snapshotFor: (id) => {
        if (id === 'dev-2') throw new Error('synthetic device failure');
        return { currentTemp: 20, targetTemp: 22, powerOn: false };
      },
    });

    await service.pollAll();

    expect(snapshotCalls).toEqual(['dev-1', 'dev-2', 'dev-3']);
    expect(metrics.getMetrics()).toMatchObject({
      poll_runs_success: 1,
      poll_devices_total: 3,
      poll_devices_success: 2,
      poll_devices_failed: 1,
    });
  });

  it('greska listanja usred ciklusa biljezi vec obradjene uredjaje, ali ne uspjeh ciklusa', async () => {
    const { service, metrics, snapshotCalls } = makeHarness({
      devices: [device(1), device(2), device(3), device(4), device(5)],
      failListingOnCall: 2,
    });

    await service.pollAll();

    expect(snapshotCalls).toEqual(['dev-1', 'dev-2']);
    expect(metrics.getMetrics()).toMatchObject({
      poll_runs_total: 1,
      poll_runs_success: 0,
      poll_runs_failed: 1,
      poll_devices_total: 2,
      poll_devices_success: 2,
    });
  });
});

import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ThermostatPollingService } from '../../src/modules/ThermostatPoll/thermostat.polling.service';
import { MetricsService } from '../../src/common/metrics.service';
import {
  POLL_BATCH_SIZE_FLAG,
  POLL_DEVICE_SELECT,
  POLL_PAGINATION_FLAG,
} from '../../src/modules/ThermostatPoll/polling-pagination';

/**
 * PERF-2: pravi PostgreSQL listing mora biti ograničen keyset batch-evima.
 * Adapter je lažan da ne dodiruje Tuya/cloud; ostatak polling puta je stvaran.
 */
describe('Thermostat polling pagination (PERF-2, PostgreSQL)', () => {
  const prisma = new PrismaService();
  const suffix = randomUUID().replace(/-/g, '').slice(0, 12);
  const prefix = `perf2-${suffix}-`;
  const batchSize = 50;
  const deviceCount = 500;
  const originalFlag = process.env[POLL_PAGINATION_FLAG];
  const originalBatch = process.env[POLL_BATCH_SIZE_FLAG];
  let userId = 0;
  let homeProfileId = 0;
  let service: ThermostatPollingService;
  const adapterCalls: string[] = [];
  const listingCalls: any[] = [];
  let originalFindMany: any;

  beforeAll(async () => {
    process.env[POLL_PAGINATION_FLAG] = 'on';
    process.env[POLL_BATCH_SIZE_FLAG] = String(batchSize);
    await prisma.$connect();
    const user = await prisma.user.create({
      data: {
        email: `${prefix}@example.invalid`,
        username: `${prefix}`,
        passwordHash: 'synthetic-not-a-real-hash',
        name: 'Perf Two',
        plan: 'ENTERPRISE',
      },
    });
    userId = user.id;
    const profile = await prisma.homeProfile.create({
      data: {
        userId,
        floorArea: 100,
        ceilingHeight: 2.5,
        insulationType: 'EPS',
        insulationThickness: 10,
        windowType: 'DOUBLE_GLAZED',
        heatingType: 'RADIATOR',
        constructionYear: 2020,
        homeName: 'PERF-2 synthetic home',
      },
    });
    homeProfileId = profile.id;
    await prisma.thermostatDevice.createMany({
      data: Array.from({ length: deviceCount }, (_, i) => ({
        userId,
        homeProfileId,
        deviceId: `${prefix}${String(i).padStart(4, '0')}`,
        alias: `PERF-2 device ${i}`,
        vendor: 'tuya',
        roomCurrentTemp: null,
        roomTargetTemp: null,
        lastSnapshotAt: null,
      })),
    });

    const adapter = {
      fetchSnapshot: async (deviceId: string) => {
        await Promise.resolve();
        adapterCalls.push(deviceId);
        if (!deviceId.startsWith(prefix)) return null;
        return { currentTemp: 20, targetTemp: 22, powerOn: false };
      },
    };
    const boiler = {
      calculateFlowTemp: async () => {
        await Promise.resolve();
        return { flowTemp: 45 };
      },
    };
    service = new ThermostatPollingService(
      prisma,
      adapter as any,
      boiler as any,
      {} as any,
      {} as any,
      new MetricsService(),
      { getV2CurrentTemperature: () => Promise.resolve(null) } as any,
      {} as any,
    );
    originalFindMany = prisma.thermostatDevice.findMany.bind(
      prisma.thermostatDevice,
    );
    (prisma.thermostatDevice as any).findMany = (args: any) => {
      listingCalls.push(args);
      return originalFindMany(args);
    };
  });

  afterAll(async () => {
    if (originalFindMany) {
      (prisma.thermostatDevice as any).findMany = originalFindMany;
    }
    if (originalFlag === undefined) delete process.env[POLL_PAGINATION_FLAG];
    else process.env[POLL_PAGINATION_FLAG] = originalFlag;
    if (originalBatch === undefined) delete process.env[POLL_BATCH_SIZE_FLAG];
    else process.env[POLL_BATCH_SIZE_FLAG] = originalBatch;
    await prisma.thermostatDevice.deleteMany({
      where: { deviceId: { startsWith: prefix } },
    });
    if (homeProfileId) {
      await prisma.homeProfile.deleteMany({ where: { id: homeProfileId } });
    }
    if (userId) await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it('500 synthetic devices are polled once through bounded keyset pages', async () => {
    const totalBefore = await prisma.thermostatDevice.count();
    await service.pollAll();

    const syntheticCalls = adapterCalls.filter((id) => id.startsWith(prefix));
    expect(syntheticCalls).toHaveLength(deviceCount);
    expect(new Set(syntheticCalls).size).toBe(deviceCount);

    expect(listingCalls.length).toBeGreaterThanOrEqual(
      Math.ceil(deviceCount / batchSize),
    );
    expect(listingCalls.length).toBeLessThanOrEqual(
      Math.ceil(totalBefore / batchSize) + 1,
    );
    for (const call of listingCalls) {
      expect(call.take).toBe(batchSize);
      expect(call.orderBy).toEqual({ id: 'asc' });
      expect(call.select).toEqual(POLL_DEVICE_SELECT);
      expect(call.include).toBeUndefined();
      expect(typeof call.where.id.gt).toBe('number');
    }
    const cursors = listingCalls.map((call) => call.where.id.gt);
    for (let i = 1; i < cursors.length; i += 1) {
      expect(cursors[i]).toBeGreaterThan(cursors[i - 1]);
    }
  }, 120000);
});

import { randomUUID } from 'node:crypto';
import { DayType } from '../../src/generated/prisma';
import { PrismaService } from '../../src/prisma/prisma.service';
import {
  PROGRAM_SYNC_ATOMIC_FLAG,
  ProgramSyncService,
} from '../../src/modules/Boiler/adapter/program.sync.service';
import {
  TuyaProgramByDay,
  TuyaProgramInterval,
} from '../../src/modules/Boiler/adapter/program-sync.types';

/**
 * REL-8: two independent clients must not race an empty program-day insert.
 * The temporary trigger only delays rows for this suite's synthetic device.
 */
describe('ProgramSyncService concurrency (REL-8, PostgreSQL)', () => {
  const first = new PrismaService();
  const second = new PrismaService();
  const suffix = randomUUID().replace(/-/g, '').slice(0, 12);
  const prefix = `rel8-${suffix}-`;
  const functionName = `rel8_delay_${suffix}`;
  const triggerName = `rel8_delay_trigger_${suffix}`;
  const originalAtomicFlag = process.env[PROGRAM_SYNC_ATOMIC_FLAG];
  let userId = 0;
  let homeProfileId = 0;
  let deviceId = 0;
  let functionCreated = false;

  const intervals = (
    firstTarget: number,
    secondTarget: number,
  ): TuyaProgramInterval[] => [
    {
      dayType: DayType.WORKDAY,
      orderIndex: 0,
      startMinute: 0,
      targetTemp: firstTarget,
    },
    {
      dayType: DayType.WORKDAY,
      orderIndex: 1,
      startMinute: 480,
      targetTemp: secondTarget,
    },
  ];

  const program = (
    firstTarget: number,
    secondTarget: number,
  ): TuyaProgramByDay => ({
    [DayType.WORKDAY]: intervals(firstTarget, secondTarget),
    [DayType.SATURDAY]: [],
    [DayType.SUNDAY]: [],
  });

  beforeAll(async () => {
    process.env[PROGRAM_SYNC_ATOMIC_FLAG] = 'on';
    await Promise.all([first.$connect(), second.$connect()]);
    const user = await first.user.create({
      data: {
        email: `${prefix}@example.invalid`,
        username: prefix,
        passwordHash: 'synthetic-not-a-real-hash',
        name: 'REL-8 concurrency',
      },
    });
    userId = user.id;
    const profile = await first.homeProfile.create({
      data: {
        userId,
        floorArea: 100,
        ceilingHeight: 2.5,
        insulationType: 'EPS',
        insulationThickness: 10,
        windowType: 'DOUBLE_GLAZED',
        heatingType: 'RADIATOR',
        constructionYear: 2020,
        homeName: 'REL-8 synthetic home',
      },
    });
    homeProfileId = profile.id;
    const device = await first.thermostatDevice.create({
      data: {
        userId,
        homeProfileId,
        deviceId: `${prefix}device`,
        alias: 'REL-8 synthetic device',
        vendor: 'tuya',
      },
    });
    deviceId = device.id;

    await first.$executeRawUnsafe(`
      CREATE FUNCTION "${functionName}"() RETURNS trigger
      LANGUAGE plpgsql AS $rel8$
      BEGIN
        IF NEW."deviceId" = ${deviceId} THEN
          PERFORM pg_sleep(0.25);
        END IF;
        RETURN NEW;
      END;
      $rel8$
    `);
    functionCreated = true;
    await first.$executeRawUnsafe(`
      CREATE TRIGGER "${triggerName}"
      BEFORE INSERT ON "ThermostatProgram"
      FOR EACH ROW EXECUTE FUNCTION "${functionName}"()
    `);
  });

  afterAll(async () => {
    if (functionCreated) {
      await first.$executeRawUnsafe(
        `DROP TRIGGER IF EXISTS "${triggerName}" ON "ThermostatProgram"`,
      );
      await first.$executeRawUnsafe(
        `DROP FUNCTION IF EXISTS "${functionName}"()`,
      );
    }
    if (deviceId) {
      await first.thermostatProgram.deleteMany({ where: { deviceId } });
      await first.thermostatDevice.deleteMany({ where: { id: deviceId } });
    }
    if (homeProfileId) {
      await first.homeProfile.deleteMany({ where: { id: homeProfileId } });
    }
    if (userId) await first.user.deleteMany({ where: { id: userId } });
    if (originalAtomicFlag === undefined) {
      delete process.env[PROGRAM_SYNC_ATOMIC_FLAG];
    } else {
      process.env[PROGRAM_SYNC_ATOMIC_FLAG] = originalAtomicFlag;
    }
    await Promise.all([first.$disconnect(), second.$disconnect()]);
  });

  it('serializes concurrent initial syncs into one complete program', async () => {
    const serviceA = new ProgramSyncService(first);
    const serviceB = new ProgramSyncService(second);
    const programA = program(20, 21);
    const programB = program(25, 26);

    const results = await Promise.allSettled([
      serviceA.syncProgram(deviceId, programA),
      serviceB.syncProgram(deviceId, programB),
    ]);

    const outcomes = results.map((result) => {
      if (result.status === 'fulfilled') return 'fulfilled';
      const reason: unknown = result.reason;
      const code =
        typeof reason === 'object' &&
        reason !== null &&
        'code' in reason &&
        typeof reason.code === 'string'
          ? reason.code
          : 'ERROR';
      const message =
        reason instanceof Error ? reason.message : 'Unknown error';
      return `${code}: ${message}`;
    });
    expect(outcomes).toEqual(['fulfilled', 'fulfilled']);

    const rows = await first.thermostatProgram.findMany({
      where: { deviceId, dayType: DayType.WORKDAY },
      orderBy: { orderIndex: 'asc' },
    });
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((row) => row.programHash)).size).toBe(1);
    expect(rows.every((row) => row.programHash)).toBe(true);

    const actual = rows.map((row) => [row.startMinute, row.targetTemp]);
    expect([
      [
        [0, 20],
        [480, 21],
      ],
      [
        [0, 25],
        [480, 26],
      ],
    ]).toContainEqual(actual);
  });
});

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';

type Query = Record<string, string | number>;

/**
 * FEAT-8 / B-019 stvarni HTTP/JWT/PostgreSQL dokaz.
 *
 * Unit suite već provjerava internu mapu i broj upita s lažnom bazom. Ovdje se
 * dokazuje da stvarna relacijska owner pravila i device lookup daju isti ugovor.
 * Nema vanjskih providera, produkcijskih podataka ni promjene bucket flaga.
 */
describe('Integration: FEAT-8 dashboard heating events', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerId: number;
  let otherId: number;
  let ownerProfileId: number;
  let otherProfileId: number;
  let ownerDeviceAId: number;
  let ownerDeviceBId: number;
  let otherDeviceId: number;
  let ownerToken: string;
  let otherToken: string;
  const suffix = randomUUID();
  const userIds: number[] = [];
  const profileIds: number[] = [];
  const deviceIds: number[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
    prisma = moduleRef.get(PrismaService);
    const jwt = moduleRef.get(JwtService);

    const owner = await prisma.user.create({
      data: {
        email: `feat8-owner-${suffix}@example.test`,
        username: `feat8-owner-${suffix}`,
        passwordHash: 'synthetic-not-a-real-hash',
      },
    });
    const other = await prisma.user.create({
      data: {
        email: `feat8-other-${suffix}@example.test`,
        username: `feat8-other-${suffix}`,
        passwordHash: 'synthetic-not-a-real-hash',
      },
    });
    ownerId = owner.id;
    otherId = other.id;
    userIds.push(ownerId, otherId);
    ownerToken = jwt.sign({ userId: ownerId });
    otherToken = jwt.sign({ userId: otherId });

    const profileData = {
      floorArea: 120,
      ceilingHeight: 2.5,
      insulationType: 'EPS' as const,
      insulationThickness: 10,
      windowType: 'DOUBLE_GLAZED' as const,
      heatingType: 'RADIATOR' as const,
      constructionYear: 2020,
    };
    const ownerProfile = await prisma.homeProfile.create({
      data: { ...profileData, userId: ownerId },
    });
    const otherProfile = await prisma.homeProfile.create({
      data: { ...profileData, userId: otherId },
    });
    ownerProfileId = ownerProfile.id;
    otherProfileId = otherProfile.id;
    profileIds.push(ownerProfileId, otherProfileId);

    const ownerDeviceA = await prisma.thermostatDevice.create({
      data: {
        userId: ownerId,
        homeProfileId: ownerProfileId,
        vendor: 'tuya',
        deviceId: `feat8-owner-a-${suffix}`,
        roomCurrentTemp: 25,
        roomTargetTemp: 26,
      },
    });
    const ownerDeviceB = await prisma.thermostatDevice.create({
      data: {
        userId: ownerId,
        homeProfileId: ownerProfileId,
        vendor: 'tuya',
        deviceId: `feat8-owner-b-${suffix}`,
        roomCurrentTemp: 0,
        roomTargetTemp: 19,
      },
    });
    const otherDevice = await prisma.thermostatDevice.create({
      data: {
        userId: otherId,
        homeProfileId: otherProfileId,
        vendor: 'tuya',
        deviceId: `feat8-other-${suffix}`,
        roomCurrentTemp: 99,
        roomTargetTemp: 100,
      },
    });
    ownerDeviceAId = ownerDeviceA.id;
    ownerDeviceBId = ownerDeviceB.id;
    otherDeviceId = otherDevice.id;
    deviceIds.push(ownerDeviceAId, ownerDeviceBId, otherDeviceId);

    await prisma.heatingEvent.createMany({
      data: [
        {
          deviceId: ownerDeviceAId,
          source: 'feat8-integration',
          hvacAction: 'heating',
          timestampStart: new Date('2026-01-01T10:00:00.000Z'),
          timestampEnd: new Date('2026-01-01T10:30:00.000Z'),
          roomCurrentTemp: 20,
          roomTargetTemp: 22,
        },
        {
          deviceId: ownerDeviceBId,
          source: 'feat8-integration',
          hvacAction: 'heating',
          timestampStart: new Date('2026-01-02T10:00:00.000Z'),
          timestampEnd: new Date('2026-01-02T10:45:00.000Z'),
          roomCurrentTemp: 18,
          roomTargetTemp: 20,
        },
        {
          deviceId: otherDeviceId,
          source: 'feat8-integration',
          hvacAction: 'heating',
          timestampStart: new Date('2026-01-03T10:00:00.000Z'),
          timestampEnd: new Date('2026-01-03T11:00:00.000Z'),
          roomCurrentTemp: 99,
          roomTargetTemp: 99,
        },
      ],
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    if (prisma) {
      if (deviceIds.length) {
        await prisma.heatingEvent.deleteMany({
          where: { deviceId: { in: deviceIds } },
        });
        await prisma.thermostatDevice.deleteMany({
          where: { id: { in: deviceIds } },
        });
      }
      if (profileIds.length) {
        await prisma.homeProfile.deleteMany({
          where: { id: { in: profileIds } },
        });
      }
      if (userIds.length) {
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      }
      await prisma.$disconnect();
    }
    await app?.close();
  });

  const rangeQuery = (extra: Query = {}): Query => ({
    from: '2026-01-01T00:00:00.000Z',
    to: '2026-01-04T00:00:00.000Z',
    ...extra,
  });

  const ownerQuery = (extra: Query = {}): Query =>
    rangeQuery({ homeProfileId: ownerProfileId, ...extra });

  const getEvents = (query: Query, token?: string) => {
    const pending = request(app.getHttpServer())
      .get('/api/dashboard/heating-events')
      .query(query);
    return token ? pending.set('Authorization', `Bearer ${token}`) : pending;
  };

  it('zahtijeva JWT za heating-events', async () => {
    const response = await getEvents(ownerQuery());
    expect(response.status).toBe(401);
  });

  it('vlasnik dobija live vrijednosti svakog uređaja kroz jedan owner upit', async () => {
    const findMany = jest.spyOn(prisma.thermostatDevice, 'findMany');

    const response = await getEvents(ownerQuery(), ownerToken);

    expect(response.status).toBe(200);
    expect(response.body.meta).toEqual({ page: 1, limit: 20, total: 2 });
    expect(response.body.data).toHaveLength(2);
    expect(
      response.body.data.map((row: { deviceId: number }) => row.deviceId),
    ).not.toContain(otherDeviceId);

    const byDevice = new Map<number, any>(
      response.body.data.map((row: any): [number, any] => [row.deviceId, row]),
    );
    const deviceA = byDevice.get(ownerDeviceAId);
    const deviceB = byDevice.get(ownerDeviceBId);

    expect(deviceA).toMatchObject({
      currentTemp: 20,
      targetTemp: 22,
      curretTempThermostat: 25,
      targetTempThermostat: 26,
      durationMinutes: 30,
    });
    expect(deviceB).toMatchObject({
      currentTemp: 18,
      targetTemp: 20,
      curretTempThermostat: 0,
      targetTempThermostat: 19,
      durationMinutes: 45,
    });
    expect(deviceA).toHaveProperty('curretTempThermostat');
    expect(deviceA).toHaveProperty('targetTempThermostat');

    expect(findMany).toHaveBeenCalledTimes(1);
    const args = findMany.mock.calls[0]?.[0];
    const where = args?.where as unknown as
      | {
          homeProfile?: { userId?: number };
          id?: { in?: number[] };
        }
      | undefined;
    expect(where?.homeProfile).toEqual({ userId: ownerId });
    expect([...(where?.id?.in ?? [])].sort((a, b) => a - b)).toEqual(
      [ownerDeviceAId, ownerDeviceBId].sort((a, b) => a - b),
    );
  });

  it('ne otkriva tuđi događaj i foreign/missing filter je isti prazan odgovor', async () => {
    const other = await getEvents(
      rangeQuery({ homeProfileId: otherProfileId }),
      otherToken,
    );
    expect(other.status).toBe(200);
    expect(other.body.data).toHaveLength(1);
    expect(other.body.data[0]).toMatchObject({
      deviceId: otherDeviceId,
      currentTemp: 99,
      curretTempThermostat: 99,
      targetTempThermostat: 100,
    });

    const foreign = await getEvents(
      rangeQuery({ deviceId: otherDeviceId }),
      ownerToken,
    );
    const missing = await getEvents(
      rangeQuery({ deviceId: 2147483647 }),
      ownerToken,
    );
    expect(foreign.status).toBe(200);
    expect(missing.status).toBe(200);
    expect(foreign.body).toEqual(missing.body);
    expect(foreign.body).toEqual({
      data: [],
      meta: { page: 1, limit: 20, total: 0 },
    });
  });

  it('prazna stranica ne poziva thermostatDevice.findMany', async () => {
    const findMany = jest.spyOn(prisma.thermostatDevice, 'findMany');

    const response = await getEvents(
      ownerQuery({ page: 2, limit: 2 }),
      ownerToken,
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: [],
      meta: { page: 2, limit: 2, total: 2 },
    });
    expect(findMany).not.toHaveBeenCalled();
  });
});

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { HeatingRecommendationService } from '../../src/modules/HeatingRecommendation/heating.recommendation.service';

/**
 * SEC-2 / B-009/B-010 stvarni HTTP/JWT/Prisma/PostgreSQL dokaz.
 *
 * Recommendation je mockan samo na DI boundaryju. Owner scope, DTO/pipe,
 * controller, anomaly servis i baza ostaju stvarni; nema uređajnih komandi.
 */
describe('Integration: SEC-2 anomaly ownership and validation', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerId: number;
  let otherId: number;
  let ownerToken: string;
  let otherToken: string;
  let ownerDeviceId: number;
  let eventId: number;
  const processHeatingEvent = jest.fn();
  const suffix = randomUUID();
  const userIds: number[] = [];
  const profileIds: number[] = [];
  const deviceIds: number[] = [];
  const missingId = 2_000_000_000;
  const proposedEndTime = new Date('2026-01-01T12:00:00Z');

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(HeatingRecommendationService)
      .useValue({ processHeatingEvent })
      .compile();
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
        email: `sec2-owner-${suffix}@example.test`,
        username: `sec2-owner-${suffix}`,
        passwordHash: 'synthetic-not-a-real-hash',
      },
    });
    const other = await prisma.user.create({
      data: {
        email: `sec2-other-${suffix}@example.test`,
        username: `sec2-other-${suffix}`,
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
    profileIds.push(ownerProfile.id, otherProfile.id);

    const ownerDevice = await prisma.thermostatDevice.create({
      data: {
        userId: ownerId,
        homeProfileId: ownerProfile.id,
        vendor: 'tuya',
        deviceId: `sec2-owner-${suffix}`,
      },
    });
    const otherDevice = await prisma.thermostatDevice.create({
      data: {
        userId: otherId,
        homeProfileId: otherProfile.id,
        vendor: 'tuya',
        deviceId: `sec2-other-${suffix}`,
      },
    });
    ownerDeviceId = ownerDevice.id;
    deviceIds.push(ownerDevice.id, otherDevice.id);

    const event = await prisma.heatingEvent.create({
      data: {
        deviceId: ownerDeviceId,
        source: 'sec2-integration',
        hvacAction: 'heating',
        timestampStart: new Date('2026-01-01T10:00:00Z'),
        timestampEnd: null,
        proposedEndTime,
        roomCurrentTemp: 21,
        roomTargetTemp: 23,
        isAnomaly: true,
      },
    });
    eventId = event.id;
  });

  beforeEach(async () => {
    processHeatingEvent.mockReset();
    processHeatingEvent.mockResolvedValue(undefined);
    await prisma.heatingEvent.updateMany({
      where: { id: eventId },
      data: {
        isAnomaly: true,
        timestampEnd: null,
        proposedEndTime,
      },
    });
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
        await prisma.recommendation.deleteMany({
          where: { userId: { in: userIds } },
        });
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      }
      await prisma.$disconnect();
    }
    await app?.close();
  });

  const patchAnomaly = (id: number | string, token?: string) => {
    const pending = request(app.getHttpServer()).patch(`/api/anomalies/${id}`);
    return token ? pending.set('Authorization', `Bearer ${token}`) : pending;
  };

  const expectEventUnchanged = async () => {
    const stored = await prisma.heatingEvent.findUnique({
      where: { id: eventId },
    });
    expect(stored).toMatchObject({ isAnomaly: true, timestampEnd: null });
    expect(stored?.proposedEndTime?.toISOString()).toBe(
      proposedEndTime.toISOString(),
    );
    expect(processHeatingEvent).not.toHaveBeenCalled();
  };

  it('anonymous dobija 401 bez DB ili recommendation side effecta', async () => {
    const response = await patchAnomaly(eventId).send({ confirm: true });

    expect(response.status).toBe(401);
    await expectEventUnchanged();
  });

  it('owner confirm zatvara vlastitu anomaliju i poziva recommendation jednom', async () => {
    const response = await patchAnomaly(eventId, ownerToken).send({
      confirm: true,
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      eventId,
      timestampEnd: proposedEndTime.toISOString(),
    });
    const stored = await prisma.heatingEvent.findUnique({
      where: { id: eventId },
    });
    expect(stored).toMatchObject({ isAnomaly: false, proposedEndTime: null });
    expect(stored?.timestampEnd?.toISOString()).toBe(
      proposedEndTime.toISOString(),
    );
    expect(processHeatingEvent).toHaveBeenCalledTimes(1);
    expect(processHeatingEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: ownerId,
        deviceId: ownerDeviceId,
        timestampEnd: proposedEndTime,
        roomCurrentTemp: 21,
        roomTargetTemp: 23,
      }),
    );
  });

  it('owner ISO proposedEndTime prolazi pipe i upisuje tačan datum', async () => {
    const customEnd = '2026-01-02T13:30:00.000Z';
    const response = await patchAnomaly(eventId, ownerToken).send({
      proposedEndTime: customEnd,
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      eventId,
      timestampEnd: customEnd,
    });
    const stored = await prisma.heatingEvent.findUnique({
      where: { id: eventId },
    });
    expect(stored?.timestampEnd?.toISOString()).toBe(customEnd);
    expect(stored?.isAnomaly).toBe(false);
    expect(processHeatingEvent).toHaveBeenCalledTimes(1);
  });

  it('numerički proposedEndTime daje 400 bez DB ili recommendation side effecta', async () => {
    const response = await patchAnomaly(eventId, ownerToken).send({
      proposedEndTime: 0,
    });

    expect(response.status).toBe(400);
    await expectEventUnchanged();
  });

  it('owner prazan body zadržava postojeću potvrdu predloženog vremena', async () => {
    const response = await patchAnomaly(eventId, ownerToken).send({});

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      eventId,
      timestampEnd: proposedEndTime.toISOString(),
    });
    const stored = await prisma.heatingEvent.findUnique({
      where: { id: eventId },
    });
    expect(stored?.timestampEnd?.toISOString()).toBe(
      proposedEndTime.toISOString(),
    );
    expect(stored?.isAnomaly).toBe(false);
  });

  it('foreign i missing daju identičan odgovor bez izmjene ili recommendationa', async () => {
    expect(await prisma.heatingEvent.count({ where: { id: missingId } })).toBe(
      0,
    );

    const foreign = await patchAnomaly(eventId, otherToken).send({
      confirm: true,
    });
    const missing = await patchAnomaly(missingId, otherToken).send({
      confirm: true,
    });

    expect(foreign.status).toBe(200);
    expect(missing.status).toBe(200);
    expect(foreign.body).toEqual({ success: false, error: 'Event not found' });
    expect(missing.body).toEqual(foreign.body);
    await expectEventUnchanged();
  });

  it('malformed datum i podvaljeno userId polje daju 400 bez side effecta', async () => {
    const malformed = await patchAnomaly(eventId, ownerToken).send({
      proposedEndTime: 'not-a-date',
    });
    const injected = await patchAnomaly(eventId, ownerToken).send({
      confirm: true,
      userId: otherId,
    });

    expect(malformed.status).toBe(400);
    expect(injected.status).toBe(400);
    await expectEventUnchanged();
  });

  it('nevažeći eventId daje 400 prije DB upita', async () => {
    const findFirst = jest.spyOn(prisma.heatingEvent, 'findFirst');
    try {
      const response = await patchAnomaly('not-a-number', ownerToken).send({
        confirm: true,
      });

      expect(response.status).toBe(400);
      expect(findFirst).not.toHaveBeenCalled();
      await expectEventUnchanged();
    } finally {
      findFirst.mockRestore();
    }
  });
});

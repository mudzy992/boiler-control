import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { GasReminderService } from '../../src/modules/Schedule/gas.reminder.service';
import { ExpoPushService } from '../../src/modules/ExpoPush/expo.push.notification.service';

/**
 * SEC-1 / B-006, SEC-3 / B-007 i S-002 stvarni HTTP/JWT/Prisma/PostgreSQL dokaz.
 *
 * Produkcijski izvor već radi atomski updateMany po id+userId i ima admin
 * RolesGuard. GasReminderService i ExpoPushService su mockani samo na DI
 * boundaryju, pa nijedan scenario ne šalje stvarne notifikacije.
 */
describe('Integration: notification authorization (SEC-1/SEC-3)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerId: number;
  let otherId: number;
  let adminId: number;
  let ownerToken: string;
  let otherToken: string;
  let adminToken: string;
  let notificationId: number;
  const triggerDailyReminders = jest.fn();
  const sendPushToTokens = jest.fn();
  const suffix = randomUUID();
  const userIds: number[] = [];
  const missingId = 2_000_000_000;
  // Različit tip od SEC-1 fixturea sprječava da postojeći debounce potisne
  // pozitivnu manual kontrolu; beforeEach uklanja samo prethodne S-002 redove.
  const validManualBody = () => ({
    type: 'GAS_READING_REMINDER',
    title: 'S-002 synthetic manual title',
    message: 'S-002 synthetic manual message',
    data: { type: 'GAS_READING_REMINDER', marker: 's002-manual' },
  });
  const withoutManualField = (field: string) => {
    const body: Record<string, unknown> = validManualBody();
    delete body[field];
    return body;
  };
  const validPreferenceBody = () => ({
    type: 'HEATING_STARTED',
    enabled: true,
  });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(GasReminderService)
      .useValue({ triggerDailyReminders })
      .overrideProvider(ExpoPushService)
      .useValue({ sendPushToTokens })
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
        email: `sec1-owner-${suffix}@example.test`,
        username: `sec1-owner-${suffix}`,
        passwordHash: 'synthetic-not-a-real-hash',
      },
    });
    const other = await prisma.user.create({
      data: {
        email: `sec1-other-${suffix}@example.test`,
        username: `sec1-other-${suffix}`,
        passwordHash: 'synthetic-not-a-real-hash',
      },
    });
    const admin = await prisma.user.create({
      data: {
        email: `sec3-admin-${suffix}@example.test`,
        username: `sec3-admin-${suffix}`,
        passwordHash: 'synthetic-not-a-real-hash',
        role: 'ADMIN',
      },
    });
    ownerId = owner.id;
    otherId = other.id;
    adminId = admin.id;
    userIds.push(ownerId, otherId, adminId);
    ownerToken = jwt.sign({ userId: ownerId });
    otherToken = jwt.sign({ userId: otherId });
    adminToken = jwt.sign({ userId: adminId });

    const notification = await prisma.notification.create({
      data: {
        userId: ownerId,
        type: 'SYSTEM_ALERT',
        title: 'SEC-1 synthetic owner title',
        message: 'SEC-1 synthetic owner message',
        data: { marker: 'owner-only' },
        sourceRef: `sec1-${suffix}`,
        isRead: false,
      },
    });
    notificationId = notification.id;
    await prisma.userDevice.create({
      data: {
        userId: ownerId,
        platform: 'android',
        expoPushToken: `ExponentPushToken[s002${suffix.replace(/-/g, '')}]`,
      },
    });
  });

  beforeEach(async () => {
    triggerDailyReminders.mockReset();
    triggerDailyReminders.mockResolvedValue({ accepted: true });
    sendPushToTokens.mockReset();
    sendPushToTokens.mockResolvedValue(undefined);
    await prisma.notification.deleteMany({
      where: { userId: ownerId, title: { startsWith: 'S-002' } },
    });
    await prisma.notificationPreference.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.notification.updateMany({
      where: { id: notificationId, userId: ownerId },
      data: { isRead: false },
    });
  });

  afterAll(async () => {
    if (prisma) {
      if (userIds.length) {
        await prisma.notification.deleteMany({
          where: { userId: { in: userIds } },
        });
        await prisma.userDevice.deleteMany({
          where: { userId: { in: userIds } },
        });
        await prisma.notificationPreference.deleteMany({
          where: { userId: { in: userIds } },
        });
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      }
      await prisma.$disconnect();
    }
    await app?.close();
  });

  const markAsRead = (id: number, token?: string) => {
    const pending = request(app.getHttpServer()).post(
      `/api/notifications/${id}/read`,
    );
    return token ? pending.set('Authorization', `Bearer ${token}`) : pending;
  };

  const sendManual = (body: Record<string, unknown>, token?: string) => {
    const pending = request(app.getHttpServer())
      .post('/api/notifications/manual')
      .send(body);
    return token ? pending.set('Authorization', `Bearer ${token}`) : pending;
  };

  const updatePreference = (body: Record<string, unknown>, token?: string) => {
    const pending = request(app.getHttpServer())
      .patch('/api/notifications/preferences')
      .send(body);
    return token ? pending.set('Authorization', `Bearer ${token}`) : pending;
  };

  it('anonimni zahtjev dobija 401 i ne mijenja notifikaciju', async () => {
    const response = await markAsRead(notificationId);

    expect(response.status).toBe(401);
    const stored = await prisma.notification.findUnique({
      where: { id: notificationId },
    });
    expect(stored?.isRead).toBe(false);
  });

  it('vlasnik dobija postojeći response, a baza čuva isRead=true', async () => {
    const response = await markAsRead(notificationId, ownerToken);

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      id: notificationId,
      userId: ownerId,
      type: 'SYSTEM_ALERT',
      title: 'SEC-1 synthetic owner title',
      message: 'SEC-1 synthetic owner message',
      data: { marker: 'owner-only' },
      isRead: true,
    });
    const stored = await prisma.notification.findUnique({
      where: { id: notificationId },
    });
    expect(stored?.isRead).toBe(true);
  });

  it('foreign i missing daju identičan 404 bez curenja ili side effecta', async () => {
    expect(await prisma.notification.count({ where: { id: missingId } })).toBe(
      0,
    );

    const foreign = await markAsRead(notificationId, otherToken);
    const missing = await markAsRead(missingId, otherToken);
    const expectedBody = {
      statusCode: 404,
      message: 'Notification not found',
      error: 'Not Found',
    };

    expect(foreign.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(foreign.body).toEqual(expectedBody);
    expect(missing.body).toEqual(expectedBody);
    expect(foreign.text).not.toContain('SEC-1 synthetic owner');
    expect(foreign.text).not.toContain('owner-only');

    const stored = await prisma.notification.findUnique({
      where: { id: notificationId },
    });
    expect(stored).toMatchObject({
      userId: ownerId,
      title: 'SEC-1 synthetic owner title',
      message: 'SEC-1 synthetic owner message',
      data: { marker: 'owner-only' },
      isRead: false,
    });
  });

  it('SEC-3 anonymous i USER ne mogu pokrenuti masovni reminder', async () => {
    const endpoint = '/api/notifications/test-trigger-all-gas-reminders';
    const anonymous = await request(app.getHttpServer()).post(endpoint);
    const ordinaryUser = await request(app.getHttpServer())
      .post(endpoint)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(anonymous.status).toBe(401);
    expect(ordinaryUser.status).toBe(403);
    expect(triggerDailyReminders).not.toHaveBeenCalled();
  });

  it('SEC-3 ADMIN prolazi i poziva mock reminder tačno jednom', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/notifications/test-trigger-all-gas-reminders')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ accepted: true });
    expect(triggerDailyReminders).toHaveBeenCalledTimes(1);
  });

  it('S-002 anonymous manual zahtjev dobija 401 bez push ili DB upisa', async () => {
    const before = await prisma.notification.count({
      where: { userId: ownerId },
    });

    const response = await sendManual(validManualBody());

    expect(response.status).toBe(401);
    expect(sendPushToTokens).not.toHaveBeenCalled();
    expect(
      await prisma.notification.count({ where: { userId: ownerId } }),
    ).toBe(before);
  });

  it('S-002 validan manual oblik zadržava response i upisuje JWT vlasniku', async () => {
    const body = validManualBody();

    const response = await sendManual(body, ownerToken);

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      success: true,
      message: 'Notification sent manually',
    });
    expect(sendPushToTokens).toHaveBeenCalledWith(
      [expect.stringMatching(/^ExponentPushToken\[s002/)],
      body.title,
      body.message,
      body.data,
    );
    const stored = await prisma.notification.findFirst({
      where: { userId: ownerId, title: body.title },
    });
    expect(stored).toMatchObject({
      userId: ownerId,
      type: body.type,
      title: body.title,
      message: body.message,
      data: body.data,
    });
  });

  it('S-002 redundantni userId ne može preusmjeriti notifikaciju drugome', async () => {
    const otherBefore = await prisma.notification.count({
      where: { userId: otherId },
    });
    const body = {
      ...validManualBody(),
      title: 'S-002 JWT owner title',
      userId: otherId,
    };

    const response = await sendManual(body, ownerToken);

    expect(response.status).toBe(201);
    const stored = await prisma.notification.findFirst({
      where: { title: body.title },
    });
    expect(stored).toMatchObject({ userId: ownerId, title: body.title });
    expect(
      await prisma.notification.count({ where: { userId: otherId } }),
    ).toBe(otherBefore);
  });

  it.each<[string, Record<string, unknown>]>([
    ['nepoznat type', { ...validManualBody(), type: 'NOT_A_TYPE' }],
    ['nedostaje type', withoutManualField('type')],
    ['nedostaje title', withoutManualField('title')],
    ['title nije string', { ...validManualBody(), title: 42 }],
    ['nedostaje message', withoutManualField('message')],
    [
      'message nije string',
      { ...validManualBody(), message: { text: 'invalid' } },
    ],
    [
      'neočekivano polje',
      { ...validManualBody(), unexpected: 'must-be-rejected' },
    ],
  ])('S-002 odbija %s bez push ili DB upisa', async (_name, body) => {
    const before = await prisma.notification.count({
      where: { userId: ownerId },
    });

    const response = await sendManual(body, ownerToken);

    expect(response.status).toBe(400);
    expect(sendPushToTokens).not.toHaveBeenCalled();
    expect(
      await prisma.notification.count({ where: { userId: ownerId } }),
    ).toBe(before);
  });

  it('S-002 anonymous preferences zahtjev dobija 401 bez DB upisa', async () => {
    const before = await prisma.notificationPreference.count({
      where: { userId: { in: [ownerId, otherId] } },
    });

    const response = await updatePreference(validPreferenceBody());

    expect(response.status).toBe(401);
    expect(
      await prisma.notificationPreference.count({
        where: { userId: { in: [ownerId, otherId] } },
      }),
    ).toBe(before);
  });

  it('S-002 validne preferences zadržavaju response i JWT owner upsert', async () => {
    const enabled = await updatePreference(validPreferenceBody(), ownerToken);

    expect(enabled.status).toBe(200);
    expect(enabled.body).toMatchObject({
      userId: ownerId,
      type: 'HEATING_STARTED',
      enabled: true,
    });

    const disabled = await updatePreference(
      { ...validPreferenceBody(), enabled: false },
      ownerToken,
    );
    expect(disabled.status).toBe(200);
    expect(disabled.body).toMatchObject({
      userId: ownerId,
      type: 'HEATING_STARTED',
      enabled: false,
    });

    const stored = await prisma.notificationPreference.findMany({
      where: { userId: ownerId },
    });
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      userId: ownerId,
      type: 'HEATING_STARTED',
      enabled: false,
    });
    expect(
      await prisma.notificationPreference.count({
        where: { userId: otherId },
      }),
    ).toBe(0);
  });

  it.each<[string, Record<string, unknown>]>([
    ['nepoznat type', { ...validPreferenceBody(), type: 'NOT_A_TYPE' }],
    ['type nije string', { ...validPreferenceBody(), type: 42 }],
    ['nedostaje type', { enabled: true }],
    ['nedostaje enabled', { type: 'HEATING_STARTED' }],
    ['enabled je string false', { ...validPreferenceBody(), enabled: 'false' }],
    ['enabled je broj', { ...validPreferenceBody(), enabled: 0 }],
    [
      'enabled je objekt',
      { ...validPreferenceBody(), enabled: { value: false } },
    ],
    [
      'neočekivano polje',
      { ...validPreferenceBody(), unexpected: 'must-be-rejected' },
    ],
  ])('S-002 odbija preferences: %s bez DB upisa', async (_name, body) => {
    const before = await prisma.notificationPreference.count({
      where: { userId: { in: [ownerId, otherId] } },
    });

    const response = await updatePreference(body, ownerToken);

    expect(response.status).toBe(400);
    expect(
      await prisma.notificationPreference.count({
        where: { userId: { in: [ownerId, otherId] } },
      }),
    ).toBe(before);
  });
});

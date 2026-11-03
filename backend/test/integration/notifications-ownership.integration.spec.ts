import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { GasReminderService } from '../../src/modules/Schedule/gas.reminder.service';

/**
 * SEC-1 / B-006 i SEC-3 / B-007 stvarni HTTP/JWT/Prisma/PostgreSQL dokaz.
 *
 * Produkcijski izvor već radi atomski updateMany po id+userId i ima admin
 * RolesGuard. Ovaj spec ne mijenja ugovor. GasReminderService je mockan samo
 * na DI boundaryju, pa admin pozitivna kontrola ne šalje stvarne notifikacije.
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
  const suffix = randomUUID();
  const userIds: number[] = [];
  const missingId = 2_000_000_000;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(GasReminderService)
      .useValue({ triggerDailyReminders })
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
  });

  beforeEach(async () => {
    triggerDailyReminders.mockReset();
    triggerDailyReminders.mockResolvedValue({ accepted: true });
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
});

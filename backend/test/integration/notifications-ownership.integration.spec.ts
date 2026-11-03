import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';

/**
 * SEC-1 / B-006 stvarni HTTP/JWT/Prisma/PostgreSQL dokaz.
 *
 * Produkcijski izvor već radi atomski updateMany po id+userId. Ovaj spec ne
 * mijenja ugovor: dokazuje owner uspjeh, identičan foreign/missing 404 i da
 * odbijeni zahtjevi ne mijenjaju zapis niti vraćaju njegov sadržaj.
 */
describe('Integration: SEC-1 notification ownership', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerId: number;
  let otherId: number;
  let ownerToken: string;
  let otherToken: string;
  let notificationId: number;
  const suffix = randomUUID();
  const userIds: number[] = [];
  const missingId = 2_000_000_000;

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
    ownerId = owner.id;
    otherId = other.id;
    userIds.push(ownerId, otherId);
    ownerToken = jwt.sign({ userId: ownerId });
    otherToken = jwt.sign({ userId: otherId });

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
});

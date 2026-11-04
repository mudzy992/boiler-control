import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';

const CURRENT_PASSWORD = 'integration-current-profile-secret';
const NEW_PASSWORD = 'integration-new-profile-secret';

describe('Integration: PUT /api/user password potvrda (S-003)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userId: number;
  let token: string;

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
    const suffix = randomUUID();
    const user = await prisma.user.create({
      data: {
        email: `s003-${suffix}@example.test`,
        username: `s003-${suffix}`,
        name: 'Prije promjene',
        passwordHash: await bcrypt.hash(CURRENT_PASSWORD, 4),
      },
    });
    userId = user.id;
    token = jwt.sign({ userId });
  });

  beforeEach(async () => {
    await prisma.user.update({
      where: { id: userId },
      data: {
        name: 'Prije promjene',
        passwordHash: await bcrypt.hash(CURRENT_PASSWORD, 4),
      },
    });
  });

  afterAll(async () => {
    if (prisma && userId) {
      await prisma.user.deleteMany({ where: { id: userId } });
    }
    if (app) await app.close();
    if (prisma) await prisma.$disconnect();
  });

  const putProfile = (body: Record<string, unknown>) =>
    request(app.getHttpServer())
      .put('/api/user')
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  const expectUnchanged = async () => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { name: true, passwordHash: true },
    });
    expect(user.name).toBe('Prije promjene');
    expect(await bcrypt.compare(CURRENT_PASSWORD, user.passwordHash)).toBe(
      true,
    );
  };

  it('password bez currentPassword vraća 400 i ne mijenja bazu', async () => {
    const response = await putProfile({
      name: 'Ne smije se sačuvati',
      password: NEW_PASSWORD,
    });

    expect(response.status).toBe(400);
    await expectUnchanged();
  });

  it('netačan currentPassword vraća 401 i ne mijenja bazu', async () => {
    const response = await putProfile({
      name: 'Ne smije se sačuvati',
      currentPassword: 'integration-wrong-profile-secret',
      password: NEW_PASSWORD,
    });

    expect(response.status).toBe(401);
    await expectUnchanged();
  });

  it('tačan currentPassword zadržava 200 i stvarno mijenja bcrypt hash', async () => {
    const response = await putProfile({
      name: 'Nakon promjene',
      currentPassword: CURRENT_PASSWORD,
      password: NEW_PASSWORD,
    });

    expect(response.status).toBe(200);
    expect(response.body.name).toBe('Nakon promjene');
    expect(response.body).not.toHaveProperty('password');
    expect(response.body).not.toHaveProperty('currentPassword');
    expect(response.body).not.toHaveProperty('passwordHash');
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { name: true, passwordHash: true },
    });
    expect(user.name).toBe('Nakon promjene');
    expect(await bcrypt.compare(NEW_PASSWORD, user.passwordHash)).toBe(true);
  });

  it('profilni update bez password polja zadržava postojeći hash', async () => {
    const response = await putProfile({ name: 'Samo profil' });

    expect(response.status).toBe(200);
    expect(response.body.name).toBe('Samo profil');
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { name: true, passwordHash: true },
    });
    expect(user.name).toBe('Samo profil');
    expect(await bcrypt.compare(CURRENT_PASSWORD, user.passwordHash)).toBe(
      true,
    );
  });
});

import {
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { PrismaService } from '../../../prisma/prisma.service';
import { AccountExportService } from '../account-export.service';
import { AuthController } from '../auth.controller';
import { AuthService } from '../auth.service';
import { JwtAuthGuard } from '../jwt-auth.guard';
import { RefreshTokenService } from '../refresh-token.service';

describe('Auth refresh/logout HTTP kompatibilnost', () => {
  let app: INestApplication;
  let savedFlag: string | undefined;
  const rotate = jest.fn();
  const revoke = jest.fn();
  const issueAccessToken = jest.fn();

  beforeAll(async () => {
    savedFlag = process.env.AUTH_COOKIE_REFRESH_ENABLED;
    process.env.AUTH_COOKIE_REFRESH_ENABLED = 'on';

    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: { issueAccessToken } },
        { provide: RefreshTokenService, useValue: { rotate, revoke } },
        { provide: AccountExportService, useValue: {} },
        { provide: PrismaService, useValue: {} },
        { provide: JwtService, useValue: { verify: jest.fn() } },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest<{
            user?: { userId: number };
          }>();
          req.user = { userId: 42 };
          return true;
        },
      })
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
  });

  beforeEach(() => {
    rotate.mockReset();
    revoke.mockReset();
    issueAccessToken.mockReset();
    rotate.mockResolvedValue({
      userId: 42,
      token: 'synthetic-new-refresh',
      expiresAt: new Date(Date.now() + 60_000),
    });
    revoke.mockResolvedValue(undefined);
    issueAccessToken.mockReturnValue('synthetic-access');
  });

  afterAll(async () => {
    await app.close();
    if (savedFlag === undefined) delete process.env.AUTH_COOKIE_REFRESH_ENABLED;
    else process.env.AUTH_COOKIE_REFRESH_ENABLED = savedFlag;
  });

  it('valjan body refresh zadržava response i servisne argumente', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('User-Agent', 'auth-refresh-http-test')
      .send({ refreshToken: 'synthetic-old-refresh' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      token: 'synthetic-access',
      refreshToken: 'synthetic-new-refresh',
    });
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(rotate).toHaveBeenCalledTimes(1);
    expect(rotate).toHaveBeenCalledWith('synthetic-old-refresh', {
      userAgent: 'auth-refresh-http-test',
      ipAddress: expect.any(String),
    });
    expect(issueAccessToken).toHaveBeenCalledWith(42);
  });

  it('valjan body logout zadržava response i servisni argument', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/logout')
      .send({ refreshToken: 'synthetic-logout-refresh' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: 'Logged out' });
    expect(revoke).toHaveBeenCalledTimes(1);
    expect(revoke).toHaveBeenCalledWith('synthetic-logout-refresh');
  });

  it('numerički refreshToken na refreshu vraća 400 prije rotate', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: 123456 });

    expect(response.status).toBe(400);
    expect(rotate).not.toHaveBeenCalled();
    expect(issueAccessToken).not.toHaveBeenCalled();
  });

  it('numerički refreshToken na logoutu vraća 400 prije revoke', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/logout')
      .send({ refreshToken: 123456 });

    expect(response.status).toBe(400);
    expect(revoke).not.toHaveBeenCalled();
  });
});

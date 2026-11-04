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

describe('Auth login HTTP kompatibilnost', () => {
  let app: INestApplication;
  let savedFlag: string | undefined;
  const login = jest.fn();
  const issue = jest.fn();
  const result = {
    user: { id: 7, email: 'user@example.com' },
    token: 'access-token',
  };

  beforeAll(async () => {
    savedFlag = process.env.AUTH_COOKIE_REFRESH_ENABLED;
    process.env.AUTH_COOKIE_REFRESH_ENABLED = 'off';

    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: { login } },
        { provide: RefreshTokenService, useValue: { issue } },
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
    login.mockReset();
    issue.mockReset();
  });

  afterAll(async () => {
    await app.close();
    if (savedFlag === undefined) delete process.env.AUTH_COOKIE_REFRESH_ENABLED;
    else process.env.AUTH_COOKIE_REFRESH_ENABLED = savedFlag;
  });

  describe('POST /api/auth/login body DTO (S-002)', () => {
    it('valjan identifier zadržava normalizaciju, response i mobile payload', async () => {
      login.mockResolvedValue(result);

      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          identifier: '  User@Example.COM  ',
          password: 'current-secret',
          refreshTransport: 'body',
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(result);
      expect(login).toHaveBeenCalledTimes(1);
      expect(login).toHaveBeenCalledWith('user@example.com', 'current-secret');
      expect(issue).not.toHaveBeenCalled();
    });

    it('legacy email zadržava fallback i normalizaciju', async () => {
      login.mockResolvedValue(result);

      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: '  Legacy@Example.COM  ',
          password: 'current-secret',
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(result);
      expect(login).toHaveBeenCalledTimes(1);
      expect(login).toHaveBeenCalledWith(
        'legacy@example.com',
        'current-secret',
      );
      expect(issue).not.toHaveBeenCalled();
    });

    it.each([
      ['identifier', { identifier: 123456, password: 'current-secret' }],
      ['email', { email: 123456, password: 'current-secret' }],
      ['password', { identifier: 'user@example.com', password: 654321 }],
    ])(
      'numerički %s vraća 400 prije servisnog poziva',
      async (_field, body) => {
        login.mockResolvedValue(result);

        const response = await request(app.getHttpServer())
          .post('/api/auth/login')
          .send(body);

        expect(response.status).toBe(400);
        expect(login).not.toHaveBeenCalled();
        expect(issue).not.toHaveBeenCalled();
      },
    );
  });
});

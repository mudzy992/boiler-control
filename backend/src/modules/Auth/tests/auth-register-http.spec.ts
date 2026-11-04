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

describe('Auth register HTTP kompatibilnost', () => {
  let app: INestApplication;
  let savedFlag: string | undefined;
  const register = jest.fn();
  const issue = jest.fn();
  const result = {
    user: { id: 7, email: 'new@example.com', username: 'new_user' },
    token: 'access-token',
  };
  const validBody = {
    email: 'new@example.com',
    username: 'new_user',
    password: 'current-secret',
    name: 'New User',
    homeLocation: 'Sarajevo',
  };

  beforeAll(async () => {
    savedFlag = process.env.AUTH_COOKIE_REFRESH_ENABLED;
    process.env.AUTH_COOKIE_REFRESH_ENABLED = 'off';

    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: { register } },
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
    register.mockReset();
    issue.mockReset();
  });

  afterAll(async () => {
    await app.close();
    if (savedFlag === undefined) delete process.env.AUTH_COOKIE_REFRESH_ENABLED;
    else process.env.AUTH_COOKIE_REFRESH_ENABLED = savedFlag;
  });

  describe('POST /api/auth/register body DTO (S-002)', () => {
    it('valjan payload zadržava response, normalizaciju i servisni argument', async () => {
      register.mockResolvedValue(result);

      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          ...validBody,
          email: '  New@Example.COM  ',
          username: '  New_User  ',
        });

      expect(response.status).toBe(201);
      expect(response.body).toEqual(result);
      expect(register).toHaveBeenCalledTimes(1);
      expect(register).toHaveBeenCalledWith(validBody);
      expect(issue).not.toHaveBeenCalled();
    });

    it.each([
      ['username', { ...validBody, username: 123456 }],
      ['password', { ...validBody, password: 654321 }],
      ['name', { ...validBody, name: 123456 }],
      ['homeLocation', { ...validBody, homeLocation: 123456 }],
    ])(
      'numerički %s vraća 400 prije servisnog poziva',
      async (_field, body) => {
        register.mockResolvedValue(result);

        const response = await request(app.getHttpServer())
          .post('/api/auth/register')
          .send(body);

        expect(response.status).toBe(400);
        expect(register).not.toHaveBeenCalled();
        expect(issue).not.toHaveBeenCalled();
      },
    );
  });
});

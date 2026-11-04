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

describe('Auth change-password HTTP kompatibilnost', () => {
  let app: INestApplication;
  const changePassword = jest.fn();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: { changePassword } },
        { provide: RefreshTokenService, useValue: {} },
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
    changePassword.mockReset();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/auth/change-password body DTO (S-002)', () => {
    it('valjane lozinke zadržavaju response i servisne argumente', async () => {
      const result = { message: 'Password updated successfully' };
      changePassword.mockResolvedValue(result);

      const response = await request(app.getHttpServer())
        .post('/api/auth/change-password')
        .send({
          currentPassword: 'current-secret',
          newPassword: 'new-secret',
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(result);
      expect(changePassword).toHaveBeenCalledTimes(1);
      expect(changePassword).toHaveBeenCalledWith(
        42,
        'current-secret',
        'new-secret',
      );
    });

    it.each([
      [
        'currentPassword',
        { currentPassword: 123456, newPassword: 'new-secret' },
      ],
      [
        'newPassword',
        { currentPassword: 'current-secret', newPassword: 654321 },
      ],
    ])(
      'numerički %s vraća 400 prije servisnog poziva',
      async (_field, body) => {
        changePassword.mockResolvedValue({
          message: 'Password updated successfully',
        });

        const response = await request(app.getHttpServer())
          .post('/api/auth/change-password')
          .send(body);

        expect(response.status).toBe(400);
        expect(changePassword).not.toHaveBeenCalled();
      },
    );
  });
});

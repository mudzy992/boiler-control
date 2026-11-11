import {
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { PrismaService } from '../../../prisma/prisma.service';
import { JwtAuthGuard } from '../../Auth/jwt-auth.guard';
import { UserController } from '../user.controller';
import { UserService } from '../user.service';

describe('User profile HTTP kompatibilnost', () => {
  let app: INestApplication;
  const updateMe = jest.fn();
  const result = {
    id: 42,
    username: 'new_user',
    name: 'New User',
    homeLocation: 'Sarajevo',
  };
  const validBody = {
    name: 'New User',
    username: 'new_user',
    homeLocation: 'Sarajevo',
    avatarUrl: 'https://example.com/avatar.png',
    timezone: 'Europe/Sarajevo',
    locale: 'bs-BA',
  };
  const validScalarBody = {
    ...validBody,
    prefersDarkMode: false,
    gasPriceExVat: 1.25,
    gasPriceEffectiveFrom: '2026-11-04T00:00:00.000Z',
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        { provide: UserService, useValue: { updateMe } },
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
    updateMe.mockReset();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('PUT /api/user profile text DTO (S-002)', () => {
    it('valjani tekst zadržava response, JWT userId i servisni argument', async () => {
      updateMe.mockResolvedValue(result);

      const response = await request(app.getHttpServer())
        .put('/api/user')
        .send({ ...validBody, username: '  New_User  ' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(result);
      expect(updateMe).toHaveBeenCalledTimes(1);
      expect(updateMe).toHaveBeenCalledWith(42, validBody);
    });

    it.each([
      ['name', { ...validBody, name: 123456 }],
      ['username', { ...validBody, username: 123456 }],
      ['homeLocation', { ...validBody, homeLocation: 123456 }],
      ['avatarUrl', { ...validBody, avatarUrl: 123456 }],
      ['timezone', { ...validBody, timezone: 123456 }],
      ['locale', { ...validBody, locale: 123456 }],
    ])(
      'numerički %s vraća 400 prije servisnog poziva',
      async (_field, body) => {
        updateMe.mockResolvedValue(result);

        const response = await request(app.getHttpServer())
          .put('/api/user')
          .send(body);

        expect(response.status).toBe(400);
        expect(updateMe).not.toHaveBeenCalled();
      },
    );
  });

  describe('PUT /api/user profile scalar DTO (S-002)', () => {
    it('valjana scalar polja zadržavaju response i cijeli servisni argument', async () => {
      updateMe.mockResolvedValue(result);

      const response = await request(app.getHttpServer())
        .put('/api/user')
        .send(validScalarBody);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(result);
      expect(updateMe).toHaveBeenCalledTimes(1);
      expect(updateMe).toHaveBeenCalledWith(42, validScalarBody);
    });

    it.each([
      [
        'prefersDarkMode je string false',
        { ...validScalarBody, prefersDarkMode: 'false' },
      ],
      ['prefersDarkMode je broj', { ...validScalarBody, prefersDarkMode: 0 }],
      [
        'gasPriceExVat je string',
        { ...validScalarBody, gasPriceExVat: '1.25' },
      ],
      ['gasPriceExVat je boolean', { ...validScalarBody, gasPriceExVat: true }],
      [
        'gasPriceEffectiveFrom je broj',
        { ...validScalarBody, gasPriceEffectiveFrom: 20261104 },
      ],
    ])('%s vraća 400 prije servisnog poziva', async (_field, body) => {
      updateMe.mockResolvedValue(result);

      const response = await request(app.getHttpServer())
        .put('/api/user')
        .send(body);

      expect(response.status).toBe(400);
      expect(updateMe).not.toHaveBeenCalled();
    });
  });

  describe('PUT /api/user profile password DTO (S-002/S-003)', () => {
    it('valjani password par zadržava response i cijeli servisni argument', async () => {
      const validPasswordBody = {
        ...validBody,
        currentPassword: 'current-secret',
        password: 'new-secret',
      };
      updateMe.mockResolvedValue(result);

      const response = await request(app.getHttpServer())
        .put('/api/user')
        .send(validPasswordBody);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(result);
      expect(updateMe).toHaveBeenCalledTimes(1);
      expect(updateMe).toHaveBeenCalledWith(42, validPasswordBody);
    });

    it('password bez currentPassword vraća 400 prije servisnog poziva', async () => {
      updateMe.mockResolvedValue(result);

      const response = await request(app.getHttpServer())
        .put('/api/user')
        .send({ ...validBody, password: 'new-secret' });

      expect(response.status).toBe(400);
      expect(updateMe).not.toHaveBeenCalled();
    });

    it.each([
      ['numerički password', { ...validBody, password: 123456 }],
      [
        'numerički currentPassword',
        {
          ...validBody,
          currentPassword: 123456,
          password: 'new-secret',
        },
      ],
    ])('%s vraća 400 prije servisnog poziva', async (_field, body) => {
      updateMe.mockResolvedValue(result);

      const response = await request(app.getHttpServer())
        .put('/api/user')
        .send(body);

      expect(response.status).toBe(400);
      expect(updateMe).not.toHaveBeenCalled();
    });
  });

  describe('PUT /api/user — jezik (`32`/`33`)', () => {
    /*
     * `locale` je do sada bio slobodan string, a klijenti su ga slali kao
     * `bs-BS`/`en-US`. Zatečeni zapisi nose i `bs-BA`. Pravilo zato prihvata
     * jezik + opcionu regiju, a odbija sve ostalo — vrijednost koja se sačuva a
     * klijent je ne zna pretvori se u tihi fallback na engleski.
     */
    beforeEach(() => {
      updateMe.mockReset();
      updateMe.mockImplementation(() => Promise.resolve({ id: 42 }));
    });

    it.each(['bs-BS', 'en-US', 'bs', 'en', 'bs-BA'])(
      'prihvata %s',
      async (locale) => {
        const response = await request(app.getHttpServer())
          .put('/api/user')
          .send({ locale });
        expect(response.status).toBe(200);
        expect(updateMe).toHaveBeenCalledWith(
          42,
          expect.objectContaining({ locale }),
        );
      },
    );

    it.each(['fr-FR', 'bosanski', 'BS', 'bs-BSX'])(
      'odbija %s',
      async (locale) => {
        const response = await request(app.getHttpServer())
          .put('/api/user')
          .send({ locale });
        expect(response.status).toBe(400);
        expect(updateMe).not.toHaveBeenCalled();
      },
    );
  });
});

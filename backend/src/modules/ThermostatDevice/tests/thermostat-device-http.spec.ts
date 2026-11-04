jest.mock('../../../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));
import {
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JwtAuthGuard } from '../../Auth/jwt-auth.guard';
import { ThermostatDeviceController } from '../thermostat.device.controller';
import { ThermostatDeviceService } from '../thermostat.device.service';

describe('ThermostatDevice controller HTTP kompatibilnost', () => {
  let app: INestApplication;
  const create = jest.fn();
  const findOne = jest.fn();
  const getPrograms = jest.fn();
  const update = jest.fn();
  const remove = jest.fn();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ThermostatDeviceController],
      providers: [
        {
          provide: ThermostatDeviceService,
          useValue: { create, findOne, getPrograms, update, remove },
        },
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
    create.mockReset();
    findOne.mockReset();
    getPrograms.mockReset();
    update.mockReset();
    remove.mockReset();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/devices body DTO (S-002)', () => {
    const validBody = {
      vendor: 'tuya',
      deviceId: 'tuya-17',
      alias: 'Dnevna soba',
      mode: 'PROGRAM',
      homeProfileId: 7,
    };

    it('valjan create zadržava 201, response, JWT userId i servisni argument', async () => {
      const device = { id: 17, userId: 42, ...validBody };
      create.mockResolvedValue(device);

      const response = await request(app.getHttpServer())
        .post('/api/devices')
        .send(validBody);

      expect(response.status).toBe(201);
      expect(response.body).toEqual(device);
      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith(42, validBody);
    });

    it.each([
      ['vendor', { ...validBody, vendor: 123456 }],
      ['deviceId', { ...validBody, deviceId: 123456 }],
      ['alias', { ...validBody, alias: 123456 }],
      ['homeProfileId', { ...validBody, homeProfileId: '7' }],
    ])(
      '%s s pogrešnim raw tipom vraća 400 prije servisa',
      async (_field, body) => {
        create.mockResolvedValue({ id: 17, userId: 42 });

        const response = await request(app.getHttpServer())
          .post('/api/devices')
          .send(body);

        expect(response.status).toBe(400);
        expect(create).not.toHaveBeenCalled();
      },
    );
  });

  describe('GET /api/devices/:id path ID (S-002)', () => {
    it('zadržava numeric ID, response i servisne argumente', async () => {
      const device = {
        id: 17,
        userId: 42,
        deviceId: 'tuya-17',
        alias: 'Dnevna soba',
        homeProfile: { id: 7, homeName: 'Dom' },
        heatingEvents: [{ id: 3, deviceId: 17 }],
      };
      findOne.mockResolvedValue(device);

      const response = await request(app.getHttpServer()).get(
        '/api/devices/17',
      );

      expect(response.status).toBe(200);
      expect(response.body).toEqual(device);
      expect(findOne).toHaveBeenCalledTimes(1);
      expect(findOne).toHaveBeenCalledWith(42, 17);
    });

    it('odbija ne-brojčani ID prije servisnog poziva', async () => {
      findOne.mockResolvedValue({ id: 17, userId: 42 });

      const response = await request(app.getHttpServer()).get(
        '/api/devices/not-a-number',
      );

      expect(response.status).toBe(400);
      expect(findOne).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/devices/:id/programs path ID (S-002)', () => {
    it('zadržava numeric ID, response i servisne argumente', async () => {
      const programs = [
        {
          id: 101,
          deviceId: 17,
          dayType: 'WORKDAY',
          startMinute: 360,
          targetTemp: 21.5,
          orderIndex: 0,
          programHash: 'weekday-v1',
        },
        {
          id: 102,
          deviceId: 17,
          dayType: 'WORKDAY',
          startMinute: 1320,
          targetTemp: 17,
          orderIndex: 1,
          programHash: 'weekday-v1',
        },
      ];
      getPrograms.mockResolvedValue(programs);

      const response = await request(app.getHttpServer()).get(
        '/api/devices/17/programs',
      );

      expect(response.status).toBe(200);
      expect(response.body).toEqual(programs);
      expect(getPrograms).toHaveBeenCalledTimes(1);
      expect(getPrograms).toHaveBeenCalledWith(42, 17);
    });

    it('odbija ne-brojčani ID prije servisnog poziva', async () => {
      getPrograms.mockResolvedValue([]);

      const response = await request(app.getHttpServer()).get(
        '/api/devices/not-a-number/programs',
      );

      expect(response.status).toBe(400);
      expect(getPrograms).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /api/devices/:id path ID (S-002)', () => {
    it('zadržava numeric ID, response, prazan DTO i servisne argumente', async () => {
      const device = {
        id: 17,
        userId: 42,
        deviceId: 'tuya-17',
        alias: 'Dnevna soba',
        vendor: 'tuya',
        mode: 'PROGRAM',
        homeProfileId: 7,
      };
      update.mockResolvedValue(device);

      const response = await request(app.getHttpServer())
        .patch('/api/devices/17')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body).toEqual(device);
      expect(update).toHaveBeenCalledTimes(1);
      expect(update).toHaveBeenCalledWith(42, 17, {});
    });

    it('odbija ne-brojčani ID prije servisnog poziva', async () => {
      update.mockResolvedValue({ id: 17, userId: 42 });

      const response = await request(app.getHttpServer())
        .patch('/api/devices/not-a-number')
        .send({});

      expect(response.status).toBe(400);
      expect(update).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /api/devices/:id body DTO (S-002)', () => {
    const validBody = {
      alias: 'Dnevna soba',
      mode: 'MANUAL',
      vendor: 'tuya',
      deviceId: 'tuya-17',
      homeProfileId: 8,
    };

    it('valjan update zadržava 200, response i cijeli servisni argument', async () => {
      const device = { id: 17, userId: 42, ...validBody };
      update.mockResolvedValue(device);

      const response = await request(app.getHttpServer())
        .patch('/api/devices/17')
        .send(validBody);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(device);
      expect(update).toHaveBeenCalledTimes(1);
      expect(update).toHaveBeenCalledWith(42, 17, validBody);
    });

    it.each([
      ['alias', { ...validBody, alias: 123456 }],
      ['vendor', { ...validBody, vendor: 123456 }],
      ['deviceId', { ...validBody, deviceId: 123456 }],
      ['homeProfileId', { ...validBody, homeProfileId: '8' }],
    ])(
      '%s s pogrešnim raw tipom vraća 400 prije servisa',
      async (_field, body) => {
        update.mockResolvedValue({ id: 17, userId: 42 });

        const response = await request(app.getHttpServer())
          .patch('/api/devices/17')
          .send(body);

        expect(response.status).toBe(400);
        expect(update).not.toHaveBeenCalled();
      },
    );
  });

  describe('DELETE /api/devices/:id path ID (S-002)', () => {
    it('zadržava numeric ID, response i servisne argumente', async () => {
      const device = {
        id: 17,
        userId: 42,
        deviceId: 'tuya-17',
        alias: 'Dnevna soba',
        vendor: 'tuya',
        mode: 'PROGRAM',
        homeProfileId: 7,
      };
      remove.mockResolvedValue(device);

      const response = await request(app.getHttpServer()).delete(
        '/api/devices/17',
      );

      expect(response.status).toBe(200);
      expect(response.body).toEqual(device);
      expect(remove).toHaveBeenCalledTimes(1);
      expect(remove).toHaveBeenCalledWith(42, 17);
    });

    it('odbija ne-brojčani ID prije servisnog poziva', async () => {
      remove.mockResolvedValue({ id: 17, userId: 42 });

      const response = await request(app.getHttpServer()).delete(
        '/api/devices/not-a-number',
      );

      expect(response.status).toBe(400);
      expect(remove).not.toHaveBeenCalled();
    });
  });
});

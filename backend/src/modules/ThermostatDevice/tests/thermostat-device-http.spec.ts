jest.mock('../../../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));
jest.mock('../dto/create-thermostat-device.dto', () => ({
  CreateThermostatDeviceDto: class CreateThermostatDeviceDto {},
}));
jest.mock('../dto/update-thermostat-device.dto', () => ({
  UpdateThermostatDeviceDto: class UpdateThermostatDeviceDto {},
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
  const findOne = jest.fn();
  const getPrograms = jest.fn();
  const update = jest.fn();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ThermostatDeviceController],
      providers: [
        {
          provide: ThermostatDeviceService,
          useValue: { findOne, getPrograms, update },
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
    findOne.mockReset();
    getPrograms.mockReset();
    update.mockReset();
  });

  afterAll(async () => {
    await app.close();
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
});

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
import { HeatingAnomalyController } from '../heating.anomaly.checker.controller';
import { HeatingAnomalyCheckerService } from '../heating.anomayl.checker.service';

describe('Anomaly confirm HTTP kompatibilnost', () => {
  let app: INestApplication;
  const confirmOrUpdateAnomaly = jest.fn();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HeatingAnomalyController],
      providers: [
        {
          provide: HeatingAnomalyCheckerService,
          useValue: { confirmOrUpdateAnomaly },
        },
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
    confirmOrUpdateAnomaly.mockReset();
    confirmOrUpdateAnomaly.mockResolvedValue({ success: true, eventId: 17 });
  });

  afterAll(async () => {
    await app.close();
  });

  it.each([true, false])(
    'valjan confirm=%s zadržava 200, response i servisne argumente',
    async (confirm) => {
      const response = await request(app.getHttpServer())
        .patch('/api/anomalies/17')
        .send({ confirm });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true, eventId: 17 });
      expect(confirmOrUpdateAnomaly).toHaveBeenCalledTimes(1);
      expect(confirmOrUpdateAnomaly).toHaveBeenCalledWith(17, { confirm }, 42);
    },
  );

  it.each(['true', 'false'])(
    'string confirm="%s" vraća 400 prije servisnog poziva',
    async (confirm) => {
      const response = await request(app.getHttpServer())
        .patch('/api/anomalies/17')
        .send({ confirm });

      expect(response.status).toBe(400);
      expect(confirmOrUpdateAnomaly).not.toHaveBeenCalled();
    },
  );

  it.each(['0', '-1'])(
    'nepozitivan eventId %s vraća 400 prije servisnog poziva',
    async (eventId) => {
      const response = await request(app.getHttpServer())
        .patch(`/api/anomalies/${eventId}`)
        .send({ confirm: true });

      expect(response.status).toBe(400);
      expect(confirmOrUpdateAnomaly).not.toHaveBeenCalled();
    },
  );
});

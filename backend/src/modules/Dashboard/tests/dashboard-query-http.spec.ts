import {
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';

jest.mock('../../../prisma/prisma.service', () => ({
  PrismaService: class {},
}));
jest.mock('../dashboard.service', () => ({ DashboardService: class {} }));

import { PrismaService } from '../../../prisma/prisma.service';
import { JwtAuthGuard } from '../../Auth/jwt-auth.guard';
import { DashboardController } from '../dashboard.controller';
import { DashboardService } from '../dashboard.service';

describe('Dashboard query DTO HTTP kompatibilnost', () => {
  let app: INestApplication;
  const getHeatingStats = jest.fn();
  const validQuery = {
    homeProfileId: '17',
    from: '2026-01-01T00:00:00Z',
    to: '2026-01-02T00:00:00Z',
    bucket: 'day',
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        {
          provide: DashboardService,
          useValue: { getHeatingStats },
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
    getHeatingStats.mockReset();
    getHeatingStats.mockResolvedValue({ buckets: [] });
  });

  afterAll(async () => {
    await app.close();
  });

  it('numerički homeProfileId zadržava 200, response i servisne argumente', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/dashboard/heating-stats')
      .query(validQuery);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ buckets: [] });
    expect(getHeatingStats).toHaveBeenCalledTimes(1);
    expect(getHeatingStats).toHaveBeenCalledWith(
      42,
      expect.objectContaining({
        ...validQuery,
        homeProfileId: 17,
      }),
    );
  });

  it('prazan homeProfileId vraća 400 prije servisnog poziva', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/dashboard/heating-stats')
      .query({ ...validQuery, homeProfileId: '' });

    expect(response.status).toBe(400);
    expect(getHeatingStats).not.toHaveBeenCalled();
  });
});

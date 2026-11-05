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
import { BoilerController } from '../boiler.controller';
import { BoilerService } from '../boiler.service';

describe('Boiler current-temp HTTP kompatibilnost', () => {
  let app: INestApplication;
  const setCurrentTemp = jest.fn();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [BoilerController],
      providers: [
        {
          provide: BoilerService,
          useValue: { setCurrentTemp },
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
    setCurrentTemp.mockReset();
    setCurrentTemp.mockResolvedValue({ currentFlowTemp: 52.5 });
  });

  afterAll(async () => {
    await app.close();
  });

  it('valjan number zadržava 200, response i servisne argumente', async () => {
    const response = await request(app.getHttpServer())
      .patch('/api/boiler/current-temp')
      .send({ currentFlowTemp: 52.5 });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: { currentFlowTemp: 52.5 },
    });
    expect(setCurrentTemp).toHaveBeenCalledTimes(1);
    expect(setCurrentTemp).toHaveBeenCalledWith(42, 52.5);
  });

  it('string currentFlowTemp vraća 400 prije servisnog poziva', async () => {
    const response = await request(app.getHttpServer())
      .patch('/api/boiler/current-temp')
      .send({ currentFlowTemp: '52.5' });

    expect(response.status).toBe(400);
    expect(setCurrentTemp).not.toHaveBeenCalled();
  });
});

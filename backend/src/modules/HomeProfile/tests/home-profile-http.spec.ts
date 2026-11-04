jest.mock('../../../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));
jest.mock('../dto/create-home-profile.dto', () => ({
  CreateHomeProfileDto: class CreateHomeProfileDto {},
}));
jest.mock('../dto/update-home-profile.dto', () => ({
  UpdateHomeProfileDto: class UpdateHomeProfileDto {},
}));

import {
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JwtAuthGuard } from '../../Auth/jwt-auth.guard';
import { HomeProfileController } from '../home.profile.controller';
import { HomeProfileService } from '../home.profile.service';

describe('HomeProfile controller HTTP kompatibilnost', () => {
  let app: INestApplication;
  const activate = jest.fn();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HomeProfileController],
      providers: [
        {
          provide: HomeProfileService,
          useValue: { activate },
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
    activate.mockReset();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('PATCH /api/home-profiles/:id/activate path ID (S-002)', () => {
    it('zadržava numeric ID, response i servisne argumente', async () => {
      activate.mockResolvedValue({ id: 17, isActive: true });

      const response = await request(app.getHttpServer()).patch(
        '/api/home-profiles/17/activate',
      );

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ id: 17, isActive: true });
      expect(activate).toHaveBeenCalledWith(42, 17);
    });

    it('odbija ne-brojčani ID prije servisnog poziva', async () => {
      activate.mockResolvedValue({ id: 17, isActive: true });

      const response = await request(app.getHttpServer()).patch(
        '/api/home-profiles/not-a-number/activate',
      );

      expect(response.status).toBe(400);
      expect(activate).not.toHaveBeenCalled();
    });
  });
});

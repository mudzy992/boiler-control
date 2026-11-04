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
import {
  HomeProfileController,
  HomeProfileSingleController,
} from '../home.profile.controller';
import { HomeProfileService } from '../home.profile.service';

describe('HomeProfile controller HTTP kompatibilnost', () => {
  let app: INestApplication;
  const findOne = jest.fn();
  const update = jest.fn();
  const remove = jest.fn();
  const activate = jest.fn();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HomeProfileController, HomeProfileSingleController],
      providers: [
        {
          provide: HomeProfileService,
          useValue: { findOne, update, remove, activate },
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
    update.mockReset();
    remove.mockReset();
    activate.mockReset();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/home-profiles/:id path ID (S-002)', () => {
    it('zadržava numeric ID, response i servisne argumente', async () => {
      findOne.mockResolvedValue({
        id: 17,
        userId: 42,
        homeName: 'Kuća',
        location: 'Sarajevo',
      });

      const response = await request(app.getHttpServer()).get(
        '/api/home-profiles/17',
      );

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        id: 17,
        userId: 42,
        homeName: 'Kuća',
        location: 'Sarajevo',
      });
      expect(findOne).toHaveBeenCalledWith(42, 17);
    });

    it('odbija ne-brojčani ID prije servisnog poziva', async () => {
      findOne.mockResolvedValue({ id: 17, userId: 42 });

      const response = await request(app.getHttpServer()).get(
        '/api/home-profiles/not-a-number',
      );

      expect(response.status).toBe(400);
      expect(findOne).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /api/home-profiles/:id path ID (S-002)', () => {
    it('zadržava numeric ID, response i servisne argumente', async () => {
      update.mockResolvedValue({
        id: 17,
        userId: 42,
        homeName: 'Kuća',
        targetDayTemp: 21,
      });

      const response = await request(app.getHttpServer())
        .patch('/api/home-profiles/17')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        id: 17,
        userId: 42,
        homeName: 'Kuća',
        targetDayTemp: 21,
      });
      expect(update).toHaveBeenCalledWith(42, 17, {});
    });

    it('odbija ne-brojčani ID prije servisnog poziva', async () => {
      update.mockResolvedValue({ id: 17, userId: 42 });

      const response = await request(app.getHttpServer())
        .patch('/api/home-profiles/not-a-number')
        .send({});

      expect(response.status).toBe(400);
      expect(update).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /api/home-profiles/:id path ID (S-002)', () => {
    it('zadržava numeric ID, response i servisne argumente', async () => {
      remove.mockResolvedValue({
        id: 17,
        userId: 42,
        homeName: 'Kuća',
      });

      const response = await request(app.getHttpServer()).delete(
        '/api/home-profiles/17',
      );

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        id: 17,
        userId: 42,
        homeName: 'Kuća',
      });
      expect(remove).toHaveBeenCalledWith(42, 17);
    });

    it('odbija ne-brojčani ID prije servisnog poziva', async () => {
      remove.mockResolvedValue({ id: 17, userId: 42 });

      const response = await request(app.getHttpServer()).delete(
        '/api/home-profiles/not-a-number',
      );

      expect(response.status).toBe(400);
      expect(remove).not.toHaveBeenCalled();
    });
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

  describe('PATCH /api/home-profile/:id path ID (S-002)', () => {
    it('zadržava numeric ID, mapProfile response i servisne argumente', async () => {
      update.mockResolvedValue({
        id: 17,
        userId: 42,
        floorArea: 150,
        insulationType: 'EPS',
        windowType: 'DOUBLE_GLAZED',
        heatingType: 'RADIATOR',
        location: 'Sarajevo',
        isActive: true,
      });

      const response = await request(app.getHttpServer())
        .patch('/api/home-profile/17')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        id: 17,
        userId: 42,
        floorArea: 150,
        insulationType: 'EPS',
        windowType: 'DOUBLE_GLAZED',
        heatingType: 'RADIATOR',
        location: 'Sarajevo',
        isActive: true,
        squareMeters: 150,
        insulationLevel: 'EPS',
        windowQuality: 'DOUBLE_GLAZED',
        radiatorType: 'RADIATOR',
      });
      expect(update).toHaveBeenCalledWith(42, 17, {});
    });

    it('odbija ne-brojčani ID prije servisnog poziva', async () => {
      update.mockResolvedValue({ id: 17, userId: 42 });

      const response = await request(app.getHttpServer())
        .patch('/api/home-profile/not-a-number')
        .send({});

      expect(response.status).toBe(400);
      expect(update).not.toHaveBeenCalled();
    });
  });
});

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
import {
  HomeProfileController,
  HomeProfileSingleController,
} from '../home.profile.controller';
import { HomeProfileService } from '../home.profile.service';

describe('HomeProfile controller HTTP kompatibilnost', () => {
  let app: INestApplication;
  const create = jest.fn();
  const findOne = jest.fn();
  const update = jest.fn();
  const remove = jest.fn();
  const activate = jest.fn();
  const scalarWrongRawTypes: Array<[string, string]> = [
    ['floorArea', '150'],
    ['ceilingHeight', '2.6'],
    ['insulationThickness', '12'],
    ['constructionYear', '2010'],
    ['numberOfResidents', '4'],
    ['hasFloorHeating', 'false'],
    ['targetMorningTemp', '22'],
    ['targetDayTemp', '21'],
    ['targetNightTemp', '18'],
  ];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HomeProfileController, HomeProfileSingleController],
      providers: [
        {
          provide: HomeProfileService,
          useValue: { create, findOne, update, remove, activate },
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
    update.mockReset();
    remove.mockReset();
    activate.mockReset();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/home-profiles body DTO (S-002)', () => {
    const validBody = {
      homeName: 'Porodicna kuca',
      location: 'Sarajevo',
      floorArea: 150,
      ceilingHeight: 2.6,
      insulationType: 'EPS',
      insulationThickness: 12,
      windowType: 'DOUBLE_GLAZED',
      heatingType: 'RADIATOR',
      constructionYear: 2010,
      numberOfResidents: 4,
      boilerModel: 'Bosch',
      hasFloorHeating: false,
      targetMorningTemp: 22,
      targetDayTemp: 21,
      targetNightTemp: 18,
      preferredScheduleNotes: 'Radnim danom ranije',
      seasonMode: 'WINTER',
    };

    it('valjan create zadržava 201, response, JWT userId i servisni argument', async () => {
      const profile = { id: 17, userId: 42, ...validBody };
      create.mockResolvedValue(profile);

      const response = await request(app.getHttpServer())
        .post('/api/home-profiles')
        .send(validBody);

      expect(response.status).toBe(201);
      expect(response.body).toEqual(profile);
      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith(42, validBody);
    });

    it.each([
      ['homeName', { ...validBody, homeName: 123456 }],
      ['location', { ...validBody, location: 123456 }],
      ['boilerModel', { ...validBody, boilerModel: 123456 }],
      [
        'preferredScheduleNotes',
        { ...validBody, preferredScheduleNotes: 123456 },
      ],
    ])(
      '%s s pogrešnim raw tipom vraća 400 prije servisa',
      async (_field, body) => {
        create.mockResolvedValue({ id: 17, userId: 42 });

        const response = await request(app.getHttpServer())
          .post('/api/home-profiles')
          .send(body);

        expect(response.status).toBe(400);
        expect(create).not.toHaveBeenCalled();
      },
    );

    it.each(scalarWrongRawTypes)(
      '%s s pogrešnim raw tipom vraća 400 prije servisa',
      async (field, rawValue) => {
        create.mockResolvedValue({ id: 17, userId: 42 });

        const response = await request(app.getHttpServer())
          .post('/api/home-profiles')
          .send({ ...validBody, [field]: rawValue });

        expect(response.status).toBe(400);
        expect(create).not.toHaveBeenCalled();
      },
    );
  });

  describe('PATCH /api/home-profiles/:id body DTO (S-002)', () => {
    const validBody = {
      homeName: 'Porodicna kuca',
      location: 'Sarajevo',
      boilerModel: 'Bosch',
      preferredScheduleNotes: 'Radnim danom ranije',
    };
    const validScalarBody = {
      floorArea: 150,
      ceilingHeight: 2.6,
      insulationThickness: 12,
      constructionYear: 2010,
      numberOfResidents: 4,
      hasFloorHeating: false,
      targetMorningTemp: 22,
      targetDayTemp: 21,
      targetNightTemp: 18,
    };

    it('valjan update zadržava 200, response i cijeli servisni argument', async () => {
      const profile = { id: 17, userId: 42, ...validBody };
      update.mockResolvedValue(profile);

      const response = await request(app.getHttpServer())
        .patch('/api/home-profiles/17')
        .send(validBody);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(profile);
      expect(update).toHaveBeenCalledTimes(1);
      expect(update).toHaveBeenCalledWith(42, 17, validBody);
    });

    it('valjan scalar update zadržava 200, response i servisni argument', async () => {
      const profile = { id: 17, userId: 42, ...validScalarBody };
      update.mockResolvedValue(profile);

      const response = await request(app.getHttpServer())
        .patch('/api/home-profiles/17')
        .send(validScalarBody);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(profile);
      expect(update).toHaveBeenCalledTimes(1);
      expect(update).toHaveBeenCalledWith(42, 17, validScalarBody);
    });

    it('nullable update polja zadržavaju null, response i servisni argument', async () => {
      const body = {
        homeName: null,
        location: null,
        numberOfResidents: null,
        boilerModel: null,
        targetMorningTemp: null,
        targetDayTemp: null,
        targetNightTemp: null,
        preferredScheduleNotes: null,
      };
      const profile = { id: 17, userId: 42, ...body };
      update.mockResolvedValue(profile);

      const response = await request(app.getHttpServer())
        .patch('/api/home-profiles/17')
        .send(body);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(profile);
      expect(update).toHaveBeenCalledTimes(1);
      expect(update).toHaveBeenCalledWith(42, 17, body);
    });

    it.each([
      'floorArea',
      'ceilingHeight',
      'insulationType',
      'insulationThickness',
      'windowType',
      'heatingType',
      'constructionYear',
      'hasFloorHeating',
      'seasonMode',
    ])(
      'non-nullable update %s=null vraća 400 prije servisnog poziva',
      async (field) => {
        update.mockResolvedValue({ id: 17, userId: 42 });

        const response = await request(app.getHttpServer())
          .patch('/api/home-profiles/17')
          .send({ [field]: null });

        expect(response.status).toBe(400);
        expect(update).not.toHaveBeenCalled();
      },
    );

    it.each([
      ['homeName', { ...validBody, homeName: 123456 }],
      ['location', { ...validBody, location: 123456 }],
      ['boilerModel', { ...validBody, boilerModel: 123456 }],
      [
        'preferredScheduleNotes',
        { ...validBody, preferredScheduleNotes: 123456 },
      ],
    ])(
      '%s s pogrešnim raw tipom vraća 400 prije servisa',
      async (_field, body) => {
        update.mockResolvedValue({ id: 17, userId: 42 });

        const response = await request(app.getHttpServer())
          .patch('/api/home-profiles/17')
          .send(body);

        expect(response.status).toBe(400);
        expect(update).not.toHaveBeenCalled();
      },
    );

    it.each(scalarWrongRawTypes)(
      '%s s pogrešnim raw tipom vraća 400 prije servisa',
      async (field, rawValue) => {
        update.mockResolvedValue({ id: 17, userId: 42 });

        const response = await request(app.getHttpServer())
          .patch('/api/home-profiles/17')
          .send({ ...validScalarBody, [field]: rawValue });

        expect(response.status).toBe(400);
        expect(update).not.toHaveBeenCalled();
      },
    );
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

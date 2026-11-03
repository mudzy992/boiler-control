import {
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JwtAuthGuard } from '../../Auth/jwt-auth.guard';
import { IMAGE_MAX_SIZE_BYTES } from '../../../common/file-storage.service';
import { GasReadingController } from '../gas.reading.controller';
import { GasReadingService } from '../gas.reading.service';

describe('Gas controller HTTP kompatibilnost', () => {
  let app: INestApplication;
  const create = jest.fn();
  const getEfficiencyAnalysis = jest.fn();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [GasReadingController],
      providers: [
        {
          provide: GasReadingService,
          useValue: { create, getEfficiencyAnalysis },
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
    getEfficiencyAnalysis.mockReset();
  });

  afterAll(async () => {
    await app.close();
  });

  it('zadržava multipart DTO i proslijeđuje datoteku vlasniku', async () => {
    create.mockResolvedValue({ id: 17 });
    const image = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);

    const response = await request(app.getHttpServer())
      .post('/api/gas/reading')
      .field('counterValue', '123.45')
      .field('readingDate', '2026-11-02T10:00:00.000Z')
      .attach('meterImage', image, {
        filename: 'meter.jpg',
        contentType: 'image/jpeg',
      });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ id: 17 });
    expect(create).toHaveBeenCalledWith(
      42,
      expect.objectContaining({
        counterValue: 123.45,
        readingDate: '2026-11-02T10:00:00.000Z',
      }),
      expect.objectContaining({
        originalname: 'meter.jpg',
        mimetype: 'image/jpeg',
        size: image.length,
        buffer: image,
      }),
    );
  });

  it('zadržava 413 i ne poziva servis iznad postojećeg file-size limita', async () => {
    const oversized = Buffer.alloc(IMAGE_MAX_SIZE_BYTES + 1, 0);

    const response = await request(app.getHttpServer())
      .post('/api/gas/reading')
      .field('counterValue', '123.45')
      .field('readingDate', '2026-11-02T10:00:00.000Z')
      .attach('meterImage', oversized, {
        filename: 'too-large.jpg',
        contentType: 'image/jpeg',
      });

    expect(response.status).toBe(413);
    expect(create).not.toHaveBeenCalled();
  });

  describe('GET /api/gas/analysis query DTO (S-002)', () => {
    it('zadržava installed-mobile poziv bez query parametara', async () => {
      getEfficiencyAnalysis.mockResolvedValue({
        period: { mode: 'last_30_days' },
      });

      const response = await request(app.getHttpServer()).get(
        '/api/gas/analysis',
      );

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ period: { mode: 'last_30_days' } });
      expect(getEfficiencyAnalysis).toHaveBeenCalledWith(
        42,
        undefined,
        undefined,
      );
    });

    it('zadržava web YYYY-MM-DD raspon i response', async () => {
      getEfficiencyAnalysis.mockResolvedValue({ period: { mode: 'explicit' } });

      const response = await request(app.getHttpServer())
        .get('/api/gas/analysis')
        .query({ from: '2026-10-01', to: '2026-11-01' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ period: { mode: 'explicit' } });
      expect(getEfficiencyAnalysis).toHaveBeenCalledWith(
        42,
        new Date('2026-10-01'),
        new Date('2026-11-01'),
      );
    });

    it('zadržava postojeći fallback kada je zadan samo from', async () => {
      getEfficiencyAnalysis.mockResolvedValue({ period: { mode: 'fallback' } });

      const response = await request(app.getHttpServer())
        .get('/api/gas/analysis')
        .query({ from: '2026-10-01' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ period: { mode: 'fallback' } });
      expect(getEfficiencyAnalysis).toHaveBeenCalledWith(
        42,
        new Date('2026-10-01'),
        undefined,
      );
    });

    it.each<[string, Record<string, unknown>]>([
      ['nevažeći from', { from: 'nije-datum', to: '2026-11-01' }],
      ['nevažeći to', { from: '2026-10-01', to: 'nije-datum' }],
      ['prazan from', { from: '' }],
      ['ponovljeni from', { from: ['2026-10-01', '2026-10-02'] }],
      ['nedozvoljeni query parametar', { unexpected: 'value' }],
    ])('odbija %s prije servisnog poziva', async (_label, query) => {
      const response = await request(app.getHttpServer())
        .get('/api/gas/analysis')
        .query(query);

      expect(response.status).toBe(400);
      expect(getEfficiencyAnalysis).not.toHaveBeenCalled();
    });
  });
});

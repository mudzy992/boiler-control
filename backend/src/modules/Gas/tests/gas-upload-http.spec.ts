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
  const deleteReading = jest.fn();
  const updateReference = jest.fn();
  const uploadMeterImage = jest.fn();
  const uploadInvoice = jest.fn();
  const getEfficiencyAnalysis = jest.fn();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [GasReadingController],
      providers: [
        {
          provide: GasReadingService,
          useValue: {
            create,
            delete: deleteReading,
            updateReference,
            uploadMeterImage,
            uploadInvoice,
            getEfficiencyAnalysis,
          },
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
    deleteReading.mockReset();
    updateReference.mockReset();
    uploadMeterImage.mockReset();
    uploadInvoice.mockReset();
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

  describe('DELETE /api/gas/reading/:id path ID (S-002)', () => {
    it('zadržava numeric ID, response i servisne argumente', async () => {
      deleteReading.mockResolvedValue({ id: 17 });

      const response = await request(app.getHttpServer()).delete(
        '/api/gas/reading/17',
      );

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ id: 17 });
      expect(deleteReading).toHaveBeenCalledWith(42, 17);
    });

    it('odbija ne-brojčani ID prije servisnog poziva', async () => {
      deleteReading.mockResolvedValue({ id: 17 });

      const response = await request(app.getHttpServer()).delete(
        '/api/gas/reading/not-a-number',
      );

      expect(response.status).toBe(400);
      expect(deleteReading).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /api/gas/reading/:id/reference path ID (S-002)', () => {
    it('zadržava numeric ID, response i servisne argumente', async () => {
      updateReference.mockResolvedValue({ id: 17, isInvoiceReference: true });

      const response = await request(app.getHttpServer())
        .patch('/api/gas/reading/17/reference')
        .send({ isReference: true });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ id: 17, isInvoiceReference: true });
      expect(updateReference).toHaveBeenCalledWith(
        42,
        17,
        expect.objectContaining({ isReference: true }),
      );
    });

    it('odbija ne-brojčani ID prije servisnog poziva', async () => {
      updateReference.mockResolvedValue({ id: 17 });

      const response = await request(app.getHttpServer())
        .patch('/api/gas/reading/not-a-number/reference')
        .send({ isReference: true });

      expect(response.status).toBe(400);
      expect(updateReference).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/gas/reading/:id/meter-image path ID (S-002)', () => {
    const image = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);

    it('zadržava numeric ID, multipart response i file argumente', async () => {
      uploadMeterImage.mockResolvedValue({ id: 17, hasMeterImage: true });

      const response = await request(app.getHttpServer())
        .post('/api/gas/reading/17/meter-image')
        .attach('meterImage', image, {
          filename: 'meter.jpg',
          contentType: 'image/jpeg',
        });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({ id: 17, hasMeterImage: true });
      expect(uploadMeterImage).toHaveBeenCalledWith(
        42,
        17,
        expect.objectContaining({
          originalname: 'meter.jpg',
          mimetype: 'image/jpeg',
          size: image.length,
          buffer: image,
        }),
      );
    });

    it('odbija ne-brojčani ID prije servisnog poziva', async () => {
      uploadMeterImage.mockResolvedValue({ id: 17 });

      const response = await request(app.getHttpServer())
        .post('/api/gas/reading/not-a-number/meter-image')
        .attach('meterImage', image, {
          filename: 'meter.jpg',
          contentType: 'image/jpeg',
        });

      expect(response.status).toBe(400);
      expect(uploadMeterImage).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/gas/reading/:id/invoice path ID (S-002)', () => {
    const pdf = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);

    it('zadržava numeric ID, multipart DTO, response i file argumente', async () => {
      uploadInvoice.mockResolvedValue({ id: 17, hasInvoicePdf: true });

      const response = await request(app.getHttpServer())
        .post('/api/gas/reading/17/invoice')
        .field('invoiceGasPriceExVat', '1.25')
        .attach('invoicePdf', pdf, {
          filename: 'invoice.pdf',
          contentType: 'application/pdf',
        });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({ id: 17, hasInvoicePdf: true });
      expect(uploadInvoice).toHaveBeenCalledWith(
        42,
        17,
        expect.objectContaining({ invoiceGasPriceExVat: 1.25 }),
        expect.objectContaining({
          originalname: 'invoice.pdf',
          mimetype: 'application/pdf',
          size: pdf.length,
          buffer: pdf,
        }),
      );
    });

    it('odbija ne-brojčani ID prije servisnog poziva', async () => {
      uploadInvoice.mockResolvedValue({ id: 17 });

      const response = await request(app.getHttpServer())
        .post('/api/gas/reading/not-a-number/invoice')
        .field('invoiceGasPriceExVat', '1.25')
        .attach('invoicePdf', pdf, {
          filename: 'invoice.pdf',
          contentType: 'application/pdf',
        });

      expect(response.status).toBe(400);
      expect(uploadInvoice).not.toHaveBeenCalled();
    });
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

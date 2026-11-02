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

describe('Gas multipart HTTP kompatibilnost', () => {
  let app: INestApplication;
  const create = jest.fn();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [GasReadingController],
      providers: [{ provide: GasReadingService, useValue: { create } }],
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
});

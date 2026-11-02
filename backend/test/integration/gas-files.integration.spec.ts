import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { FileStorageService } from '../../src/common/file-storage.service';
import { PrismaService } from '../../src/prisma/prisma.service';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
const PDF = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n', 'ascii');
const MISSING_READING_ID = 2147483647;
const originalUploadRoot = process.env.UPLOAD_ROOT_PATH;

async function allFiles(root: string): Promise<string[]> {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...(await allFiles(absolute)));
    else files.push(path.relative(root, absolute));
  }
  return files.sort();
}

/**
 * SEC-5 owner-only gas file provjera sa stvarnim guardom, PostgreSQL-om i
 * privremenim storageom. Ne pokreće produkcijski storage ni vanjske providere.
 */
describe('Integration: SEC-5 owner-only gas files', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let uploadRoot: string;
  let ownerId: number;
  let otherId: number;
  let ownerToken: string;
  let otherToken: string;
  let readingId: number;
  let meterPath: string;
  let invoicePath: string;
  const suffix = randomUUID();

  beforeAll(async () => {
    uploadRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), 'boiler-gas-files-integration-'),
    );
    process.env.UPLOAD_ROOT_PATH = uploadRoot;

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
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
    prisma = moduleRef.get(PrismaService);
    const jwt = moduleRef.get(JwtService);
    const fileStorage = moduleRef.get(FileStorageService);

    const owner = await prisma.user.create({
      data: {
        email: `sec5-owner-${suffix}@example.test`,
        username: `sec5-owner-${suffix}`,
        passwordHash: 'synthetic-not-a-real-hash',
      },
    });
    const other = await prisma.user.create({
      data: {
        email: `sec5-other-${suffix}@example.test`,
        username: `sec5-other-${suffix}`,
        passwordHash: 'synthetic-not-a-real-hash',
      },
    });
    ownerId = owner.id;
    otherId = other.id;
    ownerToken = jwt.sign({ userId: ownerId });
    otherToken = jwt.sign({ userId: otherId });

    const reading = await prisma.gasReading.create({
      data: {
        userId: ownerId,
        readingDate: new Date('2026-02-01T10:00:00.000Z'),
        counterValue: 100,
        consumption: 0,
        isInvoiceReference: true,
      },
    });
    readingId = reading.id;

    const meter = await fileStorage.storeGasReadingImage(readingId, {
      buffer: JPEG,
      mimetype: 'image/jpeg',
      size: JPEG.length,
      originalname: '../owner-meter.jpg',
    });
    const invoice = await fileStorage.storeGasInvoicePdf(readingId, {
      buffer: PDF,
      mimetype: 'application/pdf',
      size: PDF.length,
      originalname: '../owner-invoice.pdf',
    });
    meterPath = meter.relativePath;
    invoicePath = invoice.relativePath;

    await prisma.gasReading.update({
      where: { id: readingId },
      data: {
        meterImagePath: meter.relativePath,
        meterImageMime: meter.mimeType,
        meterImageOriginalName: meter.originalName,
        invoicePdfPath: invoice.relativePath,
        invoicePdfMime: invoice.mimeType,
        invoicePdfOriginalName: invoice.originalName,
        invoiceUploadedAt: new Date('2026-02-01T11:00:00.000Z'),
      },
    });
  });

  afterAll(async () => {
    if (prisma) {
      const userIds = [ownerId, otherId].filter(Number.isInteger);
      await prisma.gasPriceHistory.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.gasReading.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      await prisma.$disconnect();
    }
    await app?.close();
    if (originalUploadRoot === undefined) {
      delete process.env.UPLOAD_ROOT_PATH;
    } else {
      process.env.UPLOAD_ROOT_PATH = originalUploadRoot;
    }
    if (uploadRoot) {
      await fs.rm(uploadRoot, { recursive: true, force: true });
    }
  });

  const fileRequest = (route: string, token?: string, binary = false) => {
    let pending = request(app.getHttpServer()).get(route);
    if (token) pending = pending.set('Authorization', `Bearer ${token}`);
    if (binary) pending = pending.responseType('blob');
    return pending;
  };

  const readingRoute = (id: number, suffix: 'meter-image' | 'invoice') =>
    `/api/gas/reading/${id}/${suffix}`;

  it('zahtijeva JWT za obje privatne download rute', async () => {
    expect(
      (await fileRequest(readingRoute(readingId, 'meter-image'))).status,
    ).toBe(401);
    expect((await fileRequest(readingRoute(readingId, 'invoice'))).status).toBe(
      401,
    );
  });

  it('vlasnik dobija tačne bajtove i postojeće headere', async () => {
    const meter = await fileRequest(
      readingRoute(readingId, 'meter-image'),
      ownerToken,
      true,
    );
    expect(meter.status).toBe(200);
    expect(meter.body).toEqual(JPEG);
    expect(meter.headers['content-type']).toBe('image/jpeg');
    expect(meter.headers['content-disposition']).toBe(
      'inline; filename="owner-meter.jpg"',
    );

    const invoice = await fileRequest(
      readingRoute(readingId, 'invoice'),
      ownerToken,
      true,
    );
    expect(invoice.status).toBe(200);
    expect(invoice.body).toEqual(PDF);
    expect(invoice.headers['content-type']).toBe('application/pdf');
    expect(invoice.headers['content-disposition']).toBe(
      'inline; filename="owner-invoice.pdf"',
    );
  });

  it('tuđi i nepostojeći zapis daju identičan 404 za oba tipa', async () => {
    for (const type of ['meter-image', 'invoice'] as const) {
      const foreign = await fileRequest(
        readingRoute(readingId, type),
        otherToken,
      );
      const missing = await fileRequest(
        readingRoute(MISSING_READING_ID, type),
        otherToken,
      );
      expect(foreign.status).toBe(404);
      expect(missing.status).toBe(404);
      expect(foreign.body).toEqual(missing.body);
    }
  });

  it('tuđi korisnik ne može mijenjati ni brisati fajlove ili zapis', async () => {
    const before = await prisma.gasReading.findUnique({
      where: { id: readingId },
    });
    const filesBefore = await allFiles(uploadRoot);

    const meterUpload = await request(app.getHttpServer())
      .post(readingRoute(readingId, 'meter-image'))
      .set('Authorization', `Bearer ${otherToken}`)
      .attach('meterImage', JPEG, {
        filename: 'foreign.jpg',
        contentType: 'image/jpeg',
      });
    expect(meterUpload.status).toBe(404);

    const invoiceUpload = await request(app.getHttpServer())
      .post(readingRoute(readingId, 'invoice'))
      .set('Authorization', `Bearer ${otherToken}`)
      .attach('invoicePdf', PDF, {
        filename: 'foreign.pdf',
        contentType: 'application/pdf',
      });
    expect(invoiceUpload.status).toBe(404);

    const invoiceDelete = await request(app.getHttpServer())
      .delete(readingRoute(readingId, 'invoice'))
      .set('Authorization', `Bearer ${otherToken}`);
    expect(invoiceDelete.status).toBe(404);

    const readingDelete = await request(app.getHttpServer())
      .delete(`/api/gas/reading/${readingId}`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(readingDelete.status).toBe(404);

    const after = await prisma.gasReading.findUnique({
      where: { id: readingId },
    });
    expect(after).toEqual(before);
    expect(await allFiles(uploadRoot)).toEqual(filesBefore);
    expect(await fs.readFile(path.join(uploadRoot, meterPath))).toEqual(JPEG);
    expect(await fs.readFile(path.join(uploadRoot, invoicePath))).toEqual(PDF);
  });

  it('vlasnik uploaduje i ponovo čita svoje fajlove kroz puni HTTP tok', async () => {
    const reading = await prisma.gasReading.create({
      data: {
        userId: ownerId,
        readingDate: new Date('2026-02-02T10:00:00.000Z'),
        counterValue: 110,
        consumption: 10,
        isInvoiceReference: true,
      },
    });

    const meterUpload = await request(app.getHttpServer())
      .post(readingRoute(reading.id, 'meter-image'))
      .set('Authorization', `Bearer ${ownerToken}`)
      .attach('meterImage', JPEG, {
        filename: 'new-meter.jpg',
        contentType: 'image/jpeg',
      });
    expect(meterUpload.status).toBe(201);

    const invoiceUpload = await request(app.getHttpServer())
      .post(readingRoute(reading.id, 'invoice'))
      .set('Authorization', `Bearer ${ownerToken}`)
      .attach('invoicePdf', PDF, {
        filename: 'new-invoice.pdf',
        contentType: 'application/pdf',
      });
    expect(invoiceUpload.status).toBe(201);

    const saved = await prisma.gasReading.findUnique({
      where: { id: reading.id },
    });
    if (!saved?.meterImagePath || !saved.invoicePdfPath) {
      throw new Error('Owner upload nije sačuvao obje putanje');
    }

    const meter = await fileRequest(
      readingRoute(reading.id, 'meter-image'),
      ownerToken,
      true,
    );
    expect(meter.status).toBe(200);
    expect(meter.body).toEqual(JPEG);
    expect(meter.headers['content-disposition']).toBe(
      'inline; filename="new-meter.jpg"',
    );

    const invoice = await fileRequest(
      readingRoute(reading.id, 'invoice'),
      ownerToken,
      true,
    );
    expect(invoice.status).toBe(200);
    expect(invoice.body).toEqual(PDF);
    expect(invoice.headers['content-disposition']).toBe(
      'inline; filename="new-invoice.pdf"',
    );
  });
});

import { BadRequestException } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  FileStorageService,
  PDF_MAX_SIZE_BYTES,
} from '../file-storage.service';

const PDF = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n');
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);
const WEBP = Buffer.from([
  0x52, 0x49, 0x46, 0x46, 0x04, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);

type TestFile = {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname: string;
};

function input(buffer: Buffer, mimetype: string): TestFile {
  return {
    buffer,
    mimetype,
    size: buffer.length,
    originalname: '../synthetic.bin',
  };
}

async function allFiles(root: string): Promise<string[]> {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...(await allFiles(absolute)));
    else files.push(absolute);
  }
  return files;
}

describe('FileStorageService provjera sadržaja', () => {
  const originalRoot = process.env.UPLOAD_ROOT_PATH;
  let root: string;
  let service: FileStorageService;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'boiler-file-content-'));
    process.env.UPLOAD_ROOT_PATH = root;
    service = new FileStorageService();
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => setImmediate(resolve));
    await fs.rm(root, { recursive: true, force: true });
    if (originalRoot === undefined) delete process.env.UPLOAD_ROOT_PATH;
    else process.env.UPLOAD_ROOT_PATH = originalRoot;
  });

  const validCases = [
    {
      name: 'PDF',
      file: () => input(PDF, 'application/pdf'),
      store: (file: TestFile) => service.storeGasInvoicePdf(1, file),
    },
    {
      name: 'JPEG',
      file: () => input(JPEG, 'image/jpeg'),
      store: (file: TestFile) => service.storeGasReadingImage(1, file),
    },
    {
      name: 'PNG',
      file: () => input(PNG, 'image/png'),
      store: (file: TestFile) => service.storeUserImage(1, file),
    },
    {
      name: 'WebP',
      file: () => input(WEBP, 'image/webp'),
      store: (file: TestFile) => service.storeGasReadingImage(1, file),
    },
  ];

  it.each(validCases)(
    'prihvaća $name potpis uz nepromijenjeno čuvanje',
    async ({ file, store }) => {
      const uploaded = file();
      const saved = await store(uploaded);

      expect(await fs.readFile(path.join(root, saved.relativePath))).toEqual(
        uploaded.buffer,
      );
      expect(saved.originalName).toBe('synthetic.bin');
    },
  );

  const invalidCases = [
    {
      name: 'ne-PDF s PDF MIME-om',
      file: () =>
        input(Buffer.from('synthetic non-PDF content'), 'application/pdf'),
      store: (file: TestFile) => service.storeGasInvoicePdf(99, file),
    },
    {
      name: 'truncated PDF',
      file: () => input(Buffer.from('%PDF'), 'application/pdf'),
      store: (file: TestFile) => service.storeGasInvoicePdf(99, file),
    },
    {
      name: 'PNG sadržaj s JPEG MIME-om',
      file: () => input(PNG, 'image/jpeg'),
      store: (file: TestFile) => service.storeGasReadingImage(99, file),
    },
    {
      name: 'truncated PNG',
      file: () => input(PNG.subarray(0, 7), 'image/png'),
      store: (file: TestFile) => service.storeUserImage(99, file),
    },
    {
      name: 'truncated WebP',
      file: () => input(Buffer.from('RIFF'), 'image/webp'),
      store: (file: TestFile) => service.storeGasReadingImage(99, file),
    },
    {
      name: 'truncated JPEG',
      file: () => input(Buffer.from([0xff, 0xd8]), 'image/jpeg'),
      store: (file: TestFile) => service.storeUserImage(99, file),
    },
  ];

  it.each(invalidCases)('odbija $name bez upisa', async ({ file, store }) => {
    const error = await store(file()).then(
      () => null,
      (reason: unknown) => reason,
    );

    expect(error).toBeInstanceOf(BadRequestException);
    expect(await allFiles(root)).toEqual([]);
  });

  it('zadržava odbijanje nedozvoljenog MIME-a', async () => {
    await expect(
      service.storeGasInvoicePdf(1, input(PDF, 'text/plain')),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('zadržava postojeći metadata size limit', async () => {
    const file = {
      ...input(PDF, 'application/pdf'),
      size: PDF_MAX_SIZE_BYTES + 1,
    };
    await expect(service.storeGasInvoicePdf(1, file)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

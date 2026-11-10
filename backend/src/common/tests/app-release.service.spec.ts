import { deflateRawSync } from 'zlib';
import {
  AppReleaseService,
  buildNumberFromVersion,
  compareVersions,
  downloadUrlFor,
  readVersionFromApk,
} from '../app-release.service';

// `PrismaService` se ne učitava: servis ga dobija kroz DI, a test ga zamjenjuje
// stubom sa `jest.fn()`-ovima. Modul se ipak mockuje jer `import` u servisu
// nosi tip — bez ovoga bi Jest tražio generisani klijent, kojeg u sandboxu nema.
jest.mock('../../prisma/prisma.service', () => ({
  PrismaService: class {},
}));

/**
 * `F15`: objava verzije kroz dashboard.
 *
 * Tri stvari koje test mora da čuva, jer se ne vide iz UI-a:
 *
 * 1. verzija se **čita iz APK-a** (`assets/app.config`), a ne pogađa;
 * 2. verzija mora biti veća od posljednje objavljene — inače korisnik sa
 *    novijom instalacijom nikad ne dobije obavijest;
 * 3. odbijen upload ne ostavlja fajl na disku.
 */

/** Pravi minimalni ZIP sa jednim fajlom; `method` 0 = stored, 8 = deflate. */
function zipWithEntry(
  name: string,
  content: string,
  method: 0 | 8 = 8,
): Buffer {
  const nameBuf = Buffer.from(name, 'utf8');
  const raw = Buffer.from(content, 'utf8');
  const data = method === 8 ? deflateRawSync(raw) : raw;

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0, 6);
  local.writeUInt16LE(method, 8);
  local.writeUInt32LE(0, 10); // time/date
  local.writeUInt32LE(0, 14); // crc (čitač ga ne provjerava)
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(raw.length, 22);
  local.writeUInt16LE(nameBuf.length, 26);
  local.writeUInt16LE(0, 28);

  const localOffset = 0;
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0, 8);
  central.writeUInt16LE(method, 10);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(raw.length, 24);
  central.writeUInt16LE(nameBuf.length, 28);
  central.writeUInt16LE(0, 30);
  central.writeUInt16LE(0, 32);
  central.writeUInt16LE(0, 34);
  central.writeUInt16LE(0, 36);
  central.writeUInt32LE(0, 38);
  central.writeUInt32LE(localOffset, 42);

  const centralOffset = local.length + nameBuf.length + data.length;
  const centralSize = central.length + nameBuf.length;

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(centralOffset, 16);

  return Buffer.concat([local, nameBuf, data, central, nameBuf, eocd]);
}

function apk(version = '1.4.0', versionCode = 14, method: 0 | 8 = 8): Buffer {
  return zipWithEntry(
    'assets/app.config',
    JSON.stringify({ expo: { version, android: { versionCode } } }),
    method,
  );
}

describe('readVersionFromApk', () => {
  it('čita verziju iz kompresovanog `assets/app.config`', () => {
    expect(readVersionFromApk(apk('1.4.2', 142))).toEqual({
      version: '1.4.2',
      buildNumber: 142,
    });
  });

  it('čita i uskladišten (nestisnut) zapis', () => {
    expect(readVersionFromApk(apk('2.0.1', 201, 0))).toEqual({
      version: '2.0.1',
      buildNumber: 201,
    });
  });

  it('vraća null kad fajl nije ZIP — ne baca', () => {
    // Vrijednost je važna: admin tada unosi verziju ručno, a APK se i dalje može
    // objaviti. Bacanje bi blokiralo objavu zbog načina pakovanja.
    expect(readVersionFromApk(Buffer.from('nije zip'))).toEqual({
      version: null,
      buildNumber: null,
    });
  });

  it('vraća null kad u arhivi nema app.config', () => {
    const without = zipWithEntry('assets/index.android.bundle', 'x');
    expect(readVersionFromApk(without).version).toBeNull();
  });
});

describe('compareVersions', () => {
  it.each([
    ['1.4.0', '1.3.9', 1],
    ['1.3.9', '1.4.0', -1],
    ['1.4.0', '1.4.0', 0],
    ['2.0.0', '1.99.99', 1],
  ])('%s vs %s → %s', (a, b, expected) => {
    expect(compareVersions(a, b)).toBe(expected);
  });
});

describe('buildNumberFromVersion', () => {
  it('raste sa verzijom i čitljiv je', () => {
    expect(buildNumberFromVersion('1.4.0')).toBe(10400);
    expect(buildNumberFromVersion('1.4.1')).toBeGreaterThan(
      buildNumberFromVersion('1.4.0'),
    );
  });
});

describe('AppReleaseService.upload', () => {
  function setup(existing: Array<{ version: string }> = []) {
    const prisma = {
      appRelease: {
        findFirst: jest.fn().mockResolvedValue(existing[0] ?? null),
        findMany: jest.fn().mockResolvedValue(existing),
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
          id: 7,
          publishedAt: new Date('2026-11-20T09:00:00Z'),
          ...data,
        })),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    const storage = {
      storeAppRelease: jest.fn().mockResolvedValue({
        relativePath: 'app-releases/boiler-control-1.4.0-14.apk',
        mimeType: 'application/vnd.android.package-archive',
        originalName: 'app.apk',
      }),
      deleteFile: jest.fn().mockResolvedValue(undefined),
    };
    const service = new AppReleaseService(prisma as never, storage as never);
    return { service, prisma, storage };
  }

  const file = {
    buffer: apk('1.4.0', 14),
    mimetype: 'application/vnd.android.package-archive',
    size: 1024,
    originalname: 'app.apk',
  };

  it('objavljuje verziju pročitanu iz APK-a', async () => {
    const { service, prisma } = setup();

    const result = await service.upload({ file });

    expect(prisma.appRelease.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          version: '1.4.0',
          buildNumber: 14,
          sizeBytes: 1024,
        }),
      }),
    );
    expect(result.downloadUrl).toBe('/api/app-releases/7/apk');
    expect(downloadUrlFor(7)).toBe(result.downloadUrl);
  });

  it('odbija verziju koja nije veća od posljednje objavljene', async () => {
    const { service, storage } = setup([{ version: '1.4.0' }]);

    await expect(service.upload({ file })).rejects.toThrow(
      /nije veća od posljednje objavljene/,
    );
    // Ništa nije upisano: ni fajl, ni red.
    expect(storage.storeAppRelease).not.toHaveBeenCalled();
  });

  it('ručna korekcija verzije ima prednost pred onom iz APK-a', async () => {
    const { service, prisma } = setup([{ version: '1.3.0' }]);

    await service.upload({ file, version: '1.5.0' });

    expect(prisma.appRelease.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ version: '1.5.0' }),
      }),
    );
  });

  it('bez pročitane verzije traži ručni unos umjesto da izmišlja broj', async () => {
    const { service, storage } = setup();

    await expect(
      service.upload({ file: { ...file, buffer: Buffer.from('nije apk') } }),
    ).rejects.toThrow(/unesite je ručno/);
    expect(storage.storeAppRelease).not.toHaveBeenCalled();
  });

  it('ako upis u bazu padne, fajl se briše', async () => {
    const { service, prisma, storage } = setup();
    prisma.appRelease.create.mockRejectedValueOnce(new Error('db down'));

    await expect(service.upload({ file })).rejects.toThrow('db down');
    expect(storage.deleteFile).toHaveBeenCalledWith(
      'app-releases/boiler-control-1.4.0-14.apk',
    );
  });
});

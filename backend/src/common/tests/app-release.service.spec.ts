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
  function setup(
    existing: Array<{ version: string; isPublished?: boolean }> = [],
  ) {
    // `latestPublished` i `highestEver` oba čitaju `findMany`; razlika je u
    // `where` filteru, pa se ovdje poštuje — inače test ne bi razlikovao
    // „najnovija vidljiva" od „najviša ikad".
    const rows = existing.map((row, index) => ({
      id: index + 1,
      buildNumber: 1,
      sizeBytes: 1,
      notes: null,
      isPublished: row.isPublished ?? true,
      publishedAt: new Date(2026, 10, 1 + index),
      ...row,
    }));

    const prisma = {
      appRelease: {
        findMany: jest.fn((args?: { where?: { isPublished?: boolean } }) =>
          Promise.resolve(
            args?.where?.isPublished === true
              ? rows.filter((row) => row.isPublished)
              : rows,
          ),
        ),
        create: jest.fn(
          async ({ data }: { data: Record<string, unknown> }) => ({
            id: 7,
            publishedAt: new Date('2026-11-20T09:00:00Z'),
            ...data,
          }),
        ),
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

  it('poruka o nedostajućem fajlu kaže i da zahtjev nije bio multipart', async () => {
    const { service, storage } = setup();

    await expect(service.upload({ file: undefined as never })).rejects.toThrow(
      /multipart\/form-data/,
    );
    expect(storage.storeAppRelease).not.toHaveBeenCalled();
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

/**
 * `F15` — pravilo vidljivosti i pravilo istorije su **namjerno različita**.
 *
 * Ovo je jedina odluka u `AppRelease` sistemu koja se lako pobrka, pa je
 * zapisana testom, a ne samo komentarom.
 */
describe('AppReleaseService — skrivena verzija', () => {
  const releaseRow = (overrides: Record<string, unknown>) => ({
    id: 1,
    buildNumber: 1,
    sizeBytes: 1,
    notes: null,
    isPublished: true,
    publishedAt: new Date('2026-11-01T09:00:00Z'),
    ...overrides,
  });

  function serviceWith(rows: Array<Record<string, unknown>>) {
    const prisma = {
      appRelease: {
        findMany: jest.fn((args?: { where?: { isPublished?: boolean } }) =>
          Promise.resolve(
            args?.where?.isPublished === true
              ? rows.filter((row) => row.isPublished === true)
              : rows,
          ),
        ),
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    const storage = {
      storeAppRelease: jest.fn().mockResolvedValue({
        relativePath: 'app-releases/boiler-control-1.5.0-15.apk',
        mimeType: 'application/vnd.android.package-archive',
        originalName: 'app.apk',
      }),
      deleteFile: jest.fn(),
    };
    return {
      service: new AppReleaseService(prisma as never, storage as never),
      prisma,
      storage,
    };
  }

  it('skrivena verzija se NE nudi korisnicima, ali ostaje u historiji', async () => {
    const { service } = serviceWith([
      releaseRow({ id: 2, version: '1.6.0', isPublished: false }),
      releaseRow({ id: 1, version: '1.5.0', isPublished: true }),
    ]);

    // Ono što klijent dobija:
    expect((await service.latestPublished())?.version).toBe('1.5.0');
    // Ono što admin vidi:
    expect(await service.list()).toHaveLength(2);
  });

  it('najnovija je najviša vidljiva verzija, ne najskorije objavljena', async () => {
    const { service } = serviceWith([
      // Starija verzija ponovo prikazana poslije novije — bez ovog pravila
      // korisnici bi dobili 1.4.0 kao „novu".
      releaseRow({
        id: 3,
        version: '1.4.0',
        publishedAt: new Date('2026-11-20T09:00:00Z'),
      }),
      releaseRow({ id: 2, version: '1.6.0' }),
    ]);

    expect((await service.latestPublished())?.version).toBe('1.6.0');
  });

  it('ako su sve verzije skrivene, nema ponude', async () => {
    const { service } = serviceWith([
      releaseRow({ id: 1, version: '1.6.0', isPublished: false }),
    ]);

    expect(await service.latestPublished()).toBeNull();
  });

  it('upload se poredi sa najvišom ikad, uključujući skrivene', async () => {
    const { service, prisma, storage } = serviceWith([
      releaseRow({ id: 2, version: '1.6.0', isPublished: false }),
      releaseRow({ id: 1, version: '1.5.0', isPublished: true }),
    ]);

    const file = {
      buffer: Buffer.concat([
        Buffer.from([0x50, 0x4b, 0x03, 0x04]),
        Buffer.from('x'),
      ]),
      mimetype: 'application/vnd.android.package-archive',
      size: 8,
      originalname: 'app.apk',
    };

    // 1.5.0 je veća od vidljive 1.5.0? Nije — jednaka je. Ali 1.6.0 je
    // skrivena i dalje postoji, pa 1.5.0 ne smije proći kao „nova".
    await expect(service.upload({ file, version: '1.5.0' })).rejects.toThrow(
      /nije veća od posljednje objavljene \(1\.6\.0\)/,
    );
    expect(storage.storeAppRelease).not.toHaveBeenCalled();
    expect(prisma.appRelease.create).not.toHaveBeenCalled();
  });
});

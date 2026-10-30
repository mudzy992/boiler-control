import 'reflect-metadata';

// `src/generated/prisma` nastaje sa `prisma generate`, što u sandboxu pada
// (binaries.prisma.sh nedostupan). Mock sprječava da se pravi modul uopšte
// učita — isti obrazac kao `src/common/tests/stub-endpoint.spec.ts`.
jest.mock('../../../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

import { BadRequestException } from '@nestjs/common';
import { GasReadingService } from '../gas.reading.service';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { FileStorageService } from '../../../common/file-storage.service';

/**
 * FEAT-7 — B-017: historijsko očitanje se upoređivalo s GLOBALNO najnovijim.
 *
 * Prije: `findFirst({ where: { userId }, orderBy: { readingDate: 'desc' } })`
 * — bez ograničenja datuma. Zapis s ranijim datumom i manjim stanjem brojila
 * bio je odbijen iako je niz hronološki rastao.
 *
 * Sada se gledaju stvarni hronološki susjedi i monotonost se provjerava u oba
 * smjera, a potrošnja narednog zapisa se koriguje u istoj transakciji.
 *
 * Test koristi lažnu bazu u memoriji koja STVARNO poštuje `lt`/`gt`/`gte`/
 * `lte` filtere — bez toga test ne bi dokazivao razliku između starog i novog
 * ponašanja.
 */

type Row = {
  id: number;
  userId: number;
  readingDate: Date;
  counterValue: number;
  consumption: number | null;
  createdAt: Date;
  isInvoiceReference: boolean;
  referenceMonth: Date | null;
  meterImagePath: string | null;
  invoicePdfPath: string | null;
  invoiceUploadedAt: Date | null;
  invoiceGasPriceExVat: number | null;
};

const DAY = 86_400_000;
const day = (offset: number) => new Date(Date.UTC(2024, 0, 1) + offset * DAY);

function makeRow(partial: Partial<Row> & { id: number }): Row {
  return {
    userId: 1,
    readingDate: day(0),
    counterValue: 0,
    consumption: 0,
    createdAt: day(0),
    isInvoiceReference: false,
    referenceMonth: null,
    meterImagePath: null,
    invoicePdfPath: null,
    invoiceUploadedAt: null,
    invoiceGasPriceExVat: null,
    ...partial,
  };
}

function matchesDateFilter(
  value: Date,
  filter: Record<string, Date> | undefined,
) {
  if (!filter) return true;
  const t = value.getTime();
  if (filter.lt !== undefined && !(t < filter.lt.getTime())) return false;
  if (filter.gt !== undefined && !(t > filter.gt.getTime())) return false;
  if (filter.gte !== undefined && !(t >= filter.gte.getTime())) return false;
  if (filter.lte !== undefined && !(t <= filter.lte.getTime())) return false;
  return true;
}

/** Lažna baza koja poštuje `orderBy` i filtere datuma. */
function createFakePrisma(initial: Row[] = []) {
  const rows = [...initial];
  let nextId = initial.reduce((m, r) => Math.max(m, r.id), 0) + 1;
  const calls: string[] = [];

  const gasReading = {
    findFirst: jest.fn(
      (args: {
        where?: { userId?: number; readingDate?: Record<string, Date> };
        orderBy?: { readingDate: 'asc' | 'desc' };
      }) => {
        const where = args.where ?? {};
        let out = rows.filter((r) => r.userId === where.userId);
        out = out.filter((r) =>
          matchesDateFilter(r.readingDate, where.readingDate),
        );
        const dir = args.orderBy?.readingDate ?? 'asc';
        out.sort((a, b) =>
          dir === 'asc'
            ? a.readingDate.getTime() - b.readingDate.getTime()
            : b.readingDate.getTime() - a.readingDate.getTime(),
        );
        return Promise.resolve(out[0] ?? null);
      },
    ),
    create: jest.fn((args: { data: Record<string, unknown> }) => {
      const row = makeRow({ ...(args.data as Partial<Row>), id: nextId++ });
      rows.push(row);
      return Promise.resolve(row);
    }),
    // Servis na kraju `create` ponovo čita zapis (gas.reading.service.ts:173)
    // da bi vratio mapiran odgovor.
    findUnique: jest.fn((args: { where: { id: number } }) =>
      Promise.resolve(rows.find((r) => r.id === args.where.id) ?? null),
    ),
    update: jest.fn(
      (args: { where: { id: number }; data: Record<string, unknown> }) => {
        const row = rows.find((r) => r.id === args.where.id);
        if (!row) throw new Error('update: zapis nije pronađen');
        Object.assign(row, args.data);
        return Promise.resolve(row);
      },
    ),
  };

  const prisma = {
    user: {
      findUnique: jest.fn(() => Promise.resolve({ id: 1 })),
    },
    gasReading,
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      calls.push('$transaction');
      return fn({ gasReading });
    }),
  };

  return {
    prisma: prisma as unknown as PrismaService,
    gasReading,
    calls,
    get rows() {
      return rows;
    },
  };
}

const fileStorage = {} as FileStorageService;

function makeService(fake: ReturnType<typeof createFakePrisma>) {
  return new GasReadingService(fake.prisma, fileStorage);
}

describe('GasReadingService.create — hronologija (FEAT-7 / B-017)', () => {
  const ENV_KEY = 'GAS_STRICT_VALIDATION';
  const original = process.env[ENV_KEY];

  beforeEach(() => {
    delete process.env[ENV_KEY];
  });

  afterAll(() => {
    if (original === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = original;
  });

  it('prihvata historijski unos koji je hronološki ispravan (bio je odbijen)', async () => {
    // Postoji kasniji zapis sa stanjem 200. Unos ranijeg datuma sa stanjem 100
    // je ispravan: niz 100 -> 200 raste s vremenom.
    const fake = createFakePrisma([
      makeRow({
        id: 1,
        readingDate: day(10),
        counterValue: 200,
        consumption: 0,
      }),
    ]);
    const service = makeService(fake);

    const result = await service.create(1, {
      counterValue: 100,
      readingDate: day(0).toISOString(),
    });

    expect(result.counterValue).toBe(100);
    expect(result.consumption).toBe(0); // nema prethodnika
  });

  it('koriguje potrošnju narednog zapisa u istoj transakciji', async () => {
    // Naredni zapis (200) je dotad imao consumption izračunat od starog
    // prethodnika; nakon umetanja 100 ispred njega mora biti 200 - 100 = 100.
    const fake = createFakePrisma([
      makeRow({
        id: 1,
        readingDate: day(10),
        counterValue: 200,
        consumption: 999,
      }),
    ]);
    const service = makeService(fake);

    await service.create(1, {
      counterValue: 100,
      readingDate: day(0).toISOString(),
    });

    expect(fake.calls).toContain('$transaction');
    const next = fake.rows.find((r) => r.id === 1)!;
    expect(next.consumption).toBe(100);
  });

  it('računa potrošnju od hronološkog prethodnika, ne od globalno najnovijeg', async () => {
    const fake = createFakePrisma([
      makeRow({
        id: 1,
        readingDate: day(0),
        counterValue: 100,
        consumption: 0,
      }),
      makeRow({
        id: 2,
        readingDate: day(20),
        counterValue: 500,
        consumption: 400,
      }),
    ]);
    const service = makeService(fake);

    // Unos između: 100 -> 250 -> 500. Potrošnja novog = 250 - 100 = 150.
    const result = await service.create(1, {
      counterValue: 250,
      readingDate: day(10).toISOString(),
    });

    expect(result.consumption).toBe(150);
    // Naredni (500) se sada računa od 250, ne od 100.
    expect(fake.rows.find((r) => r.id === 2)!.consumption).toBe(250);
  });

  it('odbija unos manji od hronološkog prethodnika', async () => {
    const fake = createFakePrisma([
      makeRow({
        id: 1,
        readingDate: day(0),
        counterValue: 300,
        consumption: 0,
      }),
    ]);
    const service = makeService(fake);

    await expect(
      service.create(1, {
        counterValue: 250,
        readingDate: day(10).toISOString(),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('odbija unos veći od hronološki narednog (narušio bi monotonost)', async () => {
    const fake = createFakePrisma([
      makeRow({
        id: 1,
        readingDate: day(10),
        counterValue: 200,
        consumption: 0,
      }),
    ]);
    const service = makeService(fake);

    await expect(
      service.create(1, {
        counterValue: 250,
        readingDate: day(0).toISOString(),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rollback: GAS_STRICT_VALIDATION=off vraća staro ponašanje (odbija historijski unos)', async () => {
    process.env[ENV_KEY] = 'off';
    const fake = createFakePrisma([
      makeRow({
        id: 1,
        readingDate: day(10),
        counterValue: 200,
        consumption: 0,
      }),
    ]);
    const service = makeService(fake);

    // Staro ponašanje: uporedba s globalno najnovijim (200), pa 100 pada.
    await expect(
      service.create(1, {
        counterValue: 100,
        readingDate: day(0).toISOString(),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(fake.calls).not.toContain('$transaction');
  });
});

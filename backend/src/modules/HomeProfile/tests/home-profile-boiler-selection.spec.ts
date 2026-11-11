import type { CreateHomeProfileDto } from '../dto/create-home-profile.dto';
import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { HomeProfileService } from '../home.profile.service';
import { findBoilerFamily } from '../../BoilerCatalog/boiler-catalog';

/**
 * Kategorički odabir kotla: **porodica + snaga** mora biti stvarna kombinacija
 * iz kataloga (`19` §1, dopuna 2026-11-18).
 *
 * Zašto ovaj test postoji: `boilerCatalogId` imenuje porodicu, a porodica
 * pokriva više snaga (ecoTEC pro VUW: 24, 28, 30 kW). Bez provjere bi forma
 * mogla upisati „ecoTEC pro, 35 kW" — kombinaciju koja ne postoji — i taj broj
 * bi poslije izgledao kao podatak proizvođača. Isto tako, „porodica bez snage"
 * izgleda kao da snaga nije poznata, a u stvari nije odabrana.
 *
 * Servis se testira kroz `create`/`update` sa mock `prisma`, jer je pravilo
 * međupoljno: DTO ne zna katalog, pa se ne može dokazati na DTO nivou.
 */

// Tip je eksplicitan: litere u `VALID` (`'EPS'`, `'RADIATOR'`) bi bez njega
// ostale `string`, pa `service.create` ne bi primio objekat za `tsc` — iako
// test radi, jer enum vrijednosti su iste kao te literale.
const VALID: CreateHomeProfileDto = {
  floorArea: 150,
  ceilingHeight: 2.6,
  insulationType: 'EPS',
  insulationThickness: 10,
  windowType: 'DOUBLE_GLAZED',
  heatingType: 'RADIATOR',
  constructionYear: 1998,
  hasFloorHeating: false,
  targetMorningTemp: 21,
  targetDayTemp: 22,
  targetNightTemp: 19,
};

const FAMILY_WITH_OUTPUTS = 'vaillant-ecotec-pro-vuw';
const FAMILY_WITHOUT_OUTPUTS = 'bosch-gaz-6000-w';

function makeService(existing: Record<string, unknown> | null = null) {
  const created: Array<Record<string, unknown>> = [];
  const updated: Array<Record<string, unknown>> = [];

  const prisma = {
    homeProfile: {
      create: jest.fn(({ data }: { data: Record<string, unknown> }) => {
        created.push(data);
        return { id: 7, ...data };
      }),
      update: jest.fn(({ data }: { data: Record<string, unknown> }) => {
        updated.push(data);
        return { id: existing?.id ?? 1, ...data };
      }),
      findFirst: jest.fn(() => Promise.resolve(existing)),
    },
    user: {
      findUnique: jest.fn(() => Promise.resolve({ activeHomeProfileId: 1 })),
      update: jest.fn(),
    },
    $transaction: jest.fn((fn: (tx: unknown) => unknown) =>
      Promise.resolve(fn(prisma)),
    ),
  };

  const service = new HomeProfileService(prisma as never);
  return { service, created, updated, prisma };
}

async function createError(
  dto: Partial<CreateHomeProfileDto>,
): Promise<string> {
  const { service } = makeService();
  try {
    await service.create(1, { ...VALID, ...dto });
    return '';
  } catch (error) {
    if (error instanceof BadRequestException) {
      return String((error.getResponse() as { message?: unknown }).message);
    }
    throw error;
  }
}

describe('HomeProfileService — porodica i snaga kotla', () => {
  it('katalog stvarno nudi više snaga za odabranu porodicu', () => {
    // Ako ovo padne, testovi ispod provjeravaju nepostojeću situaciju.
    const family = findBoilerFamily(FAMILY_WITH_OUTPUTS);
    expect(family?.outputsKw).toEqual([24, 28, 30]);
  });

  it('prihvata snagu koja postoji u katalogu i upisuje oba polja', async () => {
    const { service, created } = makeService();
    await service.create(1, {
      ...VALID,
      boilerCatalogId: FAMILY_WITH_OUTPUTS,
      boilerOutputKw: 24,
    });

    expect(created[0].boilerCatalogId).toBe(FAMILY_WITH_OUTPUTS);
    expect(created[0].boilerOutputKw).toBe(24);
  });

  it('odbija snagu koje nema u katalogu, i kaže koje postoje', async () => {
    const message = await createError({
      boilerCatalogId: FAMILY_WITH_OUTPUTS,
      boilerOutputKw: 35,
    });

    expect(message).toContain('35');
    expect(message).toContain('24, 28, 30');
  });

  it('odbija porodicu sa snagama ako snaga nije odabrana', async () => {
    // „Nije odabrano" i „snaga je poznata" ne smiju izgledati isto u zapisu.
    const message = await createError({ boilerCatalogId: FAMILY_WITH_OUTPUTS });
    expect(message).toContain('potrebno odabrati snagu');
  });

  it('odbija snagu uz porodicu koja snage ne navodi', async () => {
    const message = await createError({
      boilerCatalogId: FAMILY_WITHOUT_OUTPUTS,
      boilerOutputKw: 20,
    });
    expect(message).toContain(FAMILY_WITHOUT_OUTPUTS);
  });

  it('dozvoljava profil bez kotla i bez snage', async () => {
    const { service, created } = makeService();
    await service.create(1, { ...VALID });
    expect(created[0].boilerCatalogId).toBeNull();
    expect(created[0].boilerOutputKw).toBeNull();
  });

  it('odbija snagu bez porodice — broj bez uređaja nije podatak', async () => {
    const message = await createError({ boilerOutputKw: 24 });
    expect(message).toContain('bez boilerCatalogId');
  });

  it('promjena modela bez nove snage odbacuje staru snagu i traži novu', async () => {
    // Stara snaga (25,5 kW iz `ecoTEC plus`) pripada starom uređaju. Da se
    // zadrži, zapis bi tvrdio da novi model ima istu snagu — a `ecoTEC pro`
    // ima 24/28/30. Zato zahtjev pada, umjesto da tiho prođe sa 25,5.
    const { service, updated } = makeService({
      id: 1,
      boilerCatalogId: 'vaillant-ecotec-plus-vuw',
      boilerOutputKw: 25.5,
    });

    await expect(
      service.update(1, 1, { boilerCatalogId: FAMILY_WITH_OUTPUTS }),
    ).rejects.toThrow(/potrebno odabrati snagu/);
    expect(updated).toHaveLength(0);
  });

  it('update prihvata novu snagu uz novu porodicu', async () => {
    const { service, updated } = makeService({
      id: 1,
      boilerCatalogId: 'vaillant-ecotec-plus-vuw',
      boilerOutputKw: 25.5,
    });
    await service.update(1, 1, {
      boilerCatalogId: FAMILY_WITH_OUTPUTS,
      boilerOutputKw: 28,
    });

    expect(updated[0].boilerCatalogId).toBe(FAMILY_WITH_OUTPUTS);
    expect(updated[0].boilerOutputKw).toBe(28);
  });

  it('update bez dodirivanja kotla ne mijenja snagu', async () => {
    const { service, updated } = makeService({
      id: 1,
      boilerCatalogId: FAMILY_WITH_OUTPUTS,
      boilerOutputKw: 24,
    });
    await service.update(1, 1, { floorArea: 160 });

    expect(updated[0].boilerOutputKw).toBeUndefined();
    expect(updated[0].floorArea).toBe(160);
  });
});

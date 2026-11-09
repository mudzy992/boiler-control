import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateHomeProfileDto } from '../dto/create-home-profile.dto';
import { UpdateHomeProfileDto } from '../dto/update-home-profile.dto';

/**
 * Najviša polazna koju sistem dozvoljava (`19` §2, odluka vlasnika 2026-11-08).
 *
 * Polje smije samo **sužavati** zaključani raspon 30–55; nikad ga ne širi.
 * Zato su i granice iste — ako bi DTO dozvolio 60, odluka bi zaobišla granicu
 * koja je već donesena.
 */

const validCreate = {
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

async function createErrors(extra: Record<string, unknown>) {
  const dto = plainToInstance(CreateHomeProfileDto, { ...validCreate, ...extra });
  const errors = await validate(dto as object);
  return errors.map((error) => error.property);
}

describe('CreateHomeProfileDto — maxHeatingFlowC', () => {
  it('polje je opciono — bez njega profil ostaje validan', async () => {
    expect(await createErrors({})).toEqual([]);
  });

  it('prihvata granice raspona 30 i 55', async () => {
    expect(await createErrors({ maxHeatingFlowC: 30 })).toEqual([]);
    expect(await createErrors({ maxHeatingFlowC: 55 })).toEqual([]);
  });

  it('odbija 29, 56 i vrijednost koja nije broj', async () => {
    expect(await createErrors({ maxHeatingFlowC: 29 })).toEqual(['maxHeatingFlowC']);
    expect(await createErrors({ maxHeatingFlowC: 56 })).toEqual(['maxHeatingFlowC']);
    expect(await createErrors({ maxHeatingFlowC: '45' })).toEqual([
      'maxHeatingFlowC',
    ]);
  });
});

describe('CreateHomeProfileDto — boilerCatalogId', () => {
  it('prihvata id iz kataloga', async () => {
    expect(await createErrors({ boilerCatalogId: 'vaillant-ecotec-plus-vuw' })).toEqual(
      [],
    );
    expect(await createErrors({ boilerCatalogId: 'bosch-condens-7000-wp' })).toEqual(
      [],
    );
  });

  it('odbija model kojeg nema u katalogu', async () => {
    expect(await createErrors({ boilerCatalogId: 'moj-bojler-2000' })).toEqual([
      'boilerCatalogId',
    ]);
  });

  it('prima zastarjeli slobodan tekst kao string, ali ga ne koristi za odluku', async () => {
    // `boilerModel` ostaje samo da stari klijenti ne puknu (`19` §1).
    expect(await createErrors({ boilerModel: 'Bosch' })).toEqual([]);
    expect(await createErrors({ boilerModel: 123 as unknown as string })).toEqual([
      'boilerModel',
    ]);
  });
});

describe('UpdateHomeProfileDto — maxHeatingFlowC', () => {
  async function updateErrors(extra: Record<string, unknown>) {
    const dto = plainToInstance(UpdateHomeProfileDto, extra);
    const errors = await validate(dto as object);
    return errors.map((error) => error.property);
  }

  it('prihvata isti raspon kao kreiranje', async () => {
    expect(await updateErrors({ maxHeatingFlowC: 42 })).toEqual([]);
    expect(await updateErrors({ maxHeatingFlowC: 30 })).toEqual([]);
  });

  it('odbija vrijednost izvan raspona', async () => {
    expect(await updateErrors({ maxHeatingFlowC: 60 })).toEqual(['maxHeatingFlowC']);
    expect(await updateErrors({ maxHeatingFlowC: 20 })).toEqual(['maxHeatingFlowC']);
  });

  it('ne dira polje kad nije poslano', async () => {
    expect(await updateErrors({ homeName: 'Stan' })).toEqual([]);
  });
});

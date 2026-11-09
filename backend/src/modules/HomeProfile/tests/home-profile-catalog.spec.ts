jest.mock('../../../prisma/prisma.service', () => ({
  PrismaService: class {},
}));

import { HomeProfileService } from '../home.profile.service';

/**
 * Katalog za odabir modela (`19` §1). Klijent mora dobiti i **zašto** za neki
 * model nema savjeta o snižavanju — inače bi izbor izgledao proizvoljan.
 */

function setup() {
  const service = new HomeProfileService({} as never);
  return { service };
}

describe('HomeProfileService.boilerCatalog', () => {
  it('vraća raspon proizvoda i zapise sa sigurnosnim bitom', () => {
    const { service } = setup();
    const catalog = service.boilerCatalog();

    expect(catalog.envelope).toEqual({ minC: 30, maxC: 55 });
    expect(catalog.families.length).toBeGreaterThan(0);

    for (const family of catalog.families) {
      expect(typeof family.id).toBe('string');
      expect(typeof family.flowAdviceAllowed).toBe('boolean');
      expect(['VERIFIED_MANUAL', 'PARTIAL', 'TO_VERIFY']).toContain(
        family.specStatus,
      );
    }
  });

  it('potvrđuje savjet samo za potvrđene modele sa odvojenim krugovima', () => {
    const { service } = setup();
    const { families } = service.boilerCatalog();

    const verified = families.find(
      (family) => family.id === 'vaillant-ecotec-plus-vuw',
    );
    expect(verified?.flowAdviceAllowed).toBe(true);

    const unverified = families.find(
      (family) => family.id === 'vaillant-ecotec-pro',
    );
    expect(unverified?.specStatus).toBe('TO_VERIFY');
    expect(unverified?.flowAdviceAllowed).toBe(false);

    for (const family of families) {
      if (family.specStatus !== 'VERIFIED_MANUAL') {
        expect(family.flowAdviceAllowed).toBe(false);
      }
    }
  });

  it('ne izlaže interne izvore i parametre koje klijent ne koristi', () => {
    const { service } = setup();
    const [first] = service.boilerCatalog().families;
    expect(first).not.toHaveProperty('source');
    expect(first).not.toHaveProperty('heatingFlowLimitParam');
  });
});

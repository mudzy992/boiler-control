jest.mock('../../../prisma/prisma.service', () => ({
  PrismaService: class {},
}));
jest.mock('../dto/create-home-profile.dto', () => ({
  CreateHomeProfileDto: class {},
}));
jest.mock('../dto/update-home-profile.dto', () => ({
  UpdateHomeProfileDto: class {},
}));

import { HomeProfileService } from '../home.profile.service';

function makeService(prisma: unknown): HomeProfileService {
  return Reflect.construct(HomeProfileService, [prisma]);
}

function profileRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 10,
    userId: 1,
    homeName: null,
    location: null,
    floorArea: 150,
    ceilingHeight: 2.6,
    insulationType: 'EPS',
    insulationThickness: 10,
    windowType: 'DOUBLE_GLAZED',
    heatingType: 'RADIATOR',
    constructionYear: 2020,
    numberOfResidents: 0,
    boilerModel: null,
    hasFloorHeating: false,
    targetMorningTemp: 22,
    targetDayTemp: 20,
    targetNightTemp: 18,
    preferredScheduleNotes: null,
    learningOffset: 0,
    learningConfidence: 0,
    seasonMode: 'WINTER',
    createdAt: new Date('2026-11-01T00:00:00.000Z'),
    updatedAt: new Date('2026-11-01T00:00:00.000Z'),
    thermostatDevices: [],
    ...overrides,
  };
}

/**
 * MO2-20: GET /api/home-profiles is a read endpoint. It must not persist
 * activeHomeProfileId, must not invent a location placeholder, and must keep
 * falsy profile values intact for the mobile edit form.
 */
describe('MO2-20 HomeProfileService read contract', () => {
  it('findAll does not write activeHomeProfileId and preserves null/0/false', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          homeLocation: null,
          activeHomeProfileId: null,
        }),
        update: jest.fn(),
      },
      homeProfile: {
        findMany: jest.fn().mockResolvedValue([profileRow()]),
      },
    };

    const result = await makeService(prisma).findAll(1);

    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(result).toHaveLength(1);
    expect(result[0].location).toBeNull();
    expect(result[0].numberOfResidents).toBe(0);
    expect(result[0].hasFloorHeating).toBe(false);
  });

  it('findAll uses the persisted activeHomeProfileId for isActive', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          homeLocation: null,
          activeHomeProfileId: 20,
        }),
        update: jest.fn(),
      },
      homeProfile: {
        findMany: jest
          .fn()
          .mockResolvedValue([profileRow({ id: 10 }), profileRow({ id: 20 })]),
      },
    };

    const result = await makeService(prisma).findAll(1);

    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(result.map((row) => row.isActive)).toEqual([false, true]);
  });

  it('findAll falls back to user.homeLocation only when profile.location is null', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          homeLocation: 'Sarajevo',
          activeHomeProfileId: 10,
        }),
        update: jest.fn(),
      },
      homeProfile: {
        findMany: jest.fn().mockResolvedValue([profileRow()]),
      },
    };

    const result = await makeService(prisma).findAll(1);

    expect(result[0].location).toBe('Sarajevo');
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

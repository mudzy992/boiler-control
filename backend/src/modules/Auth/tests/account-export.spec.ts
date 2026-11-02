jest.mock('../../../prisma/prisma.service', () => ({
  PrismaService: class {},
}));

import { NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import { AccountExportService } from '../account-export.service';
import {
  ACCOUNT_EXPORT_ENABLED_FLAG,
  ACCOUNT_EXPORT_MAX_BYTES_FLAG,
  ACCOUNT_EXPORT_MAX_ROWS_FLAG,
  getAccountExportConfig,
} from '../account-export.config';

const COLLECTIONS = [
  'homeProfile',
  'heatingIntervalLearning',
  'thermostatDevice',
  'thermostatProgram',
  'heatingEvent',
  'recommendation',
  'boilerHistory',
  'gasReading',
  'gasPriceHistory',
  'notification',
  'notificationPreference',
  'userDevice',
  'refreshToken',
] as const;

const OUTPUT_COLLECTIONS = [
  'homeProfiles',
  'heatingIntervalLearnings',
  'thermostatDevices',
  'thermostatPrograms',
  'heatingEvents',
  'recommendations',
  'boilerHistories',
  'gasReadings',
  'gasPriceHistory',
  'notifications',
  'notificationPreferences',
  'devices',
  'sessions',
] as const;

const ENV_KEYS = [
  ACCOUNT_EXPORT_ENABLED_FLAG,
  ACCOUNT_EXPORT_MAX_ROWS_FLAG,
  ACCOUNT_EXPORT_MAX_BYTES_FLAG,
] as const;
const savedEnv = Object.fromEntries(
  ENV_KEYS.map((key) => [key, process.env[key]]),
);

function accountRow(id = 1) {
  return {
    id,
    email: `owner-${id}@example.test`,
    username: `owner-${id}`,
    name: 'Owner',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    homeLocation: 'Springfield',
    avatarUrl: null,
    isActive: true,
    lastLoginAt: null,
    locale: 'bs-BA',
    plan: 'FREE',
    prefersDarkMode: false,
    role: 'USER',
    timezone: 'Europe/Sarajevo',
    activeHomeProfileId: null,
    gasPriceExVat: 0,
    currentBoilerFlowTemp: 0,
    currentBoilerFlowTempSetAt: null,
  };
}

function makeService() {
  const prisma: Record<string, any> = {
    user: { findUnique: jest.fn().mockResolvedValue(accountRow()) },
  };
  for (const collection of COLLECTIONS) {
    prisma[collection] = {
      findMany: jest.fn().mockImplementation((argument: { where: unknown }) => {
        if (collection === 'gasReading') {
          return Promise.resolve([
            {
              id: 90,
              userId: 1,
              readingDate: new Date('2026-01-01T00:00:00.000Z'),
              meterImagePath: 'private/meter-path-secret.jpg',
              invoicePdfPath: 'private/invoice-path-secret.pdf',
              meterImageMime: 'image/jpeg',
              invoicePdfMime: 'application/pdf',
              meterImageOriginalName: 'meter.jpg',
              invoicePdfOriginalName: 'invoice.pdf',
            },
          ]);
        }
        return Promise.resolve([
          {
            id: 10,
            userId: 1,
            marker: `${collection}-owner`,
            where: argument.where,
          },
        ]);
      }),
    };
  }
  const service = Reflect.construct(AccountExportService, [
    prisma,
  ]) as AccountExportService;
  return { service, prisma };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-11-02T12:00:00.000Z'));
  process.env[ACCOUNT_EXPORT_ENABLED_FLAG] = 'on';
  delete process.env[ACCOUNT_EXPORT_MAX_ROWS_FLAG];
  delete process.env[ACCOUNT_EXPORT_MAX_BYTES_FLAG];
});

afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
  for (const key of ENV_KEYS) {
    const value = savedEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('account export configuration', () => {
  it('is off by default with bounded limits', () => {
    expect(getAccountExportConfig({})).toEqual({
      enabled: false,
      maxRowsPerCollection: 1000,
      maxBytes: 5 * 1024 * 1024,
    });
  });

  it('accepts explicit on and valid limits but fails closed for invalid values', () => {
    expect(
      getAccountExportConfig({
        [ACCOUNT_EXPORT_ENABLED_FLAG]: 'on',
        [ACCOUNT_EXPORT_MAX_ROWS_FLAG]: '25',
        [ACCOUNT_EXPORT_MAX_BYTES_FLAG]: '2048',
      }),
    ).toEqual({ enabled: true, maxRowsPerCollection: 25, maxBytes: 2048 });
    expect(
      getAccountExportConfig({
        [ACCOUNT_EXPORT_ENABLED_FLAG]: 'true',
        [ACCOUNT_EXPORT_MAX_ROWS_FLAG]: '0',
        [ACCOUNT_EXPORT_MAX_BYTES_FLAG]: '10',
      }),
    ).toEqual({
      enabled: false,
      maxRowsPerCollection: 1000,
      maxBytes: 5 * 1024 * 1024,
    });
  });
});

describe('AccountExportService', () => {
  it('does not touch the database while the flag is off', async () => {
    process.env[ACCOUNT_EXPORT_ENABLED_FLAG] = 'off';
    const { service, prisma } = makeService();
    await expect(service.exportAccount(1)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('exports every named collection with safe gas download metadata', async () => {
    const { service, prisma } = makeService();
    const result = await service.exportAccount(1);

    expect(result).toMatchObject({
      format: 'boiler-control.account-export',
      version: 1,
      generatedAt: '2026-11-02T12:00:00.000Z',
      account: { id: 1, email: 'owner-1@example.test', gasPriceExVat: 0 },
    });
    expect(Object.keys(result.collections)).toEqual(OUTPUT_COLLECTIONS);
    for (const name of OUTPUT_COLLECTIONS) {
      expect(result.collections[name]).toHaveLength(1);
    }
    expect(result.collections.gasReadings[0]).toMatchObject({
      downloads: {
        meterImage: '/api/gas/reading/90/meter-image',
        invoicePdf: '/api/gas/reading/90/invoice',
      },
    });

    const raw = JSON.stringify(result);
    expect(raw).not.toContain('meter-path-secret');
    expect(raw).not.toContain('invoice-path-secret');
    expect(raw).not.toContain('passwordHash');
    expect(raw).not.toContain('tokenHash');
    expect(raw).not.toContain('accessToken');
    expect(prisma.weatherCache).toBeUndefined();
    expect(prisma.weatherV2Cache).toBeUndefined();
    expect(prisma.tuyaToken).toBeUndefined();

    const accountQuery = prisma.user.findUnique.mock.calls[0][0];
    expect(accountQuery.select).not.toHaveProperty('passwordHash');
    const sessionQuery = prisma.refreshToken.findMany.mock.calls[0][0];
    expect(sessionQuery.select).not.toHaveProperty('tokenHash');
    for (const collection of COLLECTIONS) {
      expect(prisma[collection].findMany.mock.calls[0][0].take).toBe(1001);
    }
  });

  it('scopes direct and relation-owned collections to the requested user', async () => {
    const { service, prisma } = makeService();
    await service.exportAccount(1);

    expect(prisma.homeProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 1 } }),
    );
    expect(prisma.heatingIntervalLearning.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { homeProfile: { userId: 1 } } }),
    );
    expect(prisma.thermostatProgram.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { device: { userId: 1 } } }),
    );
    expect(prisma.heatingEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { thermostat: { userId: 1 } } }),
    );
    for (const collection of [
      'thermostatDevice',
      'recommendation',
      'boilerHistory',
      'gasReading',
      'gasPriceHistory',
      'notification',
      'notificationPreference',
      'userDevice',
      'refreshToken',
    ] as const) {
      expect(prisma[collection].findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 1 } }),
      );
    }
  });

  it('returns 404 for a missing user without reading collections', async () => {
    const { service, prisma } = makeService();
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.exportAccount(999)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    for (const collection of COLLECTIONS) {
      expect(prisma[collection].findMany).not.toHaveBeenCalled();
    }
  });

  it('fails instead of silently truncating a collection above the row limit', async () => {
    process.env[ACCOUNT_EXPORT_MAX_ROWS_FLAG] = '1';
    const { service, prisma } = makeService();
    prisma.notification.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);

    await expect(service.exportAccount(1)).rejects.toBeInstanceOf(
      PayloadTooLargeException,
    );
    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 2 }),
    );
  });

  it('enforces the UTF-8 byte limit after constructing the complete payload', async () => {
    process.env[ACCOUNT_EXPORT_MAX_BYTES_FLAG] = '1024';
    const { service, prisma } = makeService();
    prisma.user.findUnique.mockResolvedValue({
      ...accountRow(),
      name: 'š'.repeat(1000),
    });

    await expect(service.exportAccount(1)).rejects.toBeInstanceOf(
      PayloadTooLargeException,
    );
  });
});

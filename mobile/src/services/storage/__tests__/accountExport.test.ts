import * as FileSystemLegacy from 'expo-file-system/legacy';
import { apiClient } from '../../api/client';
import { createAccountExportFile } from '../accountExport';
import {
  ACCOUNT_EXPORT_FORMAT,
  type AccountExportResponse,
} from '../../../types/AccountExport';

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  documentDirectory: null,
  getInfoAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
  writeAsStringAsync: jest.fn(),
  moveAsync: jest.fn(),
  deleteAsync: jest.fn(),
}));

jest.mock('../../api/client', () => ({
  apiClient: { getAccountExport: jest.fn() },
}));

const REQUIRED_COLLECTIONS = [
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

const NOW = Date.parse('2026-11-02T12:00:00.000Z');
const DIRECTORY = 'file:///cache/downloads/';
const TEMPORARY_URI = `${DIRECTORY}account-export-v1-${NOW}.download`;
const FINAL_URI = `${DIRECTORY}account-export-v1-${NOW}.json`;

function makePayload(): AccountExportResponse {
  return {
    format: ACCOUNT_EXPORT_FORMAT,
    version: 1,
    generatedAt: '2026-11-02T12:00:00.000Z',
    account: { id: 7 },
    collections: {
      homeProfiles: [],
      heatingIntervalLearnings: [],
      thermostatDevices: [],
      thermostatPrograms: [],
      heatingEvents: [],
      recommendations: [],
      boilerHistories: [],
      gasReadings: [],
      gasPriceHistory: [],
      notifications: [],
      notificationPreferences: [],
      devices: [],
      sessions: [],
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Date, 'now').mockReturnValue(NOW);
  jest.mocked(apiClient.getAccountExport).mockResolvedValue(makePayload());
  jest.mocked(FileSystemLegacy.getInfoAsync).mockResolvedValue({
    exists: true,
    isDirectory: true,
    uri: DIRECTORY,
    size: 0,
    modificationTime: 0,
  });
  jest.mocked(FileSystemLegacy.makeDirectoryAsync).mockResolvedValue(undefined);
  jest.mocked(FileSystemLegacy.writeAsStringAsync).mockResolvedValue(undefined);
  jest.mocked(FileSystemLegacy.moveAsync).mockResolvedValue(undefined);
  jest.mocked(FileSystemLegacy.deleteAsync).mockResolvedValue(undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('account export storage', () => {
  it('writes all 13 required collections through an atomic temporary file', async () => {
    const payload = makePayload();
    jest.mocked(apiClient.getAccountExport).mockResolvedValue(payload);

    await expect(createAccountExportFile()).resolves.toBe(FINAL_URI);

    expect(REQUIRED_COLLECTIONS).toHaveLength(13);
    expect(apiClient.getAccountExport).toHaveBeenCalledTimes(1);
    expect(FileSystemLegacy.getInfoAsync).toHaveBeenCalledWith(DIRECTORY);
    expect(FileSystemLegacy.makeDirectoryAsync).not.toHaveBeenCalled();
    expect(FileSystemLegacy.writeAsStringAsync).toHaveBeenCalledWith(
      TEMPORARY_URI,
      JSON.stringify(payload),
      { encoding: 'utf8' },
    );
    expect(FileSystemLegacy.moveAsync).toHaveBeenCalledWith({
      from: TEMPORARY_URI,
      to: FINAL_URI,
    });
    expect(FileSystemLegacy.deleteAsync).not.toHaveBeenCalled();

    const serialized = JSON.parse(
      jest.mocked(FileSystemLegacy.writeAsStringAsync).mock.calls[0][1],
    ) as AccountExportResponse;
    expect(Object.keys(serialized.collections).sort()).toEqual(
      [...REQUIRED_COLLECTIONS].sort(),
    );
    expect(serialized.account).toEqual({ id: 7 });
  });

  it('creates the shared downloads directory when it is missing', async () => {
    jest.mocked(FileSystemLegacy.getInfoAsync).mockResolvedValue({
      exists: false,
      isDirectory: false,
      uri: DIRECTORY,
    });

    await expect(createAccountExportFile()).resolves.toBe(FINAL_URI);

    expect(FileSystemLegacy.makeDirectoryAsync).toHaveBeenCalledWith(DIRECTORY, {
      intermediates: true,
    });
  });

  it('rejects an export with a missing required collection before using storage', async () => {
    const invalid = makePayload() as unknown as Record<string, unknown>;
    delete (invalid.collections as Record<string, unknown>).gasReadings;
    jest
      .mocked(apiClient.getAccountExport)
      .mockResolvedValue(invalid as unknown as AccountExportResponse);

    await expect(createAccountExportFile()).rejects.toThrow(
      'Invalid account export response',
    );

    expect(FileSystemLegacy.getInfoAsync).not.toHaveBeenCalled();
    expect(FileSystemLegacy.writeAsStringAsync).not.toHaveBeenCalled();
  });

  it('rejects an unsupported export version before using storage', async () => {
    const invalid = {
      ...makePayload(),
      version: 2,
    } as unknown as AccountExportResponse;
    jest.mocked(apiClient.getAccountExport).mockResolvedValue(invalid);

    await expect(createAccountExportFile()).rejects.toThrow(
      'Invalid account export response',
    );

    expect(FileSystemLegacy.getInfoAsync).not.toHaveBeenCalled();
    expect(FileSystemLegacy.writeAsStringAsync).not.toHaveBeenCalled();
  });

  it('removes both temporary and final paths after a partial write failure', async () => {
    jest
      .mocked(FileSystemLegacy.writeAsStringAsync)
      .mockRejectedValueOnce(new Error('disk full'));

    await expect(createAccountExportFile()).rejects.toThrow('disk full');

    expect(FileSystemLegacy.moveAsync).not.toHaveBeenCalled();
    expect(FileSystemLegacy.deleteAsync).toHaveBeenCalledWith(TEMPORARY_URI, {
      idempotent: true,
    });
    expect(FileSystemLegacy.deleteAsync).toHaveBeenCalledWith(FINAL_URI, {
      idempotent: true,
    });
  });

  it('cleans up both paths when the atomic move fails', async () => {
    jest
      .mocked(FileSystemLegacy.moveAsync)
      .mockRejectedValueOnce(new Error('move failed'));

    await expect(createAccountExportFile()).rejects.toThrow('move failed');

    expect(FileSystemLegacy.deleteAsync).toHaveBeenCalledWith(TEMPORARY_URI, {
      idempotent: true,
    });
    expect(FileSystemLegacy.deleteAsync).toHaveBeenCalledWith(FINAL_URI, {
      idempotent: true,
    });
  });
});

import * as FileSystemLegacy from 'expo-file-system/legacy';
import { apiClient } from '../api/client';
import {
  ACCOUNT_EXPORT_COLLECTIONS,
  ACCOUNT_EXPORT_FORMAT,
  type AccountExportResponse,
} from '../../types/AccountExport';
import { getDownloadsDirectory } from './downloadCache';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAccountExportResponse(value: unknown): value is AccountExportResponse {
  if (!isRecord(value)) return false;
  if (value.format !== ACCOUNT_EXPORT_FORMAT || value.version !== 1) return false;
  if (typeof value.generatedAt !== 'string' || value.generatedAt.trim().length === 0) {
    return false;
  }
  const { account, collections } = value;
  if (!isRecord(account) || !isRecord(collections)) return false;
  return ACCOUNT_EXPORT_COLLECTIONS.every((name) =>
    Array.isArray(collections[name]),
  );
}

/**
 * Zapisuje kompletan JSON izvoz u isti privremeni downloads direktorij koji
 * koriste zaštićeni gasni dokumenti. Datoteka ostaje dostupna native share
 * sheetu, a postojeća Clear cache akcija uklanja je zajedno s ostalim preuzimanjima.
 */
export async function createAccountExportFile(): Promise<string> {
  const payload: unknown = await apiClient.getAccountExport();
  if (!isAccountExportResponse(payload)) {
    throw new Error('Invalid account export response');
  }

  const directory = await getDownloadsDirectory();
  if (!directory) throw new Error('Account export storage is unavailable');

  const directoryInfo = await FileSystemLegacy.getInfoAsync(directory);
  if (directoryInfo.exists && !directoryInfo.isDirectory) {
    throw new Error('Account export storage is not a directory');
  }
  if (!directoryInfo.exists) {
    await FileSystemLegacy.makeDirectoryAsync(directory, { intermediates: true });
  }

  const prefix = `${directory}account-export-v1-${Date.now()}`;
  const temporaryUri = `${prefix}.download`;
  const finalUri = `${prefix}.json`;
  let complete = false;
  try {
    await FileSystemLegacy.writeAsStringAsync(
      temporaryUri,
      JSON.stringify(payload),
      { encoding: 'utf8' },
    );
    await FileSystemLegacy.moveAsync({ from: temporaryUri, to: finalUri });
    complete = true;
    return finalUri;
  } finally {
    if (!complete) {
      await Promise.all([
        FileSystemLegacy.deleteAsync(temporaryUri, { idempotent: true }).catch(
          () => undefined,
        ),
        FileSystemLegacy.deleteAsync(finalUri, { idempotent: true }).catch(
          () => undefined,
        ),
      ]);
    }
  }
}

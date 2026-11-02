import { Logger } from '@nestjs/common';

export const ACCOUNT_EXPORT_ENABLED_FLAG = 'ACCOUNT_EXPORT_ENABLED';
export const ACCOUNT_EXPORT_MAX_ROWS_FLAG =
  'ACCOUNT_EXPORT_MAX_ROWS_PER_COLLECTION';
export const ACCOUNT_EXPORT_MAX_BYTES_FLAG = 'ACCOUNT_EXPORT_MAX_BYTES';
export const DEFAULT_ACCOUNT_EXPORT_MAX_ROWS = 1000;
export const HARD_ACCOUNT_EXPORT_MAX_ROWS = 10_000;
export const DEFAULT_ACCOUNT_EXPORT_MAX_BYTES = 5 * 1024 * 1024;
export const HARD_ACCOUNT_EXPORT_MAX_BYTES = 20 * 1024 * 1024;

const logger = new Logger('AccountExport');

type ExportEnv = Record<string, string | undefined>;

function boundedInteger(
  raw: string | undefined,
  fallback: number,
  hardMaximum: number,
  minimum: number,
  flag: string,
): number {
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (
    /^\d+$/.test(raw.trim()) &&
    Number.isSafeInteger(value) &&
    value >= minimum &&
    value <= hardMaximum
  ) {
    return value;
  }
  logger.warn(
    `${flag} mora biti cijeli broj ${minimum}..${hardMaximum}; koristim ${fallback}.`,
  );
  return fallback;
}

export function accountExportEnabled(env: ExportEnv = process.env): boolean {
  const raw = env[ACCOUNT_EXPORT_ENABLED_FLAG];
  if (raw === undefined) return false;
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'on') return true;
  if (normalized === 'off') return false;
  logger.warn(
    `${ACCOUNT_EXPORT_ENABLED_FLAG} ima neispravnu vrijednost ${JSON.stringify(raw)}; koristim off.`,
  );
  return false;
}

export function getAccountExportConfig(env: ExportEnv = process.env) {
  return {
    enabled: accountExportEnabled(env),
    maxRowsPerCollection: boundedInteger(
      env[ACCOUNT_EXPORT_MAX_ROWS_FLAG],
      DEFAULT_ACCOUNT_EXPORT_MAX_ROWS,
      HARD_ACCOUNT_EXPORT_MAX_ROWS,
      1,
      ACCOUNT_EXPORT_MAX_ROWS_FLAG,
    ),
    maxBytes: boundedInteger(
      env[ACCOUNT_EXPORT_MAX_BYTES_FLAG],
      DEFAULT_ACCOUNT_EXPORT_MAX_BYTES,
      HARD_ACCOUNT_EXPORT_MAX_BYTES,
      1024,
      ACCOUNT_EXPORT_MAX_BYTES_FLAG,
    ),
  };
}

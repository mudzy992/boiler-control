import { Logger } from '@nestjs/common';

/**
 * PERF-2: konfiguracija ogranicenog polling listinga.
 *
 * Zadano je UKLJUCENO jer je vlasnik izabrao default-on rollout. Rollback je
 * `POLL_PAGINATION_ENABLED=off`, sto vraca legacy findMany(include) put.
 */
export const POLL_PAGINATION_FLAG = 'POLL_PAGINATION_ENABLED';
export const POLL_BATCH_SIZE_FLAG = 'POLL_BATCH_SIZE';
export const DEFAULT_POLL_BATCH_SIZE = 100;
export const HARD_POLL_BATCH_SIZE = 500;

const logger = new Logger('PollingPagination');

/** Strogo on/off; neispravna vrijednost ne gasi zadanu zastitu. */
export function pollPaginationEnabled(): boolean {
  const raw = process.env[POLL_PAGINATION_FLAG];
  if (raw === undefined) return true;
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'on') return true;
  if (normalized === 'off') return false;
  logger.warn(
    `${POLL_PAGINATION_FLAG} ima neispravnu vrijednost ${JSON.stringify(raw)}; koristim on.`,
  );
  return true;
}

export function pollBatchSize(): number {
  const raw = process.env[POLL_BATCH_SIZE_FLAG];
  if (raw === undefined) return DEFAULT_POLL_BATCH_SIZE;
  const value = Number(raw);
  if (
    /^\d+$/.test(raw.trim()) &&
    Number.isSafeInteger(value) &&
    value > 0 &&
    value <= HARD_POLL_BATCH_SIZE
  ) {
    return value;
  }
  logger.warn(
    `${POLL_BATCH_SIZE_FLAG} mora biti cijeli broj 1..${HARD_POLL_BATCH_SIZE}; koristim ${DEFAULT_POLL_BATCH_SIZE}.`,
  );
  return DEFAULT_POLL_BATCH_SIZE;
}

/**
 * Sam polling koristi ova polja. Skalarni `homeProfileId` služi opt-in v2
 * čitanju, a korisnikovo `homeLocation` legacy fallbacku; `homeProfile` i
 * `intervalLearnings` relacije se ne učitavaju, a ostale podatke po korisniku
 * dobavlja `calculateFlowTemp()`.
 */
export const POLL_DEVICE_SELECT = {
  id: true,
  userId: true,
  deviceId: true,
  homeProfileId: true,
  roomCurrentTemp: true,
  roomTargetTemp: true,
  lastSnapshotAt: true,
  user: { select: { homeLocation: true } },
} as const;

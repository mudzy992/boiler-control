import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Stanje lokalnog backupa, za `/health` (`A3` u `docs/audit/backend/34-backups.md`).
 *
 * Zašto ovdje, a ne samo u cron logu: backup koji tiho prestane da radi je
 * najgori kvar te vrste — primijeti se tek kad zatreba. `manifest.json` piše
 * `scripts/backup/backup.sh`, a aplikacija ga samo čita. Time `/health` postaje
 * jedino mjesto gdje se vidi i „radi" i „ne radi".
 *
 * Namjerno NE dira status aplikacije: zastario backup ne smije izbaciti zdrav
 * proces iz rotacije (readiness bi time postao lažan). Polje je informativno.
 */

export interface BackupStatus {
  /** `false` kad `BACKUP_DIR` nije postavljen — tada se polje ne prikazuje. */
  configured: boolean;
  /** Vrijeme zadnjeg uspješnog dumpa (ISO), ili `null` ako ga nikad nije bilo. */
  lastBackupAt: string | null;
  /** Starost u satima; `null` kad nema manifesta. */
  ageHours: number | null;
  /** `true` kad backup nedostaje ili je stariji od `maxAgeHours`. */
  stale: boolean;
  dumpBytes: number | null;
  /** Da li manifest tvrdi da su uploads arhivirani uz dump. */
  uploadsIncluded: boolean;
  /** Zadnja greška iz `last-error.json`, ako je novija od zadnjeg uspjeha. */
  lastError: { failedAt: string; message: string } | null;
}

export interface ReadBackupStatusOptions {
  /** Direktorij backupa; tipično `process.env.BACKUP_DIR`. */
  dir?: string | null;
  /** Za testove: fiksno „sada". */
  now?: Date;
  /** Poslije koliko sati backup smatramo zastarjelim. */
  maxAgeHours?: number;
}

export const DEFAULT_MAX_AGE_HOURS = 36;

function readJson<T>(file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
  } catch {
    // Neispravan JSON je stanje koje treba prijaviti, ne srušiti `/health`.
    return null;
  }
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function readBackupStatus(
  options: ReadBackupStatusOptions = {},
): BackupStatus {
  const dir = options.dir ?? process.env.BACKUP_DIR ?? null;
  const maxAgeHours = options.maxAgeHours ?? DEFAULT_MAX_AGE_HOURS;

  if (!dir) {
    return {
      configured: false,
      lastBackupAt: null,
      ageHours: null,
      stale: false,
      dumpBytes: null,
      uploadsIncluded: false,
      lastError: null,
    };
  }

  const manifest = readJson<{
    createdAt?: string;
    dumpBytes?: number;
    uploads?: string | null;
  }>(path.join(dir, 'manifest.json'));

  const error = readJson<{ failedAt?: string; message?: string }>(
    path.join(dir, 'last-error.json'),
  );

  const createdAt = parseDate(manifest?.createdAt);
  const failedAt = parseDate(error?.failedAt);

  // Greška se prijavljuje samo ako je novija od posljednjeg uspjeha — inače bi
  // jedan stari neuspjeh zauvijek stajao pored ispravnog backupa.
  const lastError =
    error && failedAt && (!createdAt || failedAt > createdAt)
      ? {
          failedAt: error.failedAt ?? '',
          message: typeof error.message === 'string' ? error.message : '',
        }
      : null;

  const now = options.now ?? new Date();
  const ageHours = createdAt
    ? Math.max(0, Math.round(((now.getTime() - createdAt.getTime()) / 3_600_000) * 10) / 10)
    : null;

  return {
    configured: true,
    lastBackupAt: createdAt ? createdAt.toISOString() : null,
    ageHours,
    stale: ageHours === null || ageHours > maxAgeHours,
    dumpBytes: typeof manifest?.dumpBytes === 'number' ? manifest.dumpBytes : null,
    uploadsIncluded: Boolean(manifest?.uploads),
    lastError,
  };
}

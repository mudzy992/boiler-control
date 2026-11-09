import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { readBackupStatus, DEFAULT_MAX_AGE_HOURS } from '../backup-status';

/**
 * Stanje backupa u `/health` (`34`).
 *
 * Testira se odluka, ne format: kada je backup „u redu", kada je „zastario", i
 * šta se prijavljuje kad manifesta nema ili je neispravan. Te dvije stvari su
 * razlog zašto polje postoji — da tiho prestajanje backupa bude vidljivo.
 */

const NOW = new Date('2026-11-08T12:00:00.000Z');

function makeDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'backup-status-'));
}

function writeManifest(dir: string, payload: unknown): void {
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(payload));
}

function writeError(dir: string, payload: unknown): void {
  fs.writeFileSync(path.join(dir, 'last-error.json'), JSON.stringify(payload));
}

describe('readBackupStatus', () => {
  it('bez BACKUP_DIR nije konfigurisan i ne tvrdi da je zastario', () => {
    expect(readBackupStatus({ dir: null, now: NOW })).toEqual({
      configured: false,
      lastBackupAt: null,
      ageHours: null,
      stale: false,
      dumpBytes: null,
      uploadsIncluded: false,
      lastError: null,
    });
  });

  it('svjež backup nije zastario', () => {
    const dir = makeDir();
    writeManifest(dir, {
      createdAt: '2026-11-08T09:00:00.000Z',
      dumpBytes: 2048,
      uploads: 'uploads-1.tar.gz',
    });

    const status = readBackupStatus({ dir, now: NOW });
    expect(status.configured).toBe(true);
    expect(status.ageHours).toBe(3);
    expect(status.stale).toBe(false);
    expect(status.dumpBytes).toBe(2048);
    expect(status.uploadsIncluded).toBe(true);
  });

  it('backup stariji od granice je zastario', () => {
    const dir = makeDir();
    const old = new Date(NOW.getTime() - (DEFAULT_MAX_AGE_HOURS + 1) * 3_600_000);
    writeManifest(dir, { createdAt: old.toISOString(), dumpBytes: 10 });

    const status = readBackupStatus({ dir, now: NOW });
    expect(status.stale).toBe(true);
    expect(status.ageHours).toBeGreaterThan(DEFAULT_MAX_AGE_HOURS);
  });

  it('bez manifesta je zastario, ne „nepoznato" — nikad nije ni napravljen', () => {
    const dir = makeDir();
    const status = readBackupStatus({ dir, now: NOW });
    expect(status.configured).toBe(true);
    expect(status.lastBackupAt).toBeNull();
    expect(status.ageHours).toBeNull();
    expect(status.stale).toBe(true);
  });

  it('neispravan JSON ne ruši provjeru, nego se čita kao „nema manifesta"', () => {
    const dir = makeDir();
    fs.writeFileSync(path.join(dir, 'manifest.json'), '{ ovo nije json');
    const status = readBackupStatus({ dir, now: NOW });
    expect(status.lastBackupAt).toBeNull();
    expect(status.stale).toBe(true);
  });

  it('prijavljuje grešku noviju od zadnjeg uspjeha', () => {
    const dir = makeDir();
    writeManifest(dir, { createdAt: '2026-11-07T09:00:00.000Z', dumpBytes: 1 });
    writeError(dir, {
      failedAt: '2026-11-08T09:00:00.000Z',
      message: 'pg_dump nije uspio',
    });

    const status = readBackupStatus({ dir, now: NOW });
    expect(status.lastError).toEqual({
      failedAt: '2026-11-08T09:00:00.000Z',
      message: 'pg_dump nije uspio',
    });
  });

  it('ne prijavljuje staru grešku ako je poslije nje backup uspio', () => {
    const dir = makeDir();
    writeError(dir, {
      failedAt: '2026-11-07T09:00:00.000Z',
      message: 'stara greška',
    });
    writeManifest(dir, { createdAt: '2026-11-08T09:00:00.000Z', dumpBytes: 1 });

    expect(readBackupStatus({ dir, now: NOW }).lastError).toBeNull();
  });

  it('granica se može pomjeriti (npr. backup svakih 12 h, granica 18 h)', () => {
    const dir = makeDir();
    writeManifest(dir, { createdAt: '2026-11-08T00:00:00.000Z', dumpBytes: 1 });

    // Starost je tačno 12 h; granica 11 h je prekoračena, granica 13 h nije.
    expect(readBackupStatus({ dir, now: NOW, maxAgeHours: 11 }).stale).toBe(true);
    expect(readBackupStatus({ dir, now: NOW, maxAgeHours: 13 }).stale).toBe(false);
  });
});

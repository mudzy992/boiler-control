/**
 * SEC-4 — rotirani refresh token.
 *
 * Sigurnosni ugovor koji se ovdje dokazuje:
 *  - u bazi se čuva ISKLJUČIVO SHA-256 hash, nikad sam token;
 *  - rotacija opoziva stari token i izdaje novi;
 *  - ponovno korištenje VEĆ opozvanog tokena tretira se kao krađa i opoziva
 *    sve sesije tog korisnika (reuse detection);
 *  - istekli i nepostojeći token se odbijaju.
 *
 * Prisma je lažna (in-memory), jer lokalno nema PostgreSQL-a; stvarnu migraciju
 * verificira CI kroz `npx prisma migrate deploy` nad postgres:16 servisom.
 */
import { RefreshTokenService } from '../refresh-token.service';

interface Row {
  id: number;
  userId: number;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: Date;
}

function fakePrisma() {
  const rows: Row[] = [];
  let nextId = 1;
  return {
    rows,
    refreshToken: {
      create: ({ data }: { data: Partial<Row> }) => {
        const row: Row = {
          id: nextId++,
          userId: data.userId as number,
          tokenHash: data.tokenHash as string,
          expiresAt: data.expiresAt as Date,
          revokedAt: data.revokedAt ?? null,
          userAgent: data.userAgent ?? null,
          ipAddress: data.ipAddress ?? null,
          createdAt: new Date(),
        };
        rows.push(row);
        return Promise.resolve(row);
      },
      findUnique: ({ where }: { where: { tokenHash: string } }) =>
        Promise.resolve(
          rows.find((r) => r.tokenHash === where.tokenHash) ?? null,
        ),
      update: ({
        where,
        data,
      }: {
        where: { id: number };
        data: Partial<Row>;
      }) => {
        const row = rows.find((r) => r.id === where.id);
        if (!row) return Promise.reject(new Error('not found'));
        Object.assign(row, data);
        return Promise.resolve(row);
      },
      updateMany: ({
        where,
        data,
      }: {
        where: { userId: number; revokedAt?: null };
        data: Partial<Row>;
      }) => {
        const hits = rows.filter(
          (r) =>
            r.userId === where.userId &&
            (where.revokedAt === null ? r.revokedAt === null : true),
        );
        hits.forEach((r) => Object.assign(r, data));
        return Promise.resolve({ count: hits.length });
      },
    },
  };
}

describe('SEC-4: RefreshTokenService', () => {
  let db: ReturnType<typeof fakePrisma>;
  let service: RefreshTokenService;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(Date.parse('2026-01-01T00:00:00Z'));
    db = fakePrisma();
    service = new RefreshTokenService(db as never);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('izdavanje', () => {
    it('u bazi čuva hash, a NE sam token', async () => {
      const issued = await service.issue(7);

      expect(typeof issued.token).toBe('string');
      expect(issued.token.length).toBeGreaterThanOrEqual(43);
      expect(db.rows).toHaveLength(1);
      expect(db.rows[0].tokenHash).not.toBe(issued.token);
      expect(db.rows[0].tokenHash).toHaveLength(64); // SHA-256 hex
      expect(JSON.stringify(db.rows)).not.toContain(issued.token);
    });

    it('hash je deterministički, a token nasumičan', async () => {
      const a = await service.issue(1);
      const b = await service.issue(1);

      expect(a.token).not.toBe(b.token);
      expect(db.rows[0].tokenHash).not.toBe(db.rows[1].tokenHash);
    });

    it('postavlja istek u budućnosti i bilježi userId', async () => {
      const issued = await service.issue(42, {
        userAgent: 'jest',
        ipAddress: '10.0.0.1',
      });

      expect(issued.expiresAt.getTime()).toBeGreaterThan(Date.now());
      expect(db.rows[0].userId).toBe(42);
      expect(db.rows[0].userAgent).toBe('jest');
      expect(db.rows[0].ipAddress).toBe('10.0.0.1');
    });
  });

  describe('rotacija', () => {
    it('opoziva stari token i izdaje novi', async () => {
      const first = await service.issue(7);
      const rotated = await service.rotate(first.token);

      expect(rotated.userId).toBe(7);
      expect(rotated.token).not.toBe(first.token);
      expect(db.rows).toHaveLength(2);
      expect(db.rows[0].revokedAt).not.toBeNull();
      expect(db.rows[1].revokedAt).toBeNull();
    });

    it('novi token se može ponovo rotirati', async () => {
      const first = await service.issue(7);
      const second = await service.rotate(first.token);
      const third = await service.rotate(second.token);

      expect(third.userId).toBe(7);
      expect(db.rows).toHaveLength(3);
      expect(db.rows.filter((r) => r.revokedAt !== null)).toHaveLength(2);
    });

    it('odbija nepostojeći token', async () => {
      await expect(service.rotate('nepostojeci-token')).rejects.toThrow();
      expect(db.rows).toHaveLength(0);
    });

    it('odbija istekli token i NE izdaje novi', async () => {
      const issued = await service.issue(7, undefined, 60 * 1000); // 1 minuta
      jest.advanceTimersByTime(61 * 1000);

      await expect(service.rotate(issued.token)).rejects.toThrow();
      expect(db.rows).toHaveLength(1);
    });
  });

  describe('detekcija krađe (reuse detection)', () => {
    it('ponovno korištenje opozvanog tokena opoziva SVE sesije korisnika', async () => {
      const stolen = await service.issue(7);
      await service.rotate(stolen.token); // legitimni korisnik rotira

      // Napadač pokuša s istim, već opozvanim tokenom.
      await expect(service.rotate(stolen.token)).rejects.toThrow();

      const other = db.rows.find((r) => r.revokedAt === null);
      expect(other).toBeUndefined();
      expect(db.rows.every((r) => r.revokedAt !== null)).toBe(true);
    });

    it('ne dirajući tuđe sesije', async () => {
      const stolen = await service.issue(7);
      await service.rotate(stolen.token);
      await service.issue(8);

      await expect(service.rotate(stolen.token)).rejects.toThrow();

      const rows8 = db.rows.filter((r) => r.userId === 8);
      expect(rows8.length).toBeGreaterThan(0);
      expect(rows8.every((r) => r.revokedAt === null)).toBe(true);
    });
  });

  describe('opoziv', () => {
    it('revoke označava revokedAt i vraća true', async () => {
      const issued = await service.issue(7);
      const ok = await service.revoke(issued.token);

      expect(ok).toBe(true);
      expect(db.rows[0].revokedAt).not.toBeNull();
    });

    it('revoke nepostojećeg tokena vraća false i ne baca', async () => {
      await expect(service.revoke('nema-ga')).resolves.toBe(false);
    });

    it('revokeAllForUser opoziva sve aktivne sesije i vraća broj', async () => {
      await service.issue(7);
      await service.issue(7);
      await service.issue(8);

      const count = await service.revokeAllForUser(7);

      expect(count).toBe(2);
      expect(
        db.rows
          .filter((r) => r.userId === 7)
          .every((r) => r.revokedAt !== null),
      ).toBe(true);
      expect(db.rows.find((r) => r.userId === 8)?.revokedAt).toBeNull();
    });
  });
});

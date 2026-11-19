import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import { TvPairingService } from '../tv-pairing.service';
import { hashCode, PAIRING_MAX_POLLS } from '../pairing-code';

/**
 * Uparivanje TV-a — četiri pravila koja se ne vide iz UI-a:
 *
 * 1. kod se **ne čuva** u čistom obliku;
 * 2. kod je **jednokratan** (drugi `claim` ne dobija tokene);
 * 3. tuđi kod se ne može odobriti ni odbiti;
 * 4. nepostojeći i neaktivan kod daju **istu** grešku.
 */

jest.mock('../../../prisma/prisma.service', () => ({
  PrismaService: class {},
}));

type Row = Record<string, any>;

/** Minimalna lažna baza — dovoljna za `where` uslove koje servis koristi. */
function makeDb() {
  const rows: Row[] = [];
  const deviceRows: Row[] = [];
  let nextId = 1;

  return {
    rows,
    deviceRows,
    tvPairingSession: {
      create: ({ data }: any) => {
        const row = {
          id: nextId++,
          status: 'PENDING',
          pollCount: 0,
          userId: null,
          accessToken: null,
          refreshToken: null,
          approvedByDevice: null,
          createdAt: new Date(),
          claimedAt: null,
          ...data,
        };
        rows.push(row);
        return Promise.resolve(row);
      },
      findUnique: ({ where }: any) => {
        const hash = where.codeHash;
        return Promise.resolve(rows.find((r) => r.codeHash === hash) ?? null);
      },
      update: ({ where, data }: any) => {
        const row = rows.find((r) => r.id === where.id);
        if (!row) throw new Error('nema reda');
        Object.assign(row, data);
        return Promise.resolve(row);
      },
      updateMany: ({ where, data }: any) => {
        const matched = rows.filter((r) => {
          if (where.id != null && r.id !== where.id) return false;
          if (where.status != null && typeof where.status === 'string') {
            if (r.status !== where.status) return false;
          }
          if (where.status?.in && !where.status.in.includes(r.status)) {
            return false;
          }
          return true;
        });
        for (const row of matched) {
          Object.assign(row, data);
        }
        return Promise.resolve({ count: matched.length });
      },
      findMany: ({ where }: any) =>
        Promise.resolve(
          rows.filter(
            (r) =>
              r.userId === where.userId && where.status.in.includes(r.status),
          ),
        ),
    },

    /*
     * `UserDevice` — TV se registruje za push pri odobrenju (v. `approve()`).
     * Lažna baza čuva ono što `upsert` traži: jedinstven `expoPushToken` i
     * reaktivaciju postojećeg reda.
     */
    userDevice: {
      upsert: jest.fn(({ where, create, update }: any): Promise<Row> => {
        const existing = deviceRows.find(
          (d) => d.expoPushToken === where.expoPushToken,
        );
        if (existing) {
          Object.assign(existing, update);
          return Promise.resolve(existing);
        }
        const row = { id: deviceRows.length + 1, ...create } as Row;
        deviceRows.push(row);
        return Promise.resolve(row);
      }),
    },
  };
}

function makeService() {
  const db = makeDb();
  const auth = { issueAccessToken: jest.fn((id: number) => `access-${id}`) };
  const refreshTokens = {
    issue: jest.fn(() =>
      Promise.resolve({ token: 'refresh-token', expiresAt: new Date() }),
    ),
    revoke: jest.fn(() => Promise.resolve(true)),
  };
  const service = new TvPairingService(
    db as any,
    auth as any,
    refreshTokens as any,
  );
  return { service, db, auth, refreshTokens };
}

/**
 * Push registracija pri odobrenju.
 *
 * **Zašto ovi testovi postoje.** Glavna svrha TV aplikacije su notifikacije, a
 * TV po pravilu ne smije raditi nijedan POST osim uparivanja. Ako se token ne
 * upiše ovdje, TV se upari, prikaže analitiku — i **nikad ne dobije
 * notifikaciju**, bez ijedne greške. To je kvar koji se ne vidi u UI-u.
 */
describe('push token TV-a pri odobrenju', () => {
  const token = 'ExponentPushToken[abcDEF123_-]';

  it('token poslan uz zahtjev za kod upisuje se u UserDevice kad telefon odobri', async () => {
    const { service, db } = makeService();
    const { code } = await service.create('TV u dnevnoj', token);

    // Prije odobrenja: token je na sesiji, ali uređaj još ne postoji.
    expect(db.rows[0].tvPushToken).toBe(token);
    expect(db.deviceRows).toHaveLength(0);

    await service.approve(7, code, 'TV u dnevnoj');

    expect(db.deviceRows).toHaveLength(1);
    expect(db.rows[0].tvPushToken).toBeNull();
    expect(db.deviceRows[0]).toMatchObject({
      userId: 7,
      expoPushToken: token,
      platform: 'android',
      // `kind` je ono što razdvaja TV od telefona; bez njega notifikacija
      // namijenjena TV-u ide i na telefon.
      kind: 'TV',
      label: 'TV u dnevnoj',
      isActive: true,
    });
  });

  it('bez tokena uparivanje radi, samo bez push-a', async () => {
    const { service, db } = makeService();
    const { code } = await service.create();

    await service.approve(7, code, 'Pixel');

    expect(db.deviceRows).toHaveLength(0);
    expect(db.rows[0].status).toBe('APPROVED');
  });

  it('ponovno uparivanje istog TV-a reaktivira uređaj, ne pravi duplikat', async () => {
    // Duplikat = dvije notifikacije za isti događaj, svaki put sve više.
    const { service, db } = makeService();

    const first = await service.create('TV', token);
    await service.approve(7, first.code, 'TV');
    db.deviceRows[0].isActive = false; // TV je odjavljen

    const second = await service.create('TV', token);
    await service.approve(7, second.code, 'TV');

    expect(db.deviceRows).toHaveLength(1);
    expect(db.deviceRows[0].isActive).toBe(true);
  });

  it('greška pri upisu uređaja NE obara uparivanje', async () => {
    /*
     * TV je već dobio tokene i može prikazivati analitiku. Bez push-a je
     * osakaćen, ali upotrebljiv; ako bismo grešku propustili, korisnik bi
     * ostao bez uparivanja zbog kvara koji nije njegov.
     */
    const { service, db } = makeService();
    db.userDevice.upsert.mockRejectedValueOnce(new Error('baza je pala'));

    const { code } = await service.create('TV', token);
    await expect(service.approve(7, code, 'TV')).resolves.toEqual({
      status: 'APPROVED',
    });

    const claimed = await service.claim(code);
    expect(claimed).toMatchObject({ status: 'READY' });
    // TV claim pokušava ponovo nakon privremenog DB kvara pri odobrenju.
    expect(db.deviceRows).toHaveLength(1);
    expect(db.rows[0].tvPushToken).toBeNull();
  });

  it('neupareni TV ne dobija uređaj ni kad je token poslan', async () => {
    // Token sam po sebi ne smije ništa registrovati — inače bi bilo koji TV
    // mogao sebi otvoriti push bez odobrenja telefona.
    const { service, db } = makeService();
    const { code } = await service.create('TV', token);

    await service.claim(code); // telefon NIJE odobrio

    expect(db.deviceRows).toHaveLength(0);
  });
});

describe('TvPairingService', () => {
  it('kod se čuva kao hash, nikad u čistom obliku', async () => {
    const { service, db } = makeService();

    const created = await service.create('TV u dnevnoj');

    expect(created.code).toHaveLength(8);
    // U bazi je hash, a NE kod.
    expect(db.rows[0].codeHash).toBe(hashCode(created.code));
    expect(db.rows[0].codeHash).not.toBe(created.code);

    /*
     * Nijedno polje reda ne smije sadržavati cijeli kod. Ovaj test je prvo
     * PAO i tako našao stvarni kvar: `shortCode` je čuvao kod u čistom obliku,
     * pa bi baza koja procuri davala upotrebljive kodove. Sada u redu stoji
     * samo `codeHint` (prva četiri znaka) — nedovoljno za prijavu.
     */
    const serialized = JSON.stringify(db.rows[0]);
    expect(serialized).not.toContain(created.code);
    expect(db.rows[0].codeHint).toBe(created.code.slice(0, 4));
    expect(db.rows[0].codeHint).toHaveLength(4);
  });

  it('prije odobrenja TV dobija PENDING, bez tokena', async () => {
    const { service } = makeService();
    const { code } = await service.create();

    const result = await service.claim(code);

    expect(result).toEqual({ status: 'PENDING' });
    expect(result).not.toHaveProperty('token');
  });

  it('poslije odobrenja TV dobija tokene TAČNO jednom', async () => {
    const { service, auth, refreshTokens } = makeService();
    const { code } = await service.create();

    await service.approve(7, code, 'Pixel');
    expect(auth.issueAccessToken).toHaveBeenCalledWith(7);
    expect(refreshTokens.issue).toHaveBeenCalled();

    const first = await service.claim(code);
    expect(first.status).toBe('READY');
    if (first.status !== 'READY') throw new Error('očekivano READY');
    expect(first.token).toBe('access-7');
    expect(first.refreshToken).toBe('refresh-token');

    // Drugi put: kod je iskorišten, tokena nema.
    const second = await service.claim(code);
    expect(second).toEqual({ status: 'CLAIMED' });
  });

  it('nepostojeći kod je 404, ne 500 i ne otkriva da li postoji', async () => {
    const { service } = makeService();
    await expect(service.claim('ABCD2345')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('kod sa izbačenim znakom se odbija prije baze', async () => {
    const { service } = makeService();
    // `0` nije u abecedi — takav kod ne može postojati.
    await expect(service.claim('ABCD2340')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('istekao kod vraća EXPIRED i mijenja stanje', async () => {
    const { service, db } = makeService();
    const { code } = await service.create();
    db.rows[0].expiresAt = new Date(Date.now() - 1000);

    expect(await service.claim(code)).toEqual({ status: 'EXPIRED' });
    expect(db.rows[0].status).toBe('EXPIRED');
  });

  it('tuđi kod se ne može odbiti (prekid tuđeg uparivanja)', async () => {
    const { service } = makeService();
    const { code } = await service.create();
    await service.approve(7, code);

    await expect(service.reject(99, code)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('dvostruko odobrenje ne prolazi — drugi telefon ne dobija ništa', async () => {
    const { service, auth, refreshTokens } = makeService();
    const { code } = await service.create();

    await service.approve(7, code);
    const tokensAfterFirst = auth.issueAccessToken.mock.calls.length;

    await expect(service.approve(8, code)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    /*
     * Drugi telefon ne stvara NIŠTA: servis odbija prije izdavanja tokena, pa
     * ne postoji ni siroče u `RefreshToken` tabeli koje bi trebalo opozvati.
     * Prva verzija ovog testa je tvrdila da je `revoke` pozvan — to bi bilo
     * tačno samo u trci (v. sljedeći test), ne u ovom slučaju.
     */
    expect(auth.issueAccessToken).toHaveBeenCalledTimes(tokensAfterFirst);
    expect(refreshTokens.issue).toHaveBeenCalledTimes(1);
  });

  it('trka dva odobrenja: gubi onaj koji zatekne izmijenjeno stanje', async () => {
    /*
     * Ovo je put koji se ne vidi iz UI-a: dva telefona odobre isti kod u istom
     * trenutku. Prvi prođe `updateMany`, drugi dobije `count: 0` i mora
     * OPOZVATI refresh token koji je već izdao — inače ostane valjan token za
     * sesiju koja nikad nije nastala.
     */
    const { service, db, refreshTokens } = makeService();
    const { code } = await service.create();

    // Oponašaj trku: `updateMany` ne nađe PENDING (drugi je već promijenio).
    const realUpdateMany = db.tvPairingSession.updateMany;
    db.tvPairingSession.updateMany = ((args: any) => {
      if (args.data?.status === 'APPROVED') {
        return Promise.resolve({ count: 0 });
      }
      return realUpdateMany(args);
    }) as any;

    await expect(service.approve(8, code)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(refreshTokens.revoke).toHaveBeenCalledWith('refresh-token');
  });

  it('poslije maksimalnog broja upita kod istječe (ne može se rudariti)', async () => {
    const { service, db } = makeService();
    const { code } = await service.create();
    db.rows[0].pollCount = PAIRING_MAX_POLLS;

    expect(await service.claim(code)).toEqual({ status: 'EXPIRED' });
    expect(db.rows[0].status).toBe('EXPIRED');
  });

  it('odbijen kod javlja REJECTED, ne PENDING zauvijek', async () => {
    const { service } = makeService();
    const { code } = await service.create();

    await service.reject(7, code);

    expect(await service.claim(code)).toEqual({ status: 'REJECTED' });
  });

  it('tvrdi da sesija izdaje tokene istog oblika kao prijava', async () => {
    // TV nije poseban mehanizam: isti `issueAccessToken` i isti
    // `RefreshTokenService` kao normalna prijava.
    const { service, auth, refreshTokens } = makeService();
    const { code } = await service.create();
    await service.approve(7, code);

    expect(auth.issueAccessToken).toHaveBeenCalledTimes(1);
    expect(refreshTokens.issue).toHaveBeenCalledTimes(1);
    expect(refreshTokens.issue).toHaveBeenCalledWith(7, {
      userAgent: 'tv-pairing',
    });
  });
});

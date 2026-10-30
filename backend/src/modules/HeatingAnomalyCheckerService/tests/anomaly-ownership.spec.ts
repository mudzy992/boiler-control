/**
 * SEC-2 (B-009) — vlasništvo nad anomalijom.
 *
 * Prije popravke `confirmOrUpdateAnomaly(eventId, dto)` je radio
 * `findUnique({ where: { id } })` i `updateMany({ where: { id, isAnomaly } })`
 * BEZ ikakvog owner filtera, a controller nije ni čitao `req.user`. Svaki
 * prijavljeni korisnik je mogao zatvoriti tuđu anomaliju — i time pokrenuti
 * `processHeatingEvent` za TUĐEG korisnika, što je side effect na tuđim
 * preporukama, ne samo curenje podataka.
 *
 * Ovi testovi dokazuju:
 *  - A→A uspijeva;
 *  - A→B je odbijen, BEZ `updateMany` i BEZ `processHeatingEvent`;
 *  - tuđi i nepostojeći ID daju ISTI odgovor (ne curi postojanje);
 *  - owner filter je u samom `updateMany` where-u, pa je provjera atomska
 *    (nema TOCTOU između čitanja i upisa).
 */
import { HeatingAnomalyCheckerService } from '../heating.anomayl.checker.service';

type Row = {
  id: number;
  ownerUserId: number;
  isAnomaly: boolean;
  timestampEnd: Date | null;
  proposedEndTime: Date | null;
  roomCurrentTemp: number | null;
  roomTargetTemp: number | null;
};

function makeDb(rows: Row[]) {
  const calls: { updateMany: unknown[]; findUnique: unknown[] } = {
    updateMany: [],
    findUnique: [],
  };

  const matchesOwner = (row: Row, where: any): boolean => {
    if (where.id !== undefined && row.id !== where.id) return false;
    if (where.isAnomaly !== undefined && row.isAnomaly !== where.isAnomaly)
      return false;
    const ownerScope = where.thermostat?.userId;
    if (ownerScope !== undefined && row.ownerUserId !== ownerScope)
      return false;
    return true;
  };

  return {
    calls,
    rows,
    heatingEvent: {
      // Stari kod je koristio findUnique BEZ owner scope-a.
      findUnique: jest.fn(({ where }: any) => {
        calls.findUnique.push(where);
        const row = rows.find((r) => r.id === where.id);
        if (!row) return null;
        return {
          ...row,
          thermostat: {
            id: 100 + row.ownerUserId,
            userId: row.ownerUserId,
            homeProfileId: 1,
          },
        };
      }),
      // Novi kod mora koristiti findFirst s owner scope-om.
      findFirst: jest.fn(({ where }: any) => {
        const row = rows.find((r) => matchesOwner(r, where));
        if (!row) return null;
        return {
          ...row,
          thermostat: {
            id: 100 + row.ownerUserId,
            userId: row.ownerUserId,
            homeProfileId: 1,
          },
        };
      }),
      updateMany: jest.fn(({ where, data }: any) => {
        calls.updateMany.push(where);
        let count = 0;
        for (const row of rows) {
          if (matchesOwner(row, where)) {
            Object.assign(row, data);
            count += 1;
          }
        }
        return { count };
      }),
    },
    boilerHistory: {
      findFirst: jest.fn(() => ({
        actualFlowTemp: 55,
        suggestedFlowTemp: 50,
      })),
    },
  };
}

function makeService(db: ReturnType<typeof makeDb>) {
  const processHeatingEvent = jest.fn(() => undefined);
  const service = new HeatingAnomalyCheckerService(
    db as never,
    { sendNotification: jest.fn() } as never,
    { processHeatingEvent } as never,
    {} as never,
    {} as never,
    { incrementCounter: jest.fn() } as never,
    {} as never,
    { getId: jest.fn(() => 'corr') } as never,
  );
  return { service, processHeatingEvent };
}

function anomaly(id: number, ownerUserId: number): Row {
  return {
    id,
    ownerUserId,
    isAnomaly: true,
    timestampEnd: null,
    proposedEndTime: new Date('2026-10-30T10:00:00Z'),
    roomCurrentTemp: 21,
    roomTargetTemp: 23,
  };
}

describe('SEC-2: vlasništvo nad anomalijom', () => {
  const USER_A = 7;
  const USER_B = 9;

  it('vlasnik može potvrditi vlastitu anomaliju', async () => {
    const db = makeDb([anomaly(1, USER_A)]);
    const { service, processHeatingEvent } = makeService(db);

    const result = await service.confirmOrUpdateAnomaly(
      1,
      { confirm: true },
      USER_A,
    );

    expect(result.success).toBe(true);
    expect(db.rows[0].isAnomaly).toBe(false);
    expect(processHeatingEvent).toHaveBeenCalledTimes(1);
  });

  it('tuđa anomalija je odbijena i NE mijenja se', async () => {
    const db = makeDb([anomaly(1, USER_B)]);
    const { service, processHeatingEvent } = makeService(db);

    const result = await service.confirmOrUpdateAnomaly(
      1,
      { confirm: true },
      USER_A,
    );

    expect(result.success).toBe(false);
    expect(db.rows[0].isAnomaly).toBe(true);
    expect(db.rows[0].timestampEnd).toBeNull();
    // Ključno: bez owner scope-a ovdje bi se pokrenuo preporučni tok za USER_B.
    expect(processHeatingEvent).not.toHaveBeenCalled();
    expect(db.calls.updateMany).toHaveLength(0);
  });

  it('tuđi i nepostojeći ID daju ISTI odgovor (ne curi postojanje)', async () => {
    const db = makeDb([anomaly(1, USER_B)]);
    const { service } = makeService(db);

    const foreign = await service.confirmOrUpdateAnomaly(
      1,
      { confirm: true },
      USER_A,
    );
    const missing = await service.confirmOrUpdateAnomaly(
      999,
      { confirm: true },
      USER_A,
    );

    expect(foreign).toEqual(missing);
  });

  it('owner filter je u samom updateMany where-u (atomsko, bez TOCTOU)', async () => {
    const db = makeDb([anomaly(1, USER_A)]);
    const { service } = makeService(db);

    await service.confirmOrUpdateAnomaly(1, { confirm: true }, USER_A);

    expect(db.calls.updateMany).toHaveLength(1);
    expect(db.calls.updateMany[0]).toMatchObject({
      id: 1,
      isAnomaly: true,
      thermostat: { userId: USER_A },
    });
  });

  it('bez userId se odbija — nema anonimiziranog prolaza', async () => {
    const db = makeDb([anomaly(1, USER_A)]);
    const { service, processHeatingEvent } = makeService(db);

    const result = await service.confirmOrUpdateAnomaly(
      1,
      { confirm: true },
      undefined as never,
    );

    expect(result.success).toBe(false);
    expect(db.rows[0].isAnomaly).toBe(true);
    expect(processHeatingEvent).not.toHaveBeenCalled();
  });

  it('ponovljena potvrda već zatvorene anomalije daje isti odgovor kao nepostojeća', async () => {
    const db = makeDb([anomaly(1, USER_A)]);
    const { service } = makeService(db);

    const first = await service.confirmOrUpdateAnomaly(
      1,
      { confirm: true },
      USER_A,
    );
    const second = await service.confirmOrUpdateAnomaly(
      1,
      { confirm: true },
      USER_A,
    );

    expect(first.success).toBe(true);
    expect(second.success).toBe(false);
  });

  it('proizvoljni proposedEndTime se upisuje za vlasnika', async () => {
    const db = makeDb([anomaly(1, USER_A)]);
    const { service } = makeService(db);
    const proposed = new Date('2026-10-30T12:30:00Z');

    const result = await service.confirmOrUpdateAnomaly(
      1,
      { proposedEndTime: proposed },
      USER_A,
    );

    expect(result.success).toBe(true);
    expect(db.rows[0].timestampEnd).toEqual(proposed);
  });
});

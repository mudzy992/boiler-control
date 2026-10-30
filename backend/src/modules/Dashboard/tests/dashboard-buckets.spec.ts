import { DashboardService } from '../dashboard.service';

jest.mock('../../../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));
jest.mock('../../Boiler/boiler.service', () => ({
  BoilerService: class BoilerService {},
}));
jest.mock('../../Weather/weather.service', () => ({
  WeatherService: class WeatherService {},
}));

const FLAG = 'DASHBOARD_BUCKET_V2_ENABLED';

type FakeEvent = {
  id: number;
  deviceId: number;
  timestampStart: Date;
  timestampEnd: Date | null;
  roomCurrentTemp: number;
  roomTargetTemp: number;
};

function makeService(events: FakeEvent[]) {
  const db = {
    thermostatDevice: {
      count: () => Promise.resolve(1),
      findFirst: () => Promise.resolve(null),
      findMany: () => Promise.resolve([]),
    },
    heatingEvent: {
      findMany: () => Promise.resolve(events),
      findFirst: () => Promise.resolve(events[0] ?? null),
      count: () => Promise.resolve(events.length),
    },
    $transaction: async (operations: any) => Promise.all(operations),
  };
  return new DashboardService(db as any, {} as any, {} as any, {} as any);
}

function ev(id: number, iso: string): FakeEvent {
  return {
    id,
    deviceId: 11,
    timestampStart: new Date(iso),
    timestampEnd: new Date(iso),
    roomCurrentTemp: 20,
    roomTargetTemp: 22,
  };
}

const range = (from: string, to: string) =>
  ({ homeProfileId: 1, from, to }) as any;

describe('B-020: satni bucket spaja isti sat različitih dana', () => {
  const original = process.env[FLAG];
  afterEach(() => {
    if (original === undefined) delete process.env[FLAG];
    else process.env[FLAG] = original;
  });

  // Dva događaja u 10:00, ali različitih dana.
  const twoDays = [
    ev(1, '2026-01-01T10:00:00Z'),
    ev(2, '2026-01-02T10:00:00Z'),
  ];
  const q = range('2026-01-01T00:00:00Z', '2026-01-03T00:00:00Z');

  describe('v1 (zadano — ugovor koji isporučeni klijenti crtaju)', () => {
    beforeEach(() => delete process.env[FLAG]);

    it('summary spaja oba dana u jedan bucket', async () => {
      const res = await makeService(twoDays).getHeatingSummary(1, {
        ...q,
        bucket: 'hour',
      });
      expect(res.buckets).toHaveLength(1);
      expect(res.buckets[0].label).toBe('10:00');
      expect(res.buckets[0].cycles).toBe(2);
    });

    it('stats spaja oba dana u jedan bucket', async () => {
      const res = await makeService(twoDays).getHeatingStats(1, {
        ...q,
        bucket: 'hour',
      });
      expect(res.buckets).toHaveLength(1);
      expect(res.buckets[0].cycles).toBe(2);
    });
  });

  describe('v2 (zastavica uključena)', () => {
    beforeEach(() => {
      process.env[FLAG] = 'on';
    });

    it('summary razdvaja dane i labela nosi datum', async () => {
      const res = await makeService(twoDays).getHeatingSummary(1, {
        ...q,
        bucket: 'hour',
      });
      expect(res.buckets).toHaveLength(2);
      expect(res.buckets.map((b) => b.label).sort()).toEqual([
        '2026-01-01T10:00Z',
        '2026-01-02T10:00Z',
      ]);
      expect(res.buckets.every((b) => b.cycles === 1)).toBe(true);
    });

    it('stats razdvaja dane', async () => {
      const res = await makeService(twoDays).getHeatingStats(1, {
        ...q,
        bucket: 'hour',
      });
      expect(res.buckets).toHaveLength(2);
    });

    it('summary i stats koriste ISTI dnevni ključ (B-020: local vs UTC)', async () => {
      // 23:30Z — u zonama istočno od UTC-a ovo je već sljedeći dan.
      const midnight = [ev(1, '2026-01-01T23:30:00Z')];
      const dayQ = { ...q, bucket: 'day' };
      const summary = await makeService(midnight).getHeatingSummary(1, dayQ);
      const stats = await makeService(midnight).getHeatingStats(1, dayQ);

      expect(summary.buckets.map((b) => b.label)).toEqual(
        stats.buckets.map((b) => b.label),
      );
      expect(summary.buckets[0].label).toBe('2026-01-01');
    });
  });
});

/**
 * Bez `process.env.TZ`: jest ignoriše runtime dodjelu TZ (izmjereno), pa se
 * zona dokazuje eksplicitno kroz `Intl`. Kolaps v1 ključa za ovaj par zahtijeva
 * serversku zonu i dokazan je na nivou helpera; ovdje se dokazuje da v2 servis
 * razdvaja trenutke koji su lokalno isti sat.
 */
describe('B-020: DST ponovljeni sat kroz servis', () => {
  const original = process.env[FLAG];
  afterEach(() => {
    if (original === undefined) delete process.env[FLAG];
    else process.env[FLAG] = original;
  });

  // 00:30Z = 02:30 CEST, 01:30Z = 02:30 CET — isti lokalni sat, različiti trenuci.
  const dstPair = [
    ev(1, '2026-10-25T00:30:00Z'),
    ev(2, '2026-10-25T01:30:00Z'),
  ];
  const q = range('2026-10-25T00:00:00Z', '2026-10-26T00:00:00Z');

  const localHour = (d: Date) =>
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Sarajevo',
      hour: '2-digit',
      hour12: false,
    }).format(d);

  it('oba trenutka dijele lokalni sat u Europe/Sarajevo', () => {
    expect(localHour(dstPair[0].timestampStart)).toBe(
      localHour(dstPair[1].timestampStart),
    );
  });

  it('v2 razdvaja ponovljeni sat u dva bucket-a', async () => {
    process.env[FLAG] = 'on';
    const res = await makeService(dstPair).getHeatingSummary(1, {
      ...q,
      bucket: 'hour',
    });
    expect(res.buckets).toHaveLength(2);
    expect(res.buckets.map((b) => b.label).sort()).toEqual([
      '2026-10-25T00:00Z',
      '2026-10-25T01:00Z',
    ]);
  });

  it('stats isto razdvaja ponovljeni sat u v2', async () => {
    process.env[FLAG] = 'on';
    const res = await makeService(dstPair).getHeatingStats(1, {
      ...q,
      bucket: 'hour',
    });
    expect(res.buckets).toHaveLength(2);
  });
});

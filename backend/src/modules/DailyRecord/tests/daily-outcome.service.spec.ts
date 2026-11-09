jest.mock('../../../prisma/prisma.service', () => ({
  PrismaService: class {},
}));

import { DailyOutcomeService, OUTCOME_VERSION } from '../daily-outcome.service';

/**
 * Servis je jedini I/O sloj mjernog zapisa. Testovi ovdje čuvaju tri stvari
 * koje se ne vide iz čistih funkcija:
 *
 * 1. mjerni upis nikad ne dira polja predloga;
 * 2. upis je uslovljen sa `outcomeAt: null` (dva procesa ne smiju oba pisati);
 * 3. nepotpun dan se preskače sa razlogom, a ne upisuje kao nula.
 */

const ZONE = 'Europe/Sarajevo';
const DAY = '2026-11-06';
const PREVIOUS = '2026-11-05';
const NOW = new Date('2026-11-08T02:20:00Z'); // 03:20 Sarajevo

interface ObservationRow {
  at: Date;
  roomTempC: number | null;
  targetTempC: number | null;
  isHeating: boolean;
  outdoorTempC: number | null;
  flowSetC: number | null;
}

function localInstant(localDate: string, hour: number, minute = 0): Date {
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  return new Date(`${localDate}T${hh}:${mm}:00+01:00`);
}

function dayObservations(
  localDate: string,
  count = 288,
  overrides: (index: number) => Partial<ObservationRow> = () => ({}),
): ObservationRow[] {
  return Array.from({ length: count }, (_, index) => {
    const totalMinutes = index * 5;
    const changed = overrides(index);
    return {
      at: localInstant(localDate, Math.floor(totalMinutes / 60), totalMinutes % 60),
      roomTempC: changed.roomTempC === undefined ? 21 : changed.roomTempC,
      targetTempC: changed.targetTempC === undefined ? 21 : changed.targetTempC,
      isHeating: changed.isHeating ?? false,
      outdoorTempC: changed.outdoorTempC === undefined ? 3 : changed.outdoorTempC,
      flowSetC: changed.flowSetC === undefined ? 45 : changed.flowSetC,
    };
  });
}

function setup(options: {
  home?: Record<string, unknown> | null;
  pending?: Array<{ localDate: string }>;
  observations?: ObservationRow[];
  evidence?: Array<Record<string, unknown>>;
}) {
  const prisma = {
    homeProfile: {
      findUnique: jest.fn().mockResolvedValue(
        options.home === undefined
          ? { id: 10, weatherTimezone: ZONE, user: { timezone: null } }
          : options.home,
      ),
    },
    dailyRecord: {
      // Isti model, dva različita upita: noćni dokaz se prepoznaje po filteru
      // `nightFlowC`, a dnevni zapisi po `outcomeAt`.
      findMany: jest.fn((args: { where: Record<string, unknown> }) =>
        Promise.resolve(
          'nightFlowC' in args.where
            ? (options.evidence ?? [])
            : (options.pending ?? []),
        ),
      ),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    thermostatObservation: {
      findMany: jest.fn().mockResolvedValue(options.observations ?? []),
    },
  };

  const service = new DailyOutcomeService(prisma as never);
  return { service, prisma };
}

describe('DailyOutcomeService.fillHome', () => {
  it('bez dnevnih zapisa ne čita seriju i ne piše ništa', async () => {
    const { service, prisma } = setup({ pending: [] });

    const result = await service.fillHome(10, NOW);

    expect(result).toEqual({ homeProfileId: 10, filled: 0, skipped: 0, reasons: [] });
    expect(prisma.thermostatObservation.findMany).not.toHaveBeenCalled();
    expect(prisma.dailyRecord.updateMany).not.toHaveBeenCalled();
  });

  it('obračunat dan piše samo mjerna polja i to uz outcomeAt IS NULL', async () => {
    const { service, prisma } = setup({
      pending: [{ localDate: DAY }],
      observations: [
        ...dayObservations(PREVIOUS, 288),
        ...dayObservations(DAY, 288, (index) =>
          index === 100 ? { roomTempC: 19, targetTempC: 21 } : {},
        ),
      ],
    });

    const result = await service.fillHome(10, NOW);

    expect(result).toMatchObject({ filled: 1, skipped: 0, reasons: [] });
    expect(prisma.dailyRecord.updateMany).toHaveBeenCalledTimes(1);

    const call = prisma.dailyRecord.updateMany.mock.calls[0][0];
    expect(call.where).toEqual({
      homeProfileId: 10,
      localDate: DAY,
      outcomeAt: null,
    });

    const data = call.data;
    expect(data).toMatchObject({
      outcomeAt: NOW,
      outcomeVersion: OUTCOME_VERSION,
      comfortOk: false,
    });
    expect(data.undershootC).toBeCloseTo(2, 6);
    expect(data.nightFlowC).toBe(45);
    expect(data.nightMinOutdoorMeasuredC).toBe(3);

    // Nijedno polje predloga se ne smije naći u mjernom upisu.
    for (const key of [
      'proposedFlowTemp',
      'proposedAt',
      'skipReason',
      'seasonMode',
      'flowSetC',
    ]) {
      expect(data).not.toHaveProperty(key);
    }
  });

  it('nepotpun dan se preskače sa razlogom, a ne upisuje kao nula', async () => {
    const { service, prisma } = setup({
      pending: [{ localDate: DAY }],
      observations: dayObservations(DAY, 100),
    });

    const result = await service.fillHome(10, NOW);

    expect(result).toEqual({
      homeProfileId: 10,
      filled: 0,
      skipped: 1,
      reasons: [`${DAY}:INCOMPLETE`],
    });
    expect(prisma.dailyRecord.updateMany).not.toHaveBeenCalled();
  });

  it('ako je drugi proces upisao prvi, dan je preskočen a ne obračunat', async () => {
    const { service, prisma } = setup({
      pending: [{ localDate: DAY }],
      observations: dayObservations(DAY, 288),
    });
    prisma.dailyRecord.updateMany.mockResolvedValueOnce({ count: 0 });

    const result = await service.fillHome(10, NOW);

    expect(result).toEqual({
      homeProfileId: 10,
      filled: 0,
      skipped: 1,
      reasons: [`${DAY}:ALREADY_WRITTEN`],
    });
  });

  it('nepoznata kuća je greška, ne tihi preskok', async () => {
    const { service } = setup({ home: null });
    await expect(service.fillHome(999, NOW)).rejects.toThrow(/999/);
  });
});

describe('DailyOutcomeService.nightFloorFor', () => {
  it('bez prognoze ne čita historiju', async () => {
    const { service, prisma } = setup({});

    const result = await service.nightFloorFor(10, null, NOW);

    expect(result).toEqual({
      floorC: null,
      basis: 'NO_FORECAST',
      worstFailingFlowC: null,
      comparableNights: 0,
    });
    expect(prisma.dailyRecord.findMany).not.toHaveBeenCalled();
  });

  it('dokaz uzima samo noći sa polaznom, vanjskom i manjkom', async () => {
    const { service, prisma } = setup({
      evidence: [
        { nightFlowC: 44, nightMinOutdoorMeasuredC: -1, nightUndershootC: 2.1 },
        { nightFlowC: 46, nightMinOutdoorMeasuredC: 0.5, nightUndershootC: 0 },
      ],
    });

    const result = await service.nightFloorFor(10, 0, NOW);

    expect(prisma.dailyRecord.findMany.mock.calls[0][0].where).toMatchObject({
      homeProfileId: 10,
      nightFlowC: { not: null },
      nightMinOutdoorMeasuredC: { not: null },
      nightUndershootC: { not: null },
    });
    expect(result.basis).toBe('RAISED_FROM_FAILURE');
    expect(result.floorC).toBe(45);
    expect(result.worstFailingFlowC).toBe(44);
    expect(result.comparableNights).toBe(2);
  });

  it('nema dokaza → nema granice; kontroler tada ne smije spuštati polaznu', async () => {
    const { service } = setup({ evidence: [] });

    const result = await service.nightFloorFor(10, -5, NOW);

    expect(result.floorC).toBeNull();
    expect(result.basis).toBe('NO_EVIDENCE');
  });
});

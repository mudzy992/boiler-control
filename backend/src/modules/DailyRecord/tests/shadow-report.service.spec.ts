import { NotFoundException } from '@nestjs/common';
import { ShadowReportService } from '../shadow-report.service';

/**
 * Čitanje shadow izvještaja (`24` §6.5). Servis smije samo čitati i mora
 * odbiti tuđi dom — izvještaj nosi podatke o nečijem grijanju.
 */

function setup(options: {
  home?: { id: number } | null;
  rows?: unknown[];
} = {}) {
  const findMany = jest.fn().mockResolvedValue(options.rows ?? []);
  const prisma = {
    homeProfile: {
      findFirst: jest
        .fn()
        .mockResolvedValue(options.home === undefined ? { id: 7 } : options.home),
    },
    dailyRecord: { findMany },
  };

  const service = new ShadowReportService(prisma as never);
  return { service, prisma, findMany };
}

const rows = [
  {
    localDate: '2026-11-01',
    proposedFlowTemp: 45,
    shadowFlowC: 41,
    shadowAction: 'LOWER',
    shadowReasons: 'COMFORT_HOLD',
    shadowVersion: 'shadow-1',
    shadowAt: new Date('2026-11-01T06:00:00Z'),
  },
  {
    localDate: '2026-11-02',
    proposedFlowTemp: 45,
    shadowFlowC: 45,
    shadowAction: 'HOLD',
    shadowReasons: 'STEADY',
    shadowVersion: 'shadow-1',
    shadowAt: new Date('2026-11-02T06:00:00Z'),
  },
];

describe('ShadowReportService.forHome', () => {
  it('vraća izvještaj za dom korisnika', async () => {
    const { service } = setup({ rows });
    const report = await service.forHome(3, 7);

    expect(report).toMatchObject({
      homeProfileId: 7,
      days: 2,
      evaluated: 2,
      differences: 1,
      lowered: 1,
      raised: 0,
      verdict: 'NOT_ENOUGH_DAYS',
    });
  });

  it('traži dom po id-u **i** vlasniku — tuđi dom je 404, ne prazan izvještaj', async () => {
    const { service, prisma, findMany } = setup({ home: null });

    await expect(service.forHome(3, 99)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.homeProfile.findFirst).toHaveBeenCalledWith({
      where: { id: 99, userId: 3 },
      select: { id: true },
    });
    expect(findMany).not.toHaveBeenCalled();
  });

  it('bez perioda ne filtrira po datumu', async () => {
    const { service, findMany } = setup({ rows });
    await service.forHome(3, 7);
    expect(findMany.mock.calls[0][0].where).toEqual({ homeProfileId: 7 });
  });

  it('period se prevodi u `gte`/`lte` nad `localDate`', async () => {
    const { service, findMany } = setup({ rows });
    await service.forHome(3, 7, { from: '2026-11-01', to: '2026-11-30' });

    expect(findMany.mock.calls[0][0]).toMatchObject({
      where: {
        homeProfileId: 7,
        localDate: { gte: '2026-11-01', lte: '2026-11-30' },
      },
      orderBy: { localDate: 'asc' },
    });
  });

  it('samo `from` ne dodaje `lte`', async () => {
    const { service, findMany } = setup({ rows });
    await service.forHome(3, 7, { from: '2026-11-01' });
    expect(findMany.mock.calls[0][0].where.localDate).toEqual({
      gte: '2026-11-01',
    });
  });

  it('prazan period daje NO_DATA, ne grešku', async () => {
    const { service } = setup({ rows: [] });
    const report = await service.forHome(3, 7);
    expect(report.verdict).toBe('NO_DATA');
    expect(report.days).toBe(0);
  });
});

jest.mock('../../../prisma/prisma.service', () => ({
  PrismaService: class {},
}));
jest.mock('../../Notification/notifications.service', () => ({
  NotificationsService: class {},
}));
jest.mock('../../DailyRecord/daily-record.writer', () => ({
  DailyRecordWriter: class {},
}));

import { DailyRecommendationService } from '../daily.recommendation.service';

/**
 * Posao je od `0 0 * * *` (ponoć UTC) postao kucanje svakih pet minuta koje
 * pita svaku kuću koliko je sati kod nje. Ovaj spec zakucava tri stvari koje se
 * tu mogu pokvariti: koga zvati, koga ne zvati, i da obavijest ne ode dvaput.
 *
 * Samo pisanje zapisa testira `DailyRecord/daily-record-writer.spec.ts` — ovdje
 * je pisac mock, jer je predmet ovog testa raspodjela, ne upis.
 */

const NOW = new Date('2026-11-08T05:30:00Z'); // 06:30 Sarajevo, 00:30 New York

function home(
  id: number,
  userId: number,
  extra: {
    activeHomeProfileId?: number | null;
    timezone?: string | null;
    weatherTimezone?: string | null;
  } = {},
) {
  return {
    id,
    weatherTimezone:
      extra.weatherTimezone === undefined
        ? 'Europe/Sarajevo'
        : extra.weatherTimezone,
    user: {
      id: userId,
      timezone: extra.timezone ?? null,
      activeHomeProfileId:
        extra.activeHomeProfileId === undefined ? id : extra.activeHomeProfileId,
    },
  };
}

function setup(options: {
  homes: ReturnType<typeof home>[];
  existing?: { homeProfileId: number; localDate: string }[];
  writeResults?: Record<number, unknown>;
  alreadyNotified?: boolean;
}) {
  const prisma = {
    homeProfile: { findMany: jest.fn().mockResolvedValue(options.homes) },
    dailyRecord: {
      findMany: jest.fn().mockResolvedValue(options.existing ?? []),
    },
    notification: {
      findFirst: jest.fn().mockResolvedValue(options.alreadyNotified ? { id: 1 } : null),
    },
  };

  const notifications = { notifyUser: jest.fn().mockResolvedValue(null) };

  const writer = {
    writeForHome: jest.fn(async (homeProfileId: number) => {
      const preset = options.writeResults?.[homeProfileId];
      if (preset instanceof Error) throw preset;
      if (preset) return preset;
      return {
        status: 'created',
        localDate: '2026-11-08',
        timeZone: 'Europe/Sarajevo',
        timeZoneSource: 'HOME',
        userId: 1,
        homeProfileId,
        proposedFlowTemp: 44,
        skipReason: null,
      };
    }),
  };

  const service = new DailyRecommendationService(
    prisma as any,
    notifications as any,
    writer as any,
  );
  return { service, prisma, notifications, writer };
}

describe('dnevna raspodjela', () => {
  it('piše samo za kuću kojoj je lokalno prošlo 06:00', async () => {
    const { service, writer, notifications } = setup({
      homes: [
        home(10, 1),
        home(20, 2, { weatherTimezone: 'America/New_York' }),
      ],
    });

    await service.generateDailyRecommendations(NOW);

    expect(writer.writeForHome).toHaveBeenCalledTimes(1);
    expect(writer.writeForHome).toHaveBeenCalledWith(10, NOW);
    expect(notifications.notifyUser).toHaveBeenCalledTimes(1);
    expect(notifications.notifyUser.mock.calls[0][0]).toMatchObject({
      userId: 1,
      message: expect.stringContaining('44°C'),
      data: { recommendedFlowTemp: 44, localDate: '2026-11-08' },
    });
  });

  it('ne zove pisca ako zapis za taj dan već postoji', async () => {
    const { service, writer, notifications } = setup({
      homes: [home(10, 1)],
      existing: [{ homeProfileId: 10, localDate: '2026-11-08' }],
    });

    await service.generateDailyRecommendations(NOW);

    expect(writer.writeForHome).not.toHaveBeenCalled();
    expect(notifications.notifyUser).not.toHaveBeenCalled();
  });

  it('ne šalje obavijest kad predloga nema', async () => {
    const { service, notifications } = setup({
      homes: [home(10, 1)],
      writeResults: {
        10: {
          status: 'skipped',
          localDate: '2026-11-08',
          timeZone: 'Europe/Sarajevo',
          timeZoneSource: 'HOME',
          userId: 1,
          homeProfileId: 10,
          proposedFlowTemp: null,
          skipReason: 'OUT_OF_SEASON',
        },
      },
    });

    await service.generateDailyRecommendations(NOW);

    expect(notifications.notifyUser).not.toHaveBeenCalled();
  });

  it('ne šalje drugu obavijest istog dana', async () => {
    const { service, notifications } = setup({
      homes: [home(10, 1)],
      alreadyNotified: true,
    });

    await service.generateDailyRecommendations(NOW);

    expect(notifications.notifyUser).not.toHaveBeenCalled();
  });

  it('greška na jednoj kući ne sprječava drugu', async () => {
    const { service, writer, notifications } = setup({
      homes: [home(10, 1), home(30, 3)],
      writeResults: { 10: new Error('baza je pala') },
    });

    await service.generateDailyRecommendations(NOW);

    expect(writer.writeForHome).toHaveBeenCalledTimes(2);
    expect(notifications.notifyUser).toHaveBeenCalledTimes(1);
  });

  it('prije 06:00 lokalno ne dira bazu zapisa', async () => {
    const { service, writer, prisma } = setup({
      homes: [home(10, 1)],
    });

    await service.generateDailyRecommendations(
      new Date('2026-11-08T04:00:00Z'), // 05:00 Sarajevo
    );

    expect(writer.writeForHome).not.toHaveBeenCalled();
    expect(prisma.dailyRecord.findMany).not.toHaveBeenCalled();
  });
});

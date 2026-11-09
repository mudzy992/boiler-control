// heating/daily.recommendation.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../Notification/notifications.service';
import { NotificationType } from 'src/generated/prisma';
import {
  DailyRecordWriter,
  type DailyRecordWriteResult,
} from '../DailyRecord/daily-record.writer';
import { ProposalShadowService } from '../DailyRecord/proposal-shadow.service';
import { selectDueHomes, type DueHomeSource } from '../DailyRecord/daily-record.due';

/**
 * Jutarnji predlog — ali **ne** kao jedan posao u 06:00 UTC.
 *
 * Zašto ne `0 0 * * *`: taj izraz je ponoć UTC, a ne 06:00, i nema
 * `timeZone` — u kontejneru na UTC-u predlog bi za korisnika u BiH nastajao u
 * 07:00/08:00, a `localDate` bi bio od jučer. Jedan globalni cron ne može
 * pogoditi lokalno jutro za više zona.
 *
 * Zato posao kuca svakih pet minuta i **pita svaku kuću koliko je sati kod
 * nje**: ako je lokalno ≥ 06:00 i zapis za taj dan ne postoji, nastaje.
 * Posljedice, sve tri namjerne:
 *  - predlog stiže u 06:00–06:05 lokalno, ne u 06:00 UTC;
 *  - ako je server bio ugašen u 06:00, isti dan se nadoknađuje pri prvom
 *    narednom kucanju (do 12:00, poslije toga `MISSED_WINDOW`);
 *  - ako je dan propušten cijeli, **ne izmišlja se naknadno**: prognoza na
 *    osnovu koje bi predlog nastao više ne postoji, a zapis bi tvrdio odluku
 *    koja nije donesena.
 *
 * Sam upis ne radi ova metoda nego `DailyRecordWriter` — jedini pisac
 * (`17` §13).
 */
@Injectable()
export class DailyRecommendationService {
  private readonly logger = new Logger(DailyRecommendationService.name);

  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationsService,
    private readonly dailyRecordWriter: DailyRecordWriter,
    private readonly proposalShadow: ProposalShadowService,
  ) {}

  @Cron('*/5 * * * *', {
    name: 'daily-recommendations',
    disabled:
      process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test',
  })
  async generateDailyRecommendations(now: Date = new Date()) {
    const homes = (await this.prisma.homeProfile.findMany({
      where: { user: { isActive: true } },
      include: { user: true },
    })) as unknown as DueHomeSource[];

    const due = selectDueHomes(homes, now);
    if (due.length === 0) return;

    // Jedan upit za sve kandidate, pa tek onda pisanje — bez ovoga bi svako
    // kucanje (288 dnevno) išlo u bazu po svakoj kući.
    const existing = await this.prisma.dailyRecord.findMany({
      where: {
        homeProfileId: { in: [...new Set(due.map((home) => home.homeProfileId))] },
        localDate: { in: [...new Set(due.map((home) => home.localDate))] },
      },
      select: { homeProfileId: true, localDate: true },
    });
    const written = new Set(
      existing.map((row) => `${row.homeProfileId}|${row.localDate}`),
    );

    let created = 0;

    for (const target of due) {
      if (written.has(`${target.homeProfileId}|${target.localDate}`)) continue;

      try {
        const result = await this.dailyRecordWriter.writeForHome(
          target.homeProfileId,
          now,
        );
        if (result.status === 'created') {
          created += 1;
          // Shadow odluka ide uz predlog, ali ga ne dira. Ako padne, predlog
          // ostaje kakav jeste — shadow nikad ne smije oboriti ono što je
          // korisnik dobio.
          try {
            await this.proposalShadow.evaluate(
              result.homeProfileId,
              result.localDate,
              now,
            );
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(
              `Shadow odluka nije izračunata za kuću ${result.homeProfileId}: ${message}`,
            );
          }
        }
        await this.announce(result, now);
      } catch (error) {
        const stack = error instanceof Error ? error.stack : String(error);
        this.logger.error(
          `Dnevni zapis nije nastao za kuću ${target.homeProfileId}: ${stack}`,
        );
      }
    }

    if (created > 0) {
      this.logger.log(
        `${created} novih dnevnih zapisa (06:00 lokalno po kući).`,
      );
    }
  }

  /**
   * Obavijest ide samo kad je predlog zaista nastao u ovom pozivu. Ako je
   * red već postojao, neko drugi ga je napisao i obavijest je već otišla (ili
   * je namjerno preskočena) — ponavljanje bi bilo laž.
   */
  private async announce(result: DailyRecordWriteResult, now: Date) {
    if (result.status !== 'created') {
      if (result.status === 'skipped') {
        this.logger.log(
          `Kuća ${result.homeProfileId} (${result.localDate}): bez predloga — ${result.skipReason}.`,
        );
      }
      return;
    }

    if (result.proposedFlowTemp == null) return;

    const alreadySent = await this.prisma.notification.findFirst({
      where: {
        userId: result.userId,
        type: NotificationType.DAILY_RECOMMENDATION,
        createdAt: { gte: startOfUtcDay(now) },
      },
    });

    if (alreadySent) {
      this.logger.warn(
        `Obavijest o predlogu za korisnika ${result.userId} već postoji za danas — preskačem.`,
      );
      return;
    }

    await this.notificationService.notifyUser({
      userId: result.userId,
      type: NotificationType.DAILY_RECOMMENDATION,
      title: 'Preporučena temperatura',
      message: `Nova dnevna preporučena polazna temperatura kotla je ${result.proposedFlowTemp}°C`,
      data: {
        type: NotificationType.DAILY_RECOMMENDATION,
        recommendedFlowTemp: result.proposedFlowTemp,
        localDate: result.localDate,
      },
    });

    this.logger.log(
      `Korisnik ${result.userId} | ${result.localDate} | predlog ${result.proposedFlowTemp}°C (${result.timeZone}).`,
    );
  }
}

/** Početak UTC dana — samo za deduplikaciju obavijesti, ne za poslovnu logiku. */
function startOfUtcDay(now: Date): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

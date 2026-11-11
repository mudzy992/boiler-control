import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { shadowReport, type ShadowReport } from './shadow-report';

/**
 * Čitanje shadow perioda (`24` §6.5) — **samo čita**.
 *
 * Namjerno odvojeno od `ProposalShadowService`, koji piše: jedan servis koji i
 * piše i pravi izvještaj nad sopstvenim upisima lakše previdi dan koji nedostaje.
 * Ovdje se ne mijenja ništa, pa se smije zvati koliko god puta.
 */

export interface ShadowReportWindow {
  /** Uključivo, `YYYY-MM-DD`. */
  from?: string;
  /** Uključivo, `YYYY-MM-DD`. */
  to?: string;
}

@Injectable()
export class ShadowReportService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Izvještaj za dom. Provjera vlasništva je ovdje, a ne u kontroleru: servis
   * se može zvati i iz scheduled posla, pa pravilo mora putovati s njim.
   */
  async forHome(
    userId: number,
    homeProfileId: number,
    window: ShadowReportWindow = {},
  ): Promise<ShadowReport & { homeProfileId: number }> {
    const home = await this.prisma.homeProfile.findFirst({
      where: { id: homeProfileId, userId },
      select: { id: true },
    });

    if (!home) {
      throw new NotFoundException(`HomeProfile ${homeProfileId} nije pronađen`);
    }

    const rows = await this.prisma.dailyRecord.findMany({
      where: {
        homeProfileId,
        ...(window.from || window.to
          ? {
              localDate: {
                ...(window.from ? { gte: window.from } : {}),
                ...(window.to ? { lte: window.to } : {}),
              },
            }
          : {}),
      },
      orderBy: { localDate: 'asc' },
      select: {
        localDate: true,
        proposedFlowTemp: true,
        shadowFlowC: true,
        shadowAction: true,
        shadowReasons: true,
        shadowVersion: true,
        shadowExploration: true,
        shadowAt: true,
      },
    });

    return { homeProfileId, ...shadowReport(rows) };
  }
}

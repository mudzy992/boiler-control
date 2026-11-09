import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class HeatingService {
  private readonly logger = new Logger(HeatingService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Fetch heating events for a user's thermostat devices
   */
  /**
   * Događaji grijanja, straničeno i filtrirano (`36`).
   *
   * Prije: `take: 100` bez ikakve oznake da još postoji, bez filtera i sa
   * `catch` koji je vraćao **prazan niz** na grešku. Troje je bilo netačno na
   * isti način — ekran je tvrdio „nema zapisa" i kad ih je bilo 400 i kad je
   * upit pao. Sada se greška diže dalje (tabela pokaže „greška"), a ukupan broj
   * ide u `X-Total-Count`.
   */
  async getHeatingEvents(
    userId: number,
    page: {
      limit: number;
      offset: number;
      from?: Date;
      to?: Date;
      deviceId?: number;
    } = { limit: 50, offset: 0 },
  ): Promise<{ rows: any[]; total: number }> {
    const where: any = { thermostat: { userId } };

    if (page.deviceId !== undefined) where.deviceId = page.deviceId;
    if (page.from || page.to) {
      where.timestampStart = {
        ...(page.from ? { gte: page.from } : {}),
        ...(page.to ? { lte: page.to } : {}),
      };
    }

    const [rows, total] = await Promise.all([
      this.prisma.heatingEvent.findMany({
        where,
        orderBy: { timestampStart: 'desc' },
        take: page.limit,
        skip: page.offset,
      }),
      this.prisma.heatingEvent.count({ where }),
    ]);

    return { rows, total };
  }
}

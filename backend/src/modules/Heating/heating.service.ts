import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class HeatingService {
  private readonly logger = new Logger(HeatingService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Fetch heating events for a user's thermostat devices
   */
  async getHeatingEvents(userId: number) {
    try {
      const events = await this.prisma.heatingEvent.findMany({
        where: {
          thermostat: {
            userId,
          },
        },
        orderBy: { timestampStart: 'desc' },
        take: 100,
      });
      return events;
    } catch (error) {
      this.logger.error('Error fetching heating events', error);
      return [];
    }
  }
}

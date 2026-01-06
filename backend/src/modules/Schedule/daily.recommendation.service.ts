import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { BoilerService } from '../Boiler/boiler.service';

@Injectable()
export class DailyRecommendationService {
  private readonly logger = new Logger(DailyRecommendationService.name);

  constructor(
    private prisma: PrismaService,
    private boilerService: BoilerService,
  ) {}

  // svaki dan u 6:00
  @Cron('0 6 * * *')
  async generateDailyRecommendations() {
    this.logger.log('Starting daily boiler recommendations...');

    const users = await this.prisma.user.findMany();

    for (const user of users) {
      try {
        // pretpostavljamo da user ima city info u homeProfile
        if (!user.homeLocation) continue;

        const startTemp = await this.boilerService.createMorningBoilerHistory(
          user.id,
          user.homeLocation,
        );

        this.logger.log(
          `User ${user.id} morning BoilerHistory created with suggested: ${startTemp.suggestedTemp}°C`,
        );
      } catch (err) {
        this.logger.error(`Failed for user ${user.id}: ${err}`);
      }
    }

    this.logger.log('Daily recommendations finished.');
  }
}

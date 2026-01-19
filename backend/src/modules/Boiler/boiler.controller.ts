import { Controller, Post, UseGuards, Req, Logger } from '@nestjs/common';
import { JwtAuthGuard } from '../Auth/jwt-auth.guard';
import { BoilerService } from './boiler.service';

@Controller('api/boiler')
export class BoilerController {
  private readonly logger = new Logger(BoilerController.name);

  constructor(private readonly boilerService: BoilerService) {}

  /**
   * Manualni sync / kreiranje jutarnjeg boiler history
   */
  @UseGuards(JwtAuthGuard)
  @Post('sync')
  async manualSync(@Req() req) {
    const userId = req.user.userId; // assuming userId je u JWT payload
    this.logger.log(`Manual boiler sync triggered by user ${userId}`);

    try {
      const history = await this.boilerService.calculateFlowTemp(userId);
      return {
        success: true,
        message: 'Boiler history successfully synced',
        data: history,
      };
    } catch (err) {
      this.logger.error(
        `Manual boiler sync failed for user ${userId}`,
        err.stack,
      );
      return {
        success: false,
        message: 'Failed to sync boiler history',
        error: err.message,
      };
    }
  }
}

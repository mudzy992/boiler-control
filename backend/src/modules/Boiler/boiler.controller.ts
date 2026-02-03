import { Controller, Get, Post, UseGuards, Req, Logger } from '@nestjs/common';
import { JwtAuthGuard } from '../Auth/jwt-auth.guard';
import { BoilerService } from './boiler.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Boiler')
@ApiBearerAuth()
@Controller('api/boiler')
export class BoilerController {
  private readonly logger = new Logger(BoilerController.name);

  constructor(private readonly boilerService: BoilerService) {}

  /**
   * Get boiler history for user
   */
  @UseGuards(JwtAuthGuard)
  @Get('history')
  async getHistory(@Req() req) {
    try {
      const userId = req.user.userId;
      const history = await this.boilerService.getBoilerHistory(userId);
      return history;
    } catch (error) {
      this.logger.error('Failed to fetch boiler history', error);
      return [];
    }
  }

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

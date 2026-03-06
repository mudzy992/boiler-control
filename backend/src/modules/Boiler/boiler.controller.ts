<<<<<<< Updated upstream
<<<<<<< Updated upstream
<<<<<<< Updated upstream
<<<<<<< Updated upstream
<<<<<<< Updated upstream
<<<<<<< Updated upstream
import { Controller, Post, UseGuards, Req, Logger } from '@nestjs/common';
import { JwtAuthGuard } from '../Auth/jwt-auth.guard';
import { BoilerService } from './boiler.service';
=======
=======
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  UseGuards,
  Req,
  Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../Auth/jwt-auth.guard';
import { BoilerService } from './boiler.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SetCurrentTempDto } from './dto/set-current-temp.dto';
<<<<<<< Updated upstream
<<<<<<< Updated upstream
<<<<<<< Updated upstream
<<<<<<< Updated upstream
<<<<<<< Updated upstream
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes

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

  /**
   * User-confirmed current boiler flow temperature
   */
  @UseGuards(JwtAuthGuard)
  @Patch('current-temp')
  async setCurrentTemp(@Req() req, @Body() dto: SetCurrentTempDto) {
    const userId = req.user.userId;

    try {
      const data = await this.boilerService.setCurrentTemp(
        userId,
        dto.currentFlowTemp,
      );
      return {
        success: true,
        data,
      };
    } catch (error) {
      this.logger.error(
        `Failed to set current boiler temp for user ${userId}`,
        error.stack,
      );
      return {
        success: false,
        message: 'Failed to set current boiler temp',
        error: error.message,
      };
    }
  }
}

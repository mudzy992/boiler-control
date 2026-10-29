import { Controller, Get, Post, UseGuards, Req, Body } from '@nestjs/common';
import { throwIfStubRejected } from '../../common/stub-endpoint';
import { JwtAuthGuard } from '../Auth/jwt-auth.guard';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { HeatingService } from './heating.service';

/**
 * Heating Events Controller (P2a)
 * Provides endpoints for managing heating events
 */
@ApiTags('Heating Events')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/heating-events')
export class HeatingController {
  constructor(private heatingService: HeatingService) {}

  /**
   * Create a heating event (manual creation for testing)
   */
  @Post()
  createHeatingEvent(
    @Req() req,
    @Body()
    body: {
      deviceId: number;
      roomCurrentTemp: number;
      roomTargetTemp: number;
      roomFlowTemp: number;
    },
  ) {
    // API-1 / B-001: ovo je bio stub koji je vraćao IZMIŠLJENI
    // `Math.floor(Math.random() * 10000)` ID i NIŠTA nije upisivao u bazu —
    // klijent je mislio da je zapis kreiran. Potrošači su verificirani:
    // nijedan `.post()` u frontend/ ni mobile/ ne zove heating-events.
    // `legacy` režim vraća staro ponašanje kao rollback put.
    throwIfStubRejected('POST /api/heating-events');

    return {
      id: Math.floor(Math.random() * 10000),
      deviceId: body.deviceId,
      timestampStart: new Date().toISOString(),
      roomCurrentTemp: body.roomCurrentTemp,
      roomTargetTemp: body.roomTargetTemp,
      roomFlowTemp: body.roomFlowTemp,
      userId: req.user.userId,
    };
  }

  /**
   * Get heating events for the authenticated user
   */
  @Get()
  async getHeatingEvents(@Req() req) {
    return this.heatingService.getHeatingEvents(req.user.userId);
  }
}

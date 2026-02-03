import { Controller, Get, Post, UseGuards, Req, Body } from '@nestjs/common';
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
  async createHeatingEvent(
    @Req() req,
    @Body()
    body: {
      deviceId: number;
      roomCurrentTemp: number;
      roomTargetTemp: number;
      roomFlowTemp: number;
    },
  ) {
    // Stub: return basic event structure
    // Full implementation deferred to P2c/P3a
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
    return this.heatingService.getHeatingEvents(req.user.id);
  }
}

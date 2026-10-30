// heating-anomaly.controller.ts
import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../Auth/jwt-auth.guard';
import { UpdateHeatingAnomalyDto } from './dto/heating-anomaly.dto';
import { HeatingAnomalyCheckerService } from './heating.anomayl.checker.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Anomalies')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/anomalies')
export class HeatingAnomalyController {
  constructor(private checker: HeatingAnomalyCheckerService) {}

  // Get anomalies for the authenticated user
  @Get()
  async getOpenAnomalies(@Req() req) {
    return this.checker.getOpenAnomalies(req.user.userId);
  }

  // Update anomaly status
  @Patch(':eventId')
  async updateAnomaly(
    @Param('eventId') eventId: number,
    @Body() dto: UpdateHeatingAnomalyDto,
    @Req() req,
  ) {
    // SEC-2: userId dolazi iz JWT-a, nikad iz tijela zahtjeva — klijent ga ne
    // može podvaliti.
    return this.checker.confirmOrUpdateAnomaly(eventId, dto, req.user.userId);
  }
}

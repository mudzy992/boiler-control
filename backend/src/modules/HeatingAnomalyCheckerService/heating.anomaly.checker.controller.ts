// heating-anomaly.controller.ts
import { Controller, Get, Patch, Param, Body } from '@nestjs/common';
import { UpdateHeatingAnomalyDto } from './dto/heating-anomaly.dto';
import { HeatingAnomalyCheckerService } from './heating.anomayl.checker.service';

@Controller('heating-anomalies')
export class HeatingAnomalyController {
  constructor(private checker: HeatingAnomalyCheckerService) {}

  // 1️⃣ Pregled otvorenih anomalija
  @Get()
  async getOpenAnomalies() {
    return this.checker.getOpenAnomalies();
  }

  // 2️⃣ Potvrda ili izmjena predloženog završetka
  @Patch(':eventId')
  async updateAnomaly(
    @Param('eventId') eventId: number,
    @Body() dto: UpdateHeatingAnomalyDto,
  ) {
    return this.checker.confirmOrUpdateAnomaly(eventId, dto);
  }
}

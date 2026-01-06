import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { BoilerService } from './boiler.service';
import { JwtAuthGuard } from '../Auth/jwt-auth.guard';

@Controller('api/boiler')
export class BoilerController {
  constructor(private boilerService: BoilerService) {}

  @UseGuards(JwtAuthGuard)
  @Get('start-temp')
  async getStartTemp(
    @Query('city') city: string,
    @Query('userId') userId: string,
  ) {
    const suggested = await this.boilerService.calculateStartTemp(
      +userId,
      city,
    );
    return { city, suggestedTemp: suggested };
  }
}

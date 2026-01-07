import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../Auth/jwt-auth.guard';
import { ReadonlyService } from './readonly.service';
import { Public } from '../Auth/public.decorator';

@Controller('api/readonly')
export class ReadonlyController {
  constructor(private readonly readonlyService: ReadonlyService) {}

  @UseGuards(JwtAuthGuard)
  @Get('weather')
  async getWeather(@Query('city') city?: string) {
    return this.readonlyService.getWeatherCache(city);
  }

  @UseGuards(JwtAuthGuard)
  @Get('boiler-history')
  async getBoilerHistory(@Req() req: any) {
    return this.readonlyService.getBoilerHistory(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('recommendations')
  async getRecommendations(@Req() req: any) {
    return this.readonlyService.getRecommendations(req.user.userId);
  }

  @Public()
  @Get('last-recommendation')
  async getLastRecommendation() {
    return this.readonlyService.getLastRecommendation();
  }
}

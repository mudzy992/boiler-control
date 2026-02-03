import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../Auth/jwt-auth.guard';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

/**
 * Weather Controller (P2a)
 * Provides endpoints for weather data
 * Full implementation deferred to later phases
 */
@ApiTags('Weather')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/weather')
export class WeatherController {
  /**
   * Get weather data for the authenticated user
   */
  @Get()
  async getWeatherData(@Req() req) {
    // Stub: return empty object or null
    // Full implementation: fetch from weather service and return current/forecast
    return {};
  }
}

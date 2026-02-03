import { Controller, Get } from '@nestjs/common';
import { Public } from '../modules/Auth/public.decorator';
import { ApiTags } from '@nestjs/swagger';

/**
 * Health check endpoint for monitoring and orchestration
 */
@ApiTags('Health')
@Controller('health')
export class HealthController {
  /**
   * GET /health
   * Returns 200 OK if the service is healthy
   */
  @Public()
  @Get()
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}

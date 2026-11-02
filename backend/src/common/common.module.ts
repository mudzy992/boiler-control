import { Module } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { MetricsController } from './metrics.controller';
import { MetricsAuthGuard } from './metrics-auth.guard';
import { HealthController } from './health.controller';
import { AppConfigController } from './app-config.controller';
import { AppConfigService } from './app-config.service';
import { AnomalyDetectionService } from './anomaly-detection.service';
import { FallbackStrategyService } from './fallback-strategy.service';
import { ReportingService } from './reporting.service';
import { CorrelationIdService } from './correlation-id.service';
import { FileStorageService } from './file-storage.service';
import { RedisHealthService } from './redis-health.service';
import { DatabaseHealthService } from './database-health';

@Module({
  controllers: [MetricsController, HealthController, AppConfigController],
  providers: [
    MetricsAuthGuard,
    MetricsService,
    AnomalyDetectionService,
    FallbackStrategyService,
    ReportingService,
    CorrelationIdService,
    FileStorageService,
    AppConfigService,
    RedisHealthService,
    DatabaseHealthService,
  ],
  exports: [
    MetricsService,
    AnomalyDetectionService,
    FallbackStrategyService,
    ReportingService,
    CorrelationIdService,
    FileStorageService,
    AppConfigService,
    RedisHealthService,
  ],
})
export class CommonModule {}

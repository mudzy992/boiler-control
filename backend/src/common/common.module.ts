import { Module } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { MetricsController } from './metrics.controller';
import { HealthController } from './health.controller';
import { AnomalyDetectionService } from './anomaly-detection.service';
import { FallbackStrategyService } from './fallback-strategy.service';
import { ReportingService } from './reporting.service';
import { CorrelationIdService } from './correlation-id.service';
import { FileStorageService } from './file-storage.service';

@Module({
  controllers: [MetricsController, HealthController],
  providers: [
    MetricsService,
    AnomalyDetectionService,
    FallbackStrategyService,
    ReportingService,
    CorrelationIdService,
    FileStorageService,
  ],
  exports: [
    MetricsService,
    AnomalyDetectionService,
    FallbackStrategyService,
    ReportingService,
    CorrelationIdService,
    FileStorageService,
  ],
})
export class CommonModule {}

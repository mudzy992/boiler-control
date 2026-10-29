import { Logger } from '@nestjs/common';
import { CorrelationIdService } from './correlation-id.service';

/**
 * Structured logging context for distributed tracing and observability.
 * Adds correlation IDs and structured metadata to all logs.
 */
export interface LogContext {
  deviceId?: number | string;
  userId?: number;
  eventId?: number;
  runId?: string; // Correlation ID for poll cycle
  module?: string;
  action?: string;
  durationMin?: number;
  // P2c: Anomaly Detection
  anomalyTypes?: string | string[];
  confidence?: number;
  currentDuration?: number;
  averageDuration?: number;
  standardDeviation?: number;
  historicalCount?: number;
  // P2c: Fallback Strategy
  fallbackType?: string;
  adapterType?: string;
  usedCache?: boolean;
  endTime?: Date;
  // Allow additional properties
  [key: string]: any;
}

export class StructuredLogger {
  private readonly logger: Logger;
  private correlationIdService?: CorrelationIdService;

  constructor(context: string, correlationIdService?: CorrelationIdService) {
    this.logger = new Logger(context);
    this.correlationIdService = correlationIdService;
  }

  debug(message: string, ctx?: LogContext) {
    this.logger.debug(this.formatMessage(message, ctx));
  }

  log(message: string, ctx?: LogContext) {
    this.logger.log(this.formatMessage(message, ctx));
  }

  warn(message: string, ctx?: LogContext) {
    this.logger.warn(this.formatMessage(message, ctx));
  }

  error(message: string, error?: Error | string, ctx?: LogContext) {
    const errorMsg = error instanceof Error ? error.message : error || '';
    this.logger.error(this.formatMessage(message, ctx), errorMsg);
  }

  private formatMessage(message: string, ctx?: LogContext): string {
    if (!ctx) {
      ctx = {};
    }

    // If runId is not provided, try to read from CorrelationIdService context
    if (!ctx.runId && this.correlationIdService) {
      try {
        const store = this.correlationIdService.getStore();
        if (store && store.runId) {
          ctx = { ...ctx, runId: store.runId };
        }
      } catch {
        // Silently fail if context read is not available
      }
    }

    const parts: string[] = [message];

    if (ctx.runId) parts.push(`[runId=${ctx.runId}]`);
    if (ctx.deviceId) parts.push(`[deviceId=${ctx.deviceId}]`);
    if (ctx.userId) parts.push(`[userId=${ctx.userId}]`);
    if (ctx.eventId) parts.push(`[eventId=${ctx.eventId}]`);
    if (ctx.action) parts.push(`[${ctx.action}]`);
    if (ctx.durationMin !== undefined)
      parts.push(`[durationMin=${ctx.durationMin}]`);

    return parts.join(' ');
  }
}

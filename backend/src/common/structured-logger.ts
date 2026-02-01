import { Logger } from '@nestjs/common';

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
}

export class StructuredLogger {
  private readonly logger: Logger;

  constructor(context: string) {
    this.logger = new Logger(context);
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
    if (!ctx) return message;

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

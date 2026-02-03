// src/common/correlation-id.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

/**
 * Manages correlation IDs for tracing requests across async flows
 * Uses AsyncLocalStorage for true async context isolation (Node.js >= 13)
 * Correlation IDs enable tracking of related operations across multiple services/logs
 */

export interface CorrelationContext {
  runId: string;
}

@Injectable()
export class CorrelationIdService {
  private readonly logger = new Logger(CorrelationIdService.name);
  private readonly asyncLocalStorage =
    new AsyncLocalStorage<CorrelationContext>();

  /**
   * Generate a new correlation ID (runId)
   * Format: run_<timestamp>_<random>
   */
  generateRunId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 15);
    return `run_${timestamp}_${random}`;
  }

  /**
   * Set the current run ID for this execution context
   * Updates the AsyncLocalStorage context without creating a new store
   */
  setRunId(runId: string): void {
    const store = this.asyncLocalStorage.getStore();
    if (store) {
      store.runId = runId;
    } else {
      // If no store exists, initialize one
      this.asyncLocalStorage.enterWith({ runId });
    }
  }

  /**
   * Get the current run ID
   * If no context exists, generates a new runId and stores it
   */
  getRunId(): string {
    const store = this.asyncLocalStorage.getStore();
    if (store && store.runId) {
      return store.runId;
    }

    const newRunId = this.generateRunId();
    this.asyncLocalStorage.enterWith({ runId: newRunId });
    return newRunId;
  }

  /**
   * Clear the run ID for this context
   * Note: AsyncLocalStorage clears automatically when async context ends
   */
  clearRunId(): void {
    const store = this.asyncLocalStorage.getStore();
    if (store) {
      store.runId = '';
    }
  }

  /**
   * Create a new run context with correlation ID
   * Wraps async/sync functions with proper context propagation
   */
  createRunContext<T>(
    description: string,
    fn: (runId: string) => T | Promise<T>,
  ): T | Promise<T> {
    const runId = this.generateRunId();

    return this.asyncLocalStorage.run({ runId }, () => {
      this.logger.debug(`[${runId}] Starting: ${description}`);

      try {
        const result = fn(runId);

        if (result instanceof Promise) {
          return result
            .then((res) => {
              this.logger.debug(`[${runId}] Completed: ${description}`);
              return res;
            })
            .catch((err) => {
              this.logger.error(`[${runId}] Failed: ${description}`, err);
              throw err;
            });
        }

        this.logger.debug(`[${runId}] Completed: ${description}`);
        return result;
      } catch (err) {
        this.logger.error(`[${runId}] Failed: ${description}`, err);
        throw err;
      }
    });
  }

  /**
   * Wrap a function to include correlation ID in all calls
   * Preserves async context so nested calls inherit the same runId
   */
  wrapWithRunId<T extends (...args: any[]) => any>(
    fn: T,
  ): (...args: Parameters<T>) => ReturnType<T> {
    return ((...args: Parameters<T>) => {
      const runId = this.getRunId();
      return fn(...args);
    }) as T;
  }

  /**
   * Get the current store for testing or direct context access
   */
  getStore(): CorrelationContext | undefined {
    return this.asyncLocalStorage.getStore();
  }
}

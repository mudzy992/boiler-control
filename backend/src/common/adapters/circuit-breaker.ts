/**
 * Circuit Breaker State Machine
 * Manages state transitions and failure tracking for resilience
 */

export enum CircuitBreakerState {
  CLOSED = 'CLOSED', // Normal operation, requests passing through
  OPEN = 'OPEN', // Threshold exceeded, requests failing fast
  HALF_OPEN = 'HALF_OPEN', // Testing recovery, allowing single request
}

export interface CircuitBreakerConfig {
  failureThreshold: number; // Number of consecutive failures to trip (default: 5)
  recoveryTimeout: number; // Milliseconds before attempting recovery (default: 30000)
  name: string; // Identifier for logging/metrics
}

export interface CircuitBreakerMetrics {
  state: CircuitBreakerState;
  failureCount: number;
  successCount: number;
  lastFailureTime?: Date;
  nextAttemptTime?: Date;
  totalTrips: number;
}

export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime?: Date;
  private nextAttemptTime?: Date;
  private totalTrips = 0;
  private readonly config: CircuitBreakerConfig;

  constructor(config: CircuitBreakerConfig) {
    this.config = config;
  }

  getState(): CircuitBreakerState {
    return this.state;
  }

  getMetrics(): CircuitBreakerMetrics {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      nextAttemptTime: this.nextAttemptTime,
      totalTrips: this.totalTrips,
    };
  }

  /**
   * Records a failure and transitions state if threshold exceeded
   */
  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = new Date();

    if (
      this.state === CircuitBreakerState.CLOSED &&
      this.failureCount >= this.config.failureThreshold
    ) {
      this.transitionToOpen();
    } else if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.transitionToOpen();
    }
  }

  /**
   * Records a success and transitions state
   */
  recordSuccess(): void {
    this.successCount++;

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.transitionToClosed();
    }
  }

  /**
   * Checks if the breaker should attempt recovery
   */
  canAttempt(): boolean {
    if (this.state === CircuitBreakerState.CLOSED) {
      return true;
    }

    if (this.state === CircuitBreakerState.OPEN) {
      const now = new Date();
      if (
        this.nextAttemptTime &&
        now.getTime() >= this.nextAttemptTime.getTime()
      ) {
        this.transitionToHalfOpen();
        return true;
      }
      return false;
    }

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      return true;
    }

    return false;
  }

  /**
   * Resets the breaker to CLOSED state with zero failures
   */
  reset(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = undefined;
    this.nextAttemptTime = undefined;
  }

  private transitionToOpen(): void {
    this.state = CircuitBreakerState.OPEN;
    this.failureCount = 0;
    this.nextAttemptTime = new Date(Date.now() + this.config.recoveryTimeout);
    this.totalTrips++;
  }

  private transitionToHalfOpen(): void {
    this.state = CircuitBreakerState.HALF_OPEN;
    this.failureCount = 0;
  }

  private transitionToClosed(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttemptTime = undefined;
  }
}

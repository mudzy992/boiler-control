/**
 * HTTP Adapter
 * Concrete implementation of BaseAdapter for HTTP/REST calls
 * Wraps external HTTP requests (Tuya, Weather, etc.) with circuit breaker and timeout protection
 */

import { Injectable, Logger } from '@nestjs/common';
import * as axios from 'axios';
import { BaseAdapter, AdapterConfig, TimeoutError } from './base-adapter';
import { MetricsService } from '../metrics.service';
import { StructuredLogger } from '../structured-logger';

export interface HttpAdapterConfig extends AdapterConfig {
  baseUrl?: string;
  headers?: Record<string, string>;
}

@Injectable()
export class HttpAdapter extends BaseAdapter {
  protected readonly logger = new Logger(HttpAdapter.name);
  private readonly axiosInstance: axios.AxiosInstance;
  private readonly httpConfig: HttpAdapterConfig;

  constructor(
    config: HttpAdapterConfig,
    metricsService?: MetricsService,
    structuredLogger?: StructuredLogger,
  ) {
    super(config, metricsService, structuredLogger);
    this.httpConfig = config;

    // Create axios instance with timeout
    this.axiosInstance = axios.default.create({
      baseURL: config.baseUrl,
      headers: config.headers || {},
      timeout: config.timeout,
    });
  }

  /**
   * Execute HTTP GET request with circuit breaker protection
   */
  async get<T>(endpoint: string, context?: { runId?: string }): Promise<T> {
    return this.executeWithCircuitBreaker(
      async () => {
        try {
          const response = await this.axiosInstance.get<T>(endpoint);
          return response.data;
        } catch (error) {
          this.handleHttpError(error, endpoint, 'GET', context?.runId);
        }
      },
      { ...context, endpoint },
    );
  }

  /**
   * Execute HTTP POST request with circuit breaker protection
   */
  async post<T>(
    endpoint: string,
    data: any,
    context?: { runId?: string },
  ): Promise<T> {
    return this.executeWithCircuitBreaker(
      async () => {
        try {
          const response = await this.axiosInstance.post<T>(endpoint, data);
          return response.data;
        } catch (error) {
          this.handleHttpError(error, endpoint, 'POST', context?.runId);
        }
      },
      { ...context, endpoint },
    );
  }

  /**
   * Execute HTTP PUT request with circuit breaker protection
   */
  async put<T>(
    endpoint: string,
    data: any,
    context?: { runId?: string },
  ): Promise<T> {
    return this.executeWithCircuitBreaker(
      async () => {
        try {
          const response = await this.axiosInstance.put<T>(endpoint, data);
          return response.data;
        } catch (error) {
          this.handleHttpError(error, endpoint, 'PUT', context?.runId);
        }
      },
      { ...context, endpoint },
    );
  }

  /**
   * Execute HTTP DELETE request with circuit breaker protection
   */
  async delete<T>(endpoint: string, context?: { runId?: string }): Promise<T> {
    return this.executeWithCircuitBreaker(
      async () => {
        try {
          const response = await this.axiosInstance.delete<T>(endpoint);
          return response.data;
        } catch (error) {
          this.handleHttpError(error, endpoint, 'DELETE', context?.runId);
        }
      },
      { ...context, endpoint },
    );
  }

  /**
   * Implementation of abstract method
   */
  async executeRequest<T>(
    endpoint: string,
    options?: Record<string, any>,
  ): Promise<T> {
    const { method = 'GET', data, ...rest } = options || {};

    const context = rest.context || {};

    switch (method.toUpperCase()) {
      case 'POST':
        return this.post<T>(endpoint, data, context);
      case 'PUT':
        return this.put<T>(endpoint, data, context);
      case 'DELETE':
        return this.delete<T>(endpoint, context);
      case 'GET':
      default:
        return this.get<T>(endpoint, context);
    }
  }

  /**
   * Handle HTTP errors and convert to appropriate custom errors
   */
  private handleHttpError(
    error: any,
    endpoint: string,
    method: string,
    runId?: string,
  ): never {
    if (error instanceof axios.AxiosError) {
      if (error.code === 'ECONNABORTED') {
        this.logger.warn(
          `[${this.config.name}] Request timeout on ${method} ${endpoint}`,
          { runId },
        );
        throw new TimeoutError(
          `${this.config.name} request timeout on ${method} ${endpoint}`,
        );
      }

      const status = error.response?.status;
      const statusText = error.response?.statusText;

      this.logger.error(
        `[${this.config.name}] HTTP Error on ${method} ${endpoint}`,
        {
          runId,
          status,
          statusText,
          message: error.message,
        },
      );

      throw error;
    }

    if (error instanceof TimeoutError) {
      throw error;
    }

    this.logger.error(
      `[${this.config.name}] Unexpected error on ${method} ${endpoint}`,
      {
        runId,
        message: error instanceof Error ? error.message : String(error),
      },
    );

    throw error;
  }

  /**
   * Update base URL at runtime
   */
  setBaseUrl(baseUrl: string): void {
    this.axiosInstance.defaults.baseURL = baseUrl;
  }

  /**
   * Update headers at runtime
   */
  setHeaders(headers: Record<string, string>): void {
    Object.assign(this.axiosInstance.defaults.headers.common, headers);
  }
}

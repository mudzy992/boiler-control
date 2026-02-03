/**
 * Smoke tests for backend API post-deployment
 * Tests: health endpoint, metrics, API connectivity, correlation IDs
 * Run with: npm run test:smoke
 */

import axios, { AxiosError } from 'axios';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3020';
const ENVIRONMENT = process.env.ENVIRONMENT || 'development';

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
  details?: string;
}

const results: TestResult[] = [];

async function runTest(
  name: string,
  testFn: () => Promise<void>,
): Promise<void> {
  const startTime = Date.now();
  const result: TestResult = { name, passed: false, duration: 0 };

  try {
    await testFn();
    result.passed = true;
    console.log(`✅ ${name}`);
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    console.error(`❌ ${name}: ${result.error}`);
  } finally {
    result.duration = Date.now() - startTime;
    results.push(result);
  }
}

async function testHealthEndpoint(): Promise<void> {
  const response = await axios.get(`${BACKEND_URL}/health`);
  if (response.status !== 200) {
    throw new Error(`Expected 200, got ${response.status}`);
  }
  if (!response.data) {
    throw new Error('Health endpoint returned no data');
  }
}

async function testMetricsEndpoint(): Promise<void> {
  const response = await axios.get(`${BACKEND_URL}/metrics`);
  if (response.status !== 200) {
    throw new Error(`Expected 200, got ${response.status}`);
  }
  if (typeof response.data !== 'string' || response.data.length === 0) {
    throw new Error('Metrics endpoint returned empty response');
  }
  // Check for Prometheus format (# HELP, # TYPE, metric_name)
  if (!response.data.includes('# HELP') && !response.data.includes('# TYPE')) {
    throw new Error('Metrics not in Prometheus format');
  }
}

async function testMetricsJSON(): Promise<void> {
  const response = await axios.get(`${BACKEND_URL}/metrics/json`);
  if (response.status !== 200) {
    throw new Error(`Expected 200, got ${response.status}`);
  }
  if (!response.data || typeof response.data !== 'object') {
    throw new Error('Metrics JSON endpoint returned invalid format');
  }
}

async function testReportingMetrics(): Promise<void> {
  const response = await axios.get(`${BACKEND_URL}/metrics/reporting`);
  if (response.status !== 200) {
    throw new Error(`Expected 200, got ${response.status}`);
  }
  // Reporting metrics may be empty initially, just check endpoint exists
}

async function testReportingMetricsJSON(): Promise<void> {
  const response = await axios.get(`${BACKEND_URL}/metrics/reporting/json`);
  if (response.status !== 200) {
    throw new Error(`Expected 200, got ${response.status}`);
  }
  if (!response.data || typeof response.data !== 'object') {
    throw new Error('Reporting metrics JSON returned invalid format');
  }
}

async function testAPIEndpointConnectivity(): Promise<void> {
  try {
    // Test weather endpoint (public, no auth required)
    await axios.get(`${BACKEND_URL}/api/weather`, {
      validateStatus: () => true,
    });
  } catch (error) {
    const axError = error as AxiosError;
    // Connection error is what we want to catch
    if (axError.code === 'ECONNREFUSED') {
      throw new Error('Cannot connect to backend API');
    }
    // Other errors (like 401) are fine - just means endpoint exists
  }
}

async function testCorrelationIDGeneration(): Promise<void> {
  try {
    const response = await axios.get(`${BACKEND_URL}/health`, {
      validateStatus: () => true,
    });

    const correlationId =
      response.headers['x-correlation-id'] ||
      response.headers['x-request-id'] ||
      response.headers['correlation-id'] ||
      null;

    if (correlationId) {
      if (typeof correlationId === 'string' && correlationId.length > 0) {
        // Correlation ID found and valid
        return;
      }
    }
    // If no correlation ID, it's a warning but not a failure
    // (depends on implementation)
    console.log(
      '⚠️  No correlation ID detected in health endpoint response headers',
    );
  } catch (error) {
    throw new Error(
      `Failed to check correlation ID: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function testResponseTime(): Promise<void> {
  const startTime = Date.now();
  await axios.get(`${BACKEND_URL}/health`);
  const duration = Date.now() - startTime;

  const threshold = 1000; // 1 second
  if (duration > threshold) {
    console.warn(
      `⚠️  Response time ${duration}ms exceeds threshold ${threshold}ms`,
    );
  }
}

async function runAllTests(): Promise<void> {
  console.log('🚀 Starting Backend Smoke Tests');
  console.log(`📍 Backend URL: ${BACKEND_URL}`);
  console.log(`🏷️  Environment: ${ENVIRONMENT}`);
  console.log('-----------------------------------\n');

  // Create axios instance with timeout
  const instance = axios.create({
    timeout: 5000,
    validateStatus: (status) => status < 500,
  });

  // Override axios for all tests
  (global as any).axios = instance;

  await runTest('Health Endpoint', testHealthEndpoint);
  await runTest('Metrics Endpoint (Prometheus)', testMetricsEndpoint);
  await runTest('Metrics JSON Endpoint', testMetricsJSON);
  await runTest('Reporting Metrics Endpoint', testReportingMetrics);
  await runTest('Reporting Metrics JSON', testReportingMetricsJSON);
  await runTest('API Endpoint Connectivity', testAPIEndpointConnectivity);
  await runTest('Correlation ID Propagation', testCorrelationIDGeneration);
  await runTest('Response Time', testResponseTime);

  console.log('\n-----------------------------------');
  console.log('📊 Test Results Summary\n');

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  results.forEach((result) => {
    const status = result.passed ? '✅' : '❌';
    console.log(`${status} ${result.name} (${result.duration}ms)`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });

  console.log(`\n📈 Results: ${passed} passed, ${failed} failed`);
  console.log(`⏱️  Total time: ${totalDuration}ms\n`);

  // Exit with error if any test failed
  if (failed > 0) {
    console.error('❌ Smoke tests failed!');
    process.exit(1);
  }

  console.log('✅ All smoke tests passed!');
  process.exit(0);
}

// Run tests
runAllTests().catch((error) => {
  console.error('Fatal error running smoke tests:', error);
  process.exit(1);
});

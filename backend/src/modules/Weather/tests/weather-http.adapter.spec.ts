import { WeatherHttpAdapter } from '../weather-http.adapter';

function makeAdapter() {
  const metrics = { incrementCounter: jest.fn() };
  const adapter = Reflect.construct(WeatherHttpAdapter, [
    metrics,
  ]) as WeatherHttpAdapter;
  return { adapter, metrics };
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
  jest.clearAllMocks();
});

describe('WeatherHttpAdapter logical request metrics', () => {
  it('counts a direct SDK execution once on success', async () => {
    const { adapter, metrics } = makeAdapter();
    await expect(
      adapter.executeWithCircuitBreaker(() => Promise.resolve('ok')),
    ).resolves.toBe('ok');

    expect(metrics.incrementCounter).toHaveBeenCalledWith(
      'weather_requests_total',
    );
    expect(metrics.incrementCounter).toHaveBeenCalledWith(
      'weather_requests_success',
    );
    expect(metrics.incrementCounter).not.toHaveBeenCalledWith(
      'weather_requests_failed',
    );
    expect(
      metrics.incrementCounter.mock.calls.filter(
        ([name]) => name === 'weather_requests_total',
      ),
    ).toHaveLength(1);
  });

  it('counts one logical failure and its timeout even when the base retries', async () => {
    const { adapter, metrics } = makeAdapter();
    const pending = adapter.executeWithCircuitBreaker(() =>
      Promise.reject(new Error('weather provider timeout')),
    );
    const rejection = expect(pending).rejects.toThrow(
      'weather provider timeout',
    );
    await jest.advanceTimersByTimeAsync(2000);
    await rejection;

    expect(
      metrics.incrementCounter.mock.calls.filter(
        ([name]) => name === 'weather_requests_total',
      ),
    ).toHaveLength(1);
    expect(
      metrics.incrementCounter.mock.calls.filter(
        ([name]) => name === 'weather_requests_failed',
      ),
    ).toHaveLength(1);
    expect(metrics.incrementCounter).toHaveBeenCalledWith(
      'weather_timeout_errors',
    );
    expect(metrics.incrementCounter).not.toHaveBeenCalledWith(
      'weather_requests_success',
    );
  });
});

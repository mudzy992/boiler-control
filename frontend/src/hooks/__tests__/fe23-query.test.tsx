import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../services/api';
import { createQueryClient } from '../../lib/queryClient';
import { queryKeys } from '../../lib/queryKeys';
import { useNotificationsQuery } from '../useNotifications';
import { useGasReadingsQuery } from '../useGasQueries';
import {
  DASHBOARD_HEATING_POLL_MS,
  useDashboardHeatingRange,
} from '../useDashboardHeatingRange';

/**
 * FE2-3: React Query mora dijeliti cache između stranica/drawera, ne smije
 * duplicirati gasna očitanja, i ne smije pollati skrivani tab.
 */

function makeWrapper(client: ReturnType<typeof createQueryClient>) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function makeTestClient() {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  return client;
}

afterEach(() => {
  vi.useRealTimers();
  Object.defineProperty(document, 'visibilityState', {
    value: 'visible',
    configurable: true,
  });
});

describe('FE2-3 QueryClient defaults', () => {
  it('postavlja konzervativne globalne defaulte i pauzira background polling', () => {
    const client = createQueryClient();
    const defaults = client.getDefaultOptions().queries;

    expect(defaults?.staleTime).toBe(30_000);
    expect(defaults?.retry).toBe(1);
    expect(defaults?.refetchOnWindowFocus).toBe(true);
    expect(defaults?.refetchIntervalInBackground).toBe(false);
    client.clear();
  });
});

describe('FE2-3 shared notification cache', () => {
  it('drawer i stranica dijele isti notifications key i jedan API poziv', async () => {
    const client = makeTestClient();
    const notifications = [
      {
        id: 1,
        type: 'SYSTEM_ALERT',
        title: 'Test',
        message: 'Poruka',
        sentAt: '2026-11-01T10:00:00.000Z',
        isRead: false,
      },
    ];
    const spy = vi
      .spyOn(apiClient, 'getNotifications')
      .mockResolvedValue(notifications);

    const wrapper = makeWrapper(client);
    const drawer = renderHook(() => useNotificationsQuery(), { wrapper });
    const page = renderHook(() => useNotificationsQuery(), { wrapper });

    await waitFor(() => expect(drawer.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(page.result.current.isSuccess).toBe(true));

    expect(queryKeys.notifications).toEqual(['notifications']);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(drawer.result.current.data).toEqual(notifications);
    expect(page.result.current.data).toEqual(notifications);
    client.clear();
  });
});

describe('FE2-3 shared gas readings cache', () => {
  it('gas readings i gas analytics dijele isti key i ne dupliciraju poziv', async () => {
    const client = makeTestClient();
    const readings = [
      {
        id: 1,
        counterValue: 123.456,
        readingDate: '2026-11-01T00:00:00.000Z',
        createdAt: '2026-11-01T00:00:00.000Z',
      },
    ];
    const spy = vi
      .spyOn(apiClient, 'getGasReadings')
      .mockResolvedValue(readings);

    const wrapper = makeWrapper(client);
    const readingsPage = renderHook(() => useGasReadingsQuery(), { wrapper });
    const analyticsPage = renderHook(() => useGasReadingsQuery(), { wrapper });

    await waitFor(() => expect(readingsPage.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(analyticsPage.result.current.isSuccess).toBe(true));

    expect(queryKeys.gasReadings).toEqual(['gas-readings']);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(readingsPage.result.current.data).toEqual(readings);
    expect(analyticsPage.result.current.data).toEqual(readings);
    client.clear();
  });
});

describe('FE2-3 dashboard heating polling visibility', () => {
  it('polla dok je tab vidljiv, staje kad je skriven, nastavlja kad je vidljiv', async () => {
    vi.useFakeTimers();
    const client = makeTestClient();
    const events = vi
      .spyOn(apiClient, 'getDashboardHeatingEvents')
      .mockResolvedValue({ data: [] });
    vi.spyOn(apiClient, 'getDashboardHeatingSummary').mockResolvedValue({
      summary: {},
      buckets: [],
    });
    const status = vi
      .spyOn(apiClient, 'getDashboardHeatingStatus')
      .mockResolvedValue({ isHeatingNow: false });

    const { result } = renderHook(
      () =>
        useDashboardHeatingRange({
          from: '2026-11-01T00:00:00.000Z',
          to: '2026-11-01T23:59:59.000Z',
          bucket: 'hour',
        }),
      { wrapper: makeWrapper(client) },
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(result.current.isSuccess).toBe(true);
    expect(status).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(DASHBOARD_HEATING_POLL_MS);
    });
    expect(status).toHaveBeenCalledTimes(2);

    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      configurable: true,
    });
    document.dispatchEvent(new Event('visibilitychange'));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(DASHBOARD_HEATING_POLL_MS * 3);
    });
    expect(status).toHaveBeenCalledTimes(2);
    expect(events).toHaveBeenCalledTimes(2);

    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    });
    document.dispatchEvent(new Event('visibilitychange'));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(DASHBOARD_HEATING_POLL_MS);
    });
    expect(status.mock.calls.length).toBeGreaterThan(2);
    client.clear();
  });
});

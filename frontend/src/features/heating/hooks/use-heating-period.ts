import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/services/api";
import { queryKeys } from "@/lib/queryKeys";
import type { HeatingSummaryResponse } from "@/features/dashboard/types";
import {
  previousRange,
  rangeForPeriod,
  type HeatingPeriod,
  type HeatingRange,
} from "../lib/heating-period";
import type { HeatingPeriodMetrics } from "../components/heating-period-summary";

/**
 * D1 — podaci za birač perioda grijanja.
 *
 * Dva upita, ista funkcija: tekući i **prethodni** period. Bez drugog broj ne
 * znači ništa — „12 ciklusa" je dobro ili loše samo u odnosu na prošlu sedmicu.
 *
 * `HeatingSummaryResponse` je isti tip koji već koristi `use-dashboard-page`,
 * pa web ne dobija drugu definiciju istog odgovora.
 */

const EMPTY: HeatingPeriodMetrics = {
  totalCycles: 0,
  totalDurationMin: 0,
  avgDurationMin: 0,
  avgIndoorTemp: null,
};

function toMetrics(
  response: HeatingSummaryResponse | undefined,
): HeatingPeriodMetrics | null {
  const summary = response?.summary;
  if (!summary) return null;
  return {
    totalCycles: summary.totalCycles ?? EMPTY.totalCycles,
    totalDurationMin: summary.totalDurationMin ?? EMPTY.totalDurationMin,
    avgDurationMin: summary.avgDurationMin ?? EMPTY.avgDurationMin,
    // `null` ostaje `null` (B1) — nije 0.
    avgIndoorTemp: summary.avgIndoorTemp ?? null,
    excludedZeroTemp: (summary as { excludedZeroTemp?: number })
      .excludedZeroTemp,
    openCycles: (summary as { openCycles?: number }).openCycles,
  };
}

/** Rasponi se šalju kao `YYYY-MM-DD`; summary traži ISO trenutke. */
function toIsoRange(range: HeatingRange): { from: string; to: string } {
  return {
    from: new Date(`${range.from}T00:00:00`).toISOString(),
    to: new Date(`${range.to}T23:59:59.999`).toISOString(),
  };
}

export function useHeatingPeriod(initial: HeatingPeriod = "week") {
  const [period, setPeriod] = useState<HeatingPeriod>(initial);

  const range = useMemo(() => rangeForPeriod(period), [period]);
  const previous = useMemo(() => previousRange(range), [range]);

  const currentQuery = useQuery({
    queryKey: queryKeys.heatingSummary(range.from, range.to, range.bucket),
    queryFn: () =>
      apiClient.getDashboardHeatingSummary({
        ...toIsoRange(range),
        bucket: range.bucket,
      }),
  });

  const previousQuery = useQuery({
    queryKey: queryKeys.heatingSummary(
      previous.from,
      previous.to,
      previous.bucket,
    ),
    queryFn: () =>
      apiClient.getDashboardHeatingSummary({
        ...toIsoRange(previous),
        bucket: previous.bucket,
      }),
  });

  return {
    period,
    setPeriod,
    range,
    previous,
    current: toMetrics(currentQuery.data as HeatingSummaryResponse | undefined),
    previousMetrics: toMetrics(
      previousQuery.data as HeatingSummaryResponse | undefined,
    ),
    isLoading: currentQuery.isLoading || previousQuery.isLoading,
    isError: currentQuery.isError || previousQuery.isError,
    refetch: () => {
      void currentQuery.refetch();
      void previousQuery.refetch();
    },
    isFetching: currentQuery.isFetching || previousQuery.isFetching,
  };
}

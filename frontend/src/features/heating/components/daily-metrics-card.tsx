import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/services/api";
import { queryKeys } from "@/lib/queryKeys";
import { Card, CardContent } from "@/shared/components/ui/Card";
import { StatCard } from "@/shared/components/stat-card";
import { QueryState } from "@/shared/components/query-state";
import type { DailyMetricField } from "@/features/reports/types";
import {
  averageOfMeasured,
  evaluateMetricsGate,
  fieldsWithData,
} from "../lib/metrics-gate";

/**
 * C1 — kartica nad dnevnim mjernim kolonama.
 *
 * Kolone su mjerene i zapisane od početka, a do 16.11. ih **nijedan** endpoint
 * nije čitao (§1.1 audita). Ovo je prvi ekran nad njima.
 *
 * **Kapija.** Mjerenje kaže 5,8 % dana — plan zato traži prikaz **tek** od 25 %.
 * Do tada kartice nema, i to je odluka, ne propust: prazan ekran na 94 % dana
 * izgleda kao kvar.
 *
 * **Nula nije nedostatak.** `DailyMetricsService` izostavlja nemjerena polja
 * (B1 dogovor), pa polje koje fali znači „nije mjereno", a `0` znači „mjereno i
 * nula". Kartica prikazuje prosjek **samo preko dana koji imaju mjerenje** —
 * prosjek preko svih dana bi tiho uračunao izostanak kao nulu.
 */

/** Kolone koje kartica prikazuje, sa jedinicom i brojem decimala. */
const FIELD_META: Partial<
  Record<DailyMetricField, { labelKey: string; unit: string; digits: number }>
> = {
  dutyPercent: { labelKey: "heating.metricsDuty", unit: "%", digits: 0 },
  medianCycleMin: {
    labelKey: "heating.metricsMedianCycle",
    unit: "min",
    digits: 0,
  },
  overshootC: { labelKey: "heating.metricsOvershoot", unit: "K", digits: 2 },
  undershootC: { labelKey: "heating.metricsUndershoot", unit: "K", digits: 2 },
  hysteresisK: { labelKey: "heating.metricsHysteresis", unit: "K", digits: 2 },
  hysteresisAsymmetryK: {
    labelKey: "heating.metricsHysteresisAsymmetry",
    unit: "K",
    digits: 2,
  },
  heatRateCPerHour: {
    labelKey: "heating.metricsHeatRate",
    unit: "K/h",
    digits: 2,
  },
  nightUndershootC: {
    labelKey: "heating.metricsNightUndershoot",
    unit: "K",
    digits: 2,
  },
  nightMinOutdoorMeasuredC: {
    labelKey: "heating.metricsNightOutdoor",
    unit: "°C",
    digits: 1,
  },
  nightFlowC: { labelKey: "heating.metricsNightFlow", unit: "°C", digits: 1 },
  flowSetC: { labelKey: "heating.metricsFlowSet", unit: "°C", digits: 1 },
  degreeHours: {
    labelKey: "heating.metricsDegreeHours",
    unit: "Kh",
    digits: 1,
  },
};

export function DailyMetricsCard({
  homeProfileId,
  from,
  to,
}: {
  homeProfileId: number | undefined;
  from: string;
  to: string;
}): JSX.Element | null {
  const { t } = useTranslation();

  const metricsQuery = useQuery({
    queryKey: queryKeys.dailyMetrics(homeProfileId ?? 0, from, to),
    queryFn: () =>
      apiClient.getDailyMetrics({ homeProfileId: homeProfileId!, from, to }),
    enabled: !!homeProfileId,
  });

  const gate = evaluateMetricsGate(metricsQuery.data?.coverage);

  /*
   * Kapija se provjerava PRIJE renderovanja skeleta: dok se ne zna pokrivenost,
   * nema smisla prikazati okvir kartice kojeg će nestati. Skelet se prikazuje
   * samo dok je upit u toku.
   */
  if (metricsQuery.isLoading) {
    return (
      <QueryState status="loading" minHeightClassName="min-h-32">
        {null}
      </QueryState>
    );
  }

  if (!gate.visible) return null;

  const fields = fieldsWithData(metricsQuery.data?.coverage).filter(
    (entry) => FIELD_META[entry.field as DailyMetricField] !== undefined,
  );

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-text-primary">
            {t("heating.metricsTitle")}
          </h2>
          <p className="text-xs text-text-secondary">
            {t("heating.metricsSubtitle")}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {fields.map(({ field }) => {
            const meta = FIELD_META[field as DailyMetricField]!;
            const average = averageOfMeasured(
              metricsQuery.data?.rows ?? [],
              field as DailyMetricField,
            );
            return (
              <StatCard
                key={field}
                title={t(meta.labelKey)}
                value={
                  average === null ? "—" : average.value.toFixed(meta.digits)
                }
                suffix={meta.unit}
              />
            );
          })}
        </div>

        {/*
         * Pokrivenost je dio odgovora, pa se i prikazuje: bez nje korisnik ne
         * zna da je prosjek iz 5 dana, a ne iz 86 — a to je razlika između
         * mjerenja i utiska.
         */}
        <p className="text-xs text-text-secondary">
          {t("heating.metricsCoverage", {
            best: gate.percent,
            days: metricsQuery.data?.coverage.bestFieldShare
              ? (fieldsWithData(metricsQuery.data?.coverage)[0]?.days ?? 0)
              : 0,
            total: metricsQuery.data?.coverage.days ?? 0,
          })}
        </p>
      </CardContent>
    </Card>
  );
}

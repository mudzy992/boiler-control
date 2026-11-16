import { useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/services/api";
import { queryKeys } from "@/lib/queryKeys";
import { PageHeader } from "@/shared/components/page-header";
import { QueryState } from "@/shared/components/query-state";
import { Card, CardContent } from "@/shared/components/ui/Card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import {
  DateRangeFilter,
  TablePager,
  type DateRange,
} from "@/shared/components/table-controls";
import { Segmented } from "@/shared/components/segmented";
import { AnomalyBadge } from "../components/anomaly-badge";
import { HeatingPeriodSummary } from "../components/heating-period-summary";
import { DailyMetricsCard } from "../components/daily-metrics-card";
import { useHeatingPeriod } from "../hooks/use-heating-period";
import type { HeatingPeriod } from "../lib/heating-period";

const PAGE_SIZE = 25;

/**
 * Tabela događaja grijanja (`36`).
 *
 * Straničenje i filter su na serveru, ne u browseru: događaja ima preko 400 i
 * raste svaki dan, pa bi „učitaj sve pa filtriraj" značilo prenos cijele tabele
 * pri svakom otvaranju. Zato `limit`/`offset`/`from`/`to` idu u upit, a ukupan
 * broj dolazi iz zaglavlja `X-Total-Count`.
 */
export const HeatingPage = (): JSX.Element => {
  const { t } = useTranslation();
  const summaryPeriod = useHeatingPeriod("week");
  /*
   * C1 — kartica mjernih kolona. Prozor prati birač perioda: isti raspon za
   * sve brojeve na stranici, inače "12 ciklusa" i "3 dana mjerenja" gledaju
   * različite periode i poređenje ne znači ništa.
   */
  const { data: homeProfile } = useQuery({
    queryKey: queryKeys.homeProfile,
    queryFn: () => apiClient.getHomeProfile(),
    staleTime: 1000 * 60 * 5,
  });
  const [range, setRange] = useState<DateRange>({ from: "", to: "" });
  const [offset, setOffset] = useState(0);

  const eventsQuery = useQuery({
    queryKey: queryKeys.heatingEventsPage(
      range.from,
      range.to,
      offset,
      PAGE_SIZE,
    ),
    queryFn: () =>
      apiClient.getHeatingEvents({
        limit: PAGE_SIZE,
        offset,
        from: range.from || undefined,
        to: range.to || undefined,
      }),
  });

  const events = eventsQuery.data?.rows ?? [];
  const total = eventsQuery.data?.total ?? 0;
  const status = eventsQuery.isLoading
    ? "loading"
    : eventsQuery.isError
      ? "error"
      : events.length === 0
        ? "empty"
        : "success";

  /*
   * Novi filter vraća na prvu stranu. Bez toga bi „od 2026-01-01" sa strane 7
   * prikazao praznu tabelu i korisnik bi pomislio da filter ne radi.
   */
  const applyRange = (next: DateRange): void => {
    setRange(next);
    setOffset(0);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("heating.title")}
        description={t("heating.subtitle")}
      />

      {/*
       * D1 — birač perioda i poređenje sa prethodnim. Do 16.11. je web imao
       * samo fiksni raspon za događaje, dok je mobilni imao dan/sedmica/
       * mjesec/godina + prethodni period. Isti podatak, dva odgovora.
       */}
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-text-primary">
              {t("heating.periodSummaryTitle")}
            </h2>
            <Segmented<HeatingPeriod>
              idPrefix="heating-period"
              label={t("heating.periodSelector")}
              value={summaryPeriod.period}
              onChange={summaryPeriod.setPeriod}
              disabled={summaryPeriod.isFetching}
              options={[
                { value: "day", label: t("heating.periods.day") },
                { value: "week", label: t("heating.periods.week") },
                { value: "month", label: t("heating.periods.month") },
                { value: "year", label: t("heating.periods.year") },
              ]}
            />
          </div>
          <QueryState
            status={
              summaryPeriod.isLoading
                ? "loading"
                : summaryPeriod.isError
                  ? "error"
                  : !summaryPeriod.current
                    ? "empty"
                    : "success"
            }
            onRetry={summaryPeriod.refetch}
            emptyMessage={t("heating.periodNotMeasured")}
            minHeightClassName="min-h-32"
          >
            <HeatingPeriodSummary
              current={summaryPeriod.current}
              previous={summaryPeriod.previousMetrics}
              previousLabel={t("heating.periodPrevious")}
            />
          </QueryState>
        </CardContent>
      </Card>

      <DailyMetricsCard
        homeProfileId={homeProfile?.id}
        from={summaryPeriod.range.from}
        to={summaryPeriod.range.to}
      />

      <DateRangeFilter
        idPrefix="heating-range"
        value={range}
        onChange={applyRange}
        disabled={eventsQuery.isFetching}
      />
      <QueryState
        status={status}
        onRetry={() => {
          void eventsQuery.refetch();
        }}
        emptyMessage={t("heating.empty")}
      >
        <Card>
          <CardContent className="p-0 pt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("heating.colStart")}</TableHead>
                  <TableHead>{t("heating.colEnd")}</TableHead>
                  <TableHead>{t("heating.colRoom")}</TableHead>
                  <TableHead>{t("heating.colTarget")}</TableHead>
                  <TableHead>{t("heating.colAction")}</TableHead>
                  <TableHead>{t("heating.colSource")}</TableHead>
                  <TableHead>{t("heating.colAnomaly")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      {new Date(record.timestampStart).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {record.timestampEnd
                        ? new Date(record.timestampEnd).toLocaleString()
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {record.roomCurrentTemp != null
                        ? `${record.roomCurrentTemp.toFixed(1)}°C`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {record.roomTargetTemp != null
                        ? `${record.roomTargetTemp.toFixed(1)}°C`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <span className="rounded bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                        {record.hvacAction
                          ? t(`heating.actions.${record.hvacAction}`, {
                              defaultValue: record.hvacAction,
                            })
                          : "—"}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {record.source}
                    </TableCell>
                    <TableCell>
                      <AnomalyBadge isAnomaly={record.isAnomaly ?? false} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TablePager
              total={total}
              offset={offset}
              limit={PAGE_SIZE}
              onChange={setOffset}
              isFetching={eventsQuery.isFetching}
            />
          </CardContent>
        </Card>
      </QueryState>
    </div>
  );
};

HeatingPage.displayName = "HeatingPage";

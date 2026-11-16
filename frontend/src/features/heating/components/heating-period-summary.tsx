import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { percentChange } from "../lib/heating-period";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";

/**
 * D1 — tabela „Vrijednost / Prethodno" za grijanje.
 *
 * Prenesena sa mobilnog (`periodRows`), ali sa **jednim pravilom koje mobilni
 * ne poštuje dosljedno**: nedostajuće mjerenje je „—", nikad `0`.
 *
 * `avgIndoorTemp` može biti `null` i to je **odgovor** (B1: događaji postoje,
 * ali nijedna temperatura nije upotrebljiva). `0` tu ne smije nikad pisati —
 * to bi bila izmišljena temperatura, ista greška kao D2 na gasu.
 */

export interface HeatingPeriodMetrics {
  totalCycles: number;
  totalDurationMin: number;
  avgDurationMin: number;
  avgIndoorTemp: number | null;
  /** B1 — koliko je temperatura izostavljeno jer su bila 0 °C. */
  excludedZeroTemp?: number;
  /** B2 — koliko ciklusa nema kraj (podcjenjuju trajanje). */
  openCycles?: number;
}

const isNum = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

/** `null`/`undefined` → „—"; stvarna nula ostaje 0. */
function show(value: unknown, digits: number): string {
  return isNum(value) ? value.toFixed(digits) : "—";
}

export function HeatingPeriodSummary({
  current,
  previous,
  previousLabel,
}: {
  current: HeatingPeriodMetrics | null;
  previous: HeatingPeriodMetrics | null;
  previousLabel: string;
}): JSX.Element {
  const { t } = useTranslation();

  const rows: Array<{
    key: string;
    label: string;
    current: string;
    previous: string;
    change: number | null;
  }> = [
    {
      key: "cycles",
      label: t("heating.periodCycles"),
      current: show(current?.totalCycles, 0),
      previous: show(previous?.totalCycles, 0),
      change: percentChange(current?.totalCycles, previous?.totalCycles),
    },
    {
      key: "duration",
      label: t("heating.periodDuration"),
      current: show(current?.totalDurationMin, 0),
      previous: show(previous?.totalDurationMin, 0),
      change: percentChange(
        current?.totalDurationMin,
        previous?.totalDurationMin,
      ),
    },
    {
      key: "avgDuration",
      label: t("heating.periodAvgDuration"),
      current: show(current?.avgDurationMin, 1),
      previous: show(previous?.avgDurationMin, 1),
      change: percentChange(current?.avgDurationMin, previous?.avgDurationMin),
    },
    {
      key: "indoor",
      label: t("heating.periodAvgIndoor"),
      current: show(current?.avgIndoorTemp, 2),
      previous: show(previous?.avgIndoorTemp, 2),
      /*
       * Za temperaturu se procenat **ne računa**: 20 °C → 21 °C nije „+5 %"
       * nego +1 K, a procenti na Celzijusu zavise od nule skale i zato lažu.
       */
      change: null,
    },
  ];

  return (
    <div className="space-y-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("heating.periodMetric")}</TableHead>
            <TableHead>{t("heating.periodValue")}</TableHead>
            <TableHead>{previousLabel}</TableHead>
            <TableHead>{t("heating.periodChange")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.key}>
              <TableCell>{row.label}</TableCell>
              <TableCell className="tabular-nums">{row.current}</TableCell>
              <TableCell className="tabular-nums text-muted-foreground">
                {row.previous}
              </TableCell>
              <TableCell className="tabular-nums">
                {row.change === null
                  ? "—"
                  : `${row.change > 0 ? "+" : ""}${row.change.toFixed(1)} %`}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/*
       * Oba ograničenja se prikazuju uz tabelu, ne u tooltipu: bez njih broj
       * trajanja izgleda tačniji nego što jeste.
       */}
      {(current?.openCycles ?? 0) > 0 ? (
        <p className="text-xs text-text-secondary">
          {t("heating.periodOpenCycles", { count: current?.openCycles })}
        </p>
      ) : null}
      {(current?.excludedZeroTemp ?? 0) > 0 ? (
        <p className="text-xs text-text-secondary">
          {t("heating.periodExcludedZero", {
            count: current?.excludedZeroTemp,
          })}
        </p>
      ) : null}
    </div>
  );
}

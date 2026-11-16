import type {
  DailyMetricField,
  DailyMetricRow,
} from "@/features/reports/types";

/**
 * C1 — kapija za prikaz mjernih kolona.
 *
 * **Zašto kapija postoji.** Mjerenje (M3, run `43857447424`) kaže **5/86** dana
 * ima metrike — 5,8 %. Ekran koji na 94 % dana pokaže prazninu ne izgleda kao
 * „nema podatka", izgleda kao **pokvaren ekran**. Plan zato izričito traži:
 * kartica se prikazuje **tek** kad pokrivenost pređe 25 %.
 *
 * Kapija je ovdje, a ne u komponenti, iz tri razloga:
 *   - testira se bez rendera (a granica je ono što se stvarno može pogriješiti);
 *   - oba klijenta (web i mobilni) moraju dati **isti** odgovor na isto pitanje;
 *   - „sakrij ekran" i „sakrij zbog čega" su dvije odluke — druga mora reći
 *     koliko još fali, inače izgleda kao da je funkcija zaboravljena.
 */

/** Prag iz plana. Ne spuštati da bi ekran bio „puniji" — to je ista greška kao B1. */
export const METRICS_COVERAGE_THRESHOLD_PERCENT = 25;

export type MetricsGate =
  | { visible: false; reason: "no-data" | "low-coverage"; percent: number }
  | { visible: true; percent: number };

export interface MetricsCoverageLike {
  days: number;
  byField: Record<string, number>;
  bestFieldShare: number;
}

/**
 * Odluka: prikazati kartice ili ne.
 *
 * `bestFieldShare` dolazi sa servera, ali se **ne vjeruje na riječ**: ako je
 * polje odsutno ili besmisleno (starija verzija servera, djelimičan odgovor),
 * procenat se izvodi iz `byField` i `days`. Nula dana je `no-data`, a ne 0 % —
 * razlika je „nemamo podatak" prema „imamo, i premalo je".
 */
export function evaluateMetricsGate(
  coverage: MetricsCoverageLike | null | undefined,
): MetricsGate {
  const days = Number(coverage?.days ?? 0);

  if (!Number.isFinite(days) || days <= 0) {
    return { visible: false, reason: "no-data", percent: 0 };
  }

  const percent = resolveBestShare(coverage!, days);

  return percent >= METRICS_COVERAGE_THRESHOLD_PERCENT
    ? { visible: true, percent }
    : { visible: false, reason: "low-coverage", percent };
}

function resolveBestShare(coverage: MetricsCoverageLike, days: number): number {
  const reported = Number(coverage.bestFieldShare);
  if (Number.isFinite(reported) && reported >= 0) return reported;

  const counts = Object.values(coverage.byField ?? {});
  const best = counts.length
    ? Math.max(...counts.map((c) => Number(c) || 0))
    : 0;
  return days > 0 ? Number(((best / days) * 100).toFixed(1)) : 0;
}

/**
 * Kolone koje stvarno imaju podatak, sortirane po pokrivenosti (najbolja prva).
 *
 * Prikazuje se **samo ono što ima mjerenja**: kolona sa 0 dana u tabeli je
 * prazna kolona, a prazna kolona tvrdi da je mjerenje postojalo i da je bilo
 * prazno.
 */
export function fieldsWithData(
  coverage: MetricsCoverageLike | null | undefined,
): Array<{ field: string; days: number; share: number }> {
  const days = Number(coverage?.days ?? 0);
  if (!Number.isFinite(days) || days <= 0) return [];

  return Object.entries(coverage!.byField ?? {})
    .map(([field, count]) => ({
      field,
      days: Number(count) || 0,
      share: Number(((Number(count) || 0) / days) * 100),
    }))
    .filter((entry) => entry.days > 0)
    .sort((a, b) => b.days - a.days || a.field.localeCompare(b.field));
}

/**
 * Prosjek preko dana koji **imaju** mjerenje.
 *
 * Vraća `null` kad nijedan dan nema mjerenje — nikad `0`. Prosjek preko nule
 * tačaka nije nula, nego nema odgovora.
 */
export function averageOfMeasured(
  rows: DailyMetricRow[],
  field: DailyMetricField,
): { value: number; days: number } | null {
  const values: number[] = [];
  for (const row of rows) {
    const value = row[field];
    if (typeof value === "number" && Number.isFinite(value)) values.push(value);
  }
  if (values.length === 0) return null;
  const sum = values.reduce((acc, v) => acc + v, 0);
  return { value: sum / values.length, days: values.length };
}

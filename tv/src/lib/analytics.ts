/**
 * Šta TV prikazuje — i šta odbija prikazati.
 *
 * **Zašto ovo nije kopija mobilnog ekrana.** Telefon se gleda iz ruke, na 30 cm;
 * TV se gleda sa 3 m. Na TV-u **nema** mjesta za 10 kartica i nema mišа za
 * skrolanje kroz tabelu. Zato TV prikazuje **najviše ono što stane na jedan
 * ekran**, a ostatak je odluka, ne propust — v. `MAX_TV_METRICS`.
 *
 * **Pravilo koje se ne smije izgubiti:** nedostajuće mjerenje je `null`, ne `0`.
 * Isto kao B1 na backendu i D2 na webu. TV koji bi `null` prikazao kao `0 m³`
 * izgledao bi najtačnije od svih klijenata — i bio bi najgori.
 */

/** Koliko se vrijednosti stvarno vidi sa 3 m na 1080p ekranu. */
export const MAX_TV_METRICS = 6;

export interface TvMetric {
  key: string;
  label: string;
  /** Formatirana vrijednost, ili `null` kad mjerenja nema. */
  value: string | null;
  unit: string;
}

const isNum = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v);

/** `null` → `null` (nije mjereno); `0` ostaje `0` (mjereno i nula). */
export function formatMetric(
  value: unknown,
  digits = 1,
): string | null {
  return isNum(value) ? value.toFixed(digits) : null;
}

/**
 * Iznos potrošnje plina za TV.
 *
 * **`consumptionFromReferenceM3: 0` je mjerenje i mora pobijediti `totalGas`.**
 * Isti kvar kao D2 na webu: `??` bi `0` proglasio „nema vrijednosti" i tiho
 * prikazao drugi broj.
 */
export function resolveGasConsumption(analysis: Record<string, unknown>): number | null {
  if (isNum(analysis.consumptionFromReferenceM3)) {
    return analysis.consumptionFromReferenceM3;
  }
  if (isNum(analysis.totalGas)) return analysis.totalGas;
  return null;
}

export interface GasAnalyticsLike {
  consumptionFromReferenceM3?: unknown;
  totalGas?: unknown;
  totalHeatingHours?: unknown;
  avgFlowTemp?: unknown;
  costExVat?: unknown;
  costIncVat?: unknown;
  efficiency?: { m3PerHour?: unknown };
}

/**
 * Metrike za TV iz odgovora `GET /api/gas/analysis`.
 *
 * Redoslijed je namjeran: prvo **potrošnja** (jedini broj koji korisnik traži
 * na TV-u), pa novac, pa tehnika. Metrike bez mjerenja **izostaju** — prazna
 * kartica na TV-u nema legende koja bi objasnila zašto je prazna.
 */
export function buildTvMetrics(analysis: GasAnalyticsLike | null | undefined): TvMetric[] {
  if (!analysis) return [];

  const metrics: TvMetric[] = [];

  const consumption = resolveGasConsumption(analysis as Record<string, unknown>);
  if (consumption !== null) {
    metrics.push({
      key: 'consumption',
      label: 'gas.metricTotalConsumption',
      value: consumption.toFixed(2),
      unit: 'm³',
    });
  }

  if (isNum(analysis.costIncVat)) {
    metrics.push({
      key: 'cost',
      label: 'gas.metricCostIncVat',
      value: analysis.costIncVat.toFixed(2),
      unit: 'KM',
    });
  }

  if (isNum(analysis.totalHeatingHours)) {
    metrics.push({
      key: 'hours',
      label: 'gas.metricHeatingHours',
      value: analysis.totalHeatingHours.toFixed(1),
      unit: 'h',
    });
  }

  if (isNum(analysis.avgFlowTemp)) {
    metrics.push({
      key: 'flow',
      label: 'gas.metricAvgFlowTemp',
      value: analysis.avgFlowTemp.toFixed(1),
      unit: '°C',
    });
  }

  const perHour = analysis.efficiency?.m3PerHour;
  if (isNum(perHour)) {
    metrics.push({
      key: 'perHour',
      label: 'gas.metricUsagePerHour',
      value: perHour.toFixed(3),
      unit: 'm³/h',
    });
  }

  return metrics;
}

/**
 * Skrati listu na ono što stane na ekran.
 *
 * Namjerno **ne** „prikaži prvih N i sakrij ostalo bez traga": vraća i broj
 * skrivenih, da ekran može reći „+2" umjesto da izgleda kao da metrika nema.
 */
export function limitForTv(metrics: TvMetric[]): {
  shown: TvMetric[];
  hiddenCount: number;
} {
  return {
    shown: metrics.slice(0, MAX_TV_METRICS),
    hiddenCount: Math.max(0, metrics.length - MAX_TV_METRICS),
  };
}

/**
 * Koliko je podataka „staro" — TV prikazuje vrijeme zadnjeg osvježavanja.
 *
 * Bez ovoga TV koji je izgubio mrežu prikazuje iste brojeve kao TV koji radi —
 * a korisnik gleda ekran i vjeruje mu.
 */
export function describeFreshness(
  updatedAt: number | null,
  now = Date.now(),
): 'fresh' | 'stale' | 'unknown' {
  if (updatedAt === null) return 'unknown';
  const ageMs = now - updatedAt;
  // 10 minuta: aplikacija osvježava na 5, pa je duplo vrijeme znak da nešto ne radi.
  return ageMs > 10 * 60 * 1000 ? 'stale' : 'fresh';
}

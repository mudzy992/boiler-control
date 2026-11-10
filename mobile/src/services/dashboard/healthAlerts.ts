import type { HealthWarning, HealthWarningLevel, HealthWarningType } from '../../types/Dashboard';

/**
 * MO2-12: backend `GET /api/dashboard/health` is the single source of truth.
 * The mobile client only maps the returned warnings to a view model; it does
 * not recompute thresholds or messages.
 *
 * `F13` (treći krug): `message` iz backend-a je **bosanski** i web ga prikazuje
 * tako. Mobilna Početna ga je ispisivala kako jeste, pa je uz naslov
 * „Dugi ciklusi grijanja" stajalo „Detektovano 2 dugih ciklusa grijanja (> 90
 * min)" — i na engleskom. Zato view model nosi **ključ i brojeve**, a rečenicu
 * sastavlja ekran, na jeziku koji je uključen.
 *
 * Kad strukturisanih polja nema (stariji backend), `message` ostaje rezerva —
 * bolje prikazati bosanski tekst nego ništa.
 */
export type HealthAlertSeverity = 'critical' | 'warning' | 'info';

export interface HealthAlertViewModel {
  id: string;
  severity: HealthAlertSeverity;
  titleKey: string;
  /**
   * Gotova rečenica iz backend-a; prazno kad je imamo prevedenu iz dijelova.
   * Nikad se ne prikazuje zajedno sa `detailKey`.
   */
  message: string;
  /** Ključ prevedene rečenice (`healthWarningDetail.<type>`), ako je dostupna. */
  detailKey: string | null;
  /** Parametri za `detailKey` — samo brojevi, nikad tekst. */
  detailParams: Record<string, number>;
  icon: string;
}

const LEVEL_TO_SEVERITY: Record<HealthWarningLevel, HealthAlertSeverity> = {
  error: 'critical',
  warning: 'warning',
  info: 'info',
};

const WARNING_ICONS: Record<HealthWarningType, string> = {
  shortCycles: 'timer-alert-outline',
  longCycles: 'timer-sand',
  targetShortfall: 'thermometer-chevron-down',
  targetOvershoot: 'thermometer-chevron-up',
  anomalies: 'alert-circle-outline',
};

/**
 * Koji tipovi imaju prevedenu rečenicu i šta ona traži.
 *
 * Namjerno deklarisano po tipu, a ne „ako ima `count`": svaki tip nosi drugu
 * vrstu broja (ciklusi + prag, samo broj, stepeni), pa bi jedan zajednički
 * uslov tiho prikazao `{{threshold}} min` za anomalije.
 */
const DETAIL_SPEC: Partial<
  Record<HealthWarningType, { key: string; params: (warning: HealthWarning) => Record<string, number> | null }>
> = {
  shortCycles: {
    key: 'healthWarningDetail.shortCycles',
    params: (w) =>
      typeof w.count === 'number' && typeof w.threshold === 'number'
        ? { count: w.count, threshold: w.threshold }
        : null,
  },
  longCycles: {
    key: 'healthWarningDetail.longCycles',
    params: (w) =>
      typeof w.count === 'number' && typeof w.threshold === 'number'
        ? { count: w.count, threshold: w.threshold }
        : null,
  },
  anomalies: {
    key: 'healthWarningDetail.anomalies',
    params: (w) => (typeof w.count === 'number' ? { count: w.count } : null),
  },
  targetShortfall: {
    key: 'healthWarningDetail.targetShortfall',
    params: (w) => (typeof w.valueC === 'number' ? { value: w.valueC } : null),
  },
  targetOvershoot: {
    key: 'healthWarningDetail.targetOvershoot',
    params: (w) => (typeof w.valueC === 'number' ? { value: w.valueC } : null),
  },
};

export function mapHealthWarningsToAlerts(
  warnings: readonly HealthWarning[] = []
): HealthAlertViewModel[] {
  return warnings.map((warning, index) => {
    const spec = DETAIL_SPEC[warning.type];
    const params = spec ? spec.params(warning) : null;

    return {
      id: `${warning.type}-${index}`,
      severity: LEVEL_TO_SEVERITY[warning.level] ?? 'info',
      titleKey: `healthWarnings.${warning.type}`,
      // Prevedena rečenica ima prednost; sirov `message` ostaje samo kad
      // strukturisanih brojeva nema.
      message: params ? '' : warning.message,
      detailKey: params ? (spec?.key ?? null) : null,
      detailParams: params ?? {},
      icon: WARNING_ICONS[warning.type] ?? 'alert-circle-outline',
    };
  });
}

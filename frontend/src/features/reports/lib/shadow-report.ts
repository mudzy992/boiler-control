import type { ShadowReportResponse, ShadowVerdict } from '../types';

/**
 * Čitanje shadow izvještaja u UI-u (`24` §6.5, `26`).
 *
 * Izvještaj odgovara na tri pitanja, i sva tri moraju biti vidljiva **zajedno**:
 * koliko se odluka razlikuje od formule, u kojem smjeru, i je li svaka razlika
 * objašnjiva. Broj razlika bez trećeg izgleda kao napredak, a nije: razlika bez
 * razloga je greška, ne ušteda.
 *
 * Zato ove funkcije ne vraćaju „da/ne" nego rečenicu sa posljedicom — isti
 * pristup kao kod presude na backendu, da klijent ne izmišlja svoj zaključak iz
 * brojeva koje ne razumije.
 */

/** Redoslijed ozbiljnosti: najvažnije stanje prvo, da se ne izgubi u tabeli. */
const VERDICT_ORDER: ShadowVerdict[] = [
  'UNEXPLAINED_DIFFERENCES',
  'READY',
  'NO_DIFFERENCES',
  'NOT_ENOUGH_DAYS',
  'NO_DATA',
];

export function verdictTone(
  verdict: ShadowVerdict,
): 'error' | 'success' | 'warning' | 'neutral' {
  switch (verdict) {
    case 'UNEXPLAINED_DIFFERENCES':
      return 'error';
    case 'READY':
      return 'success';
    case 'NO_DIFFERENCES':
      return 'warning';
    default:
      return 'neutral';
  }
}

/**
 * Da li je izvještaj uopšte uporediv.
 *
 * `evaluated === 0` znači da shadow nije izračunat ni za jedan dan — tada
 * „0 razlika" nije nalaz nego prazan spisak, i tako se mora prikazati.
 */
export function isReportEmpty(report: ShadowReportResponse | null | undefined): boolean {
  return !report || report.days === 0 || report.evaluated === 0;
}

/**
 * Jedna rečenica koja se prikazuje iznad tabele.
 *
 * Uzima se `verdictNote` sa backenda (on nosi brojeve i prag), a klijent dodaje
 * samo upozorenje kad je izvještaj prazan — nikad svoj zaključak.
 */
export function reportHeadline(
  report: ShadowReportResponse | null | undefined,
): string {
  if (!report) return 'Nema izvještaja za odabrani period.';
  if (report.days === 0) {
    return 'Za odabrani period nema zapisa — nema se šta porediti.';
  }
  if (report.evaluated === 0) {
    return 'Shadow odluka još nije izračunata ni za jedan dan u periodu.';
  }
  return report.verdictNote;
}

/** Najvažnija presuda u periodu (jedina koja postoji u odgovoru). */
export function verdictRank(verdict: ShadowVerdict): number {
  const index = VERDICT_ORDER.indexOf(verdict);
  return index === -1 ? VERDICT_ORDER.length : index;
}

/**
 * Razlozi sortirani po broju dana, sa udjelom u danima sa razlikom.
 *
 * Udio se računa preko `differences`, a ne preko svih dana: razlog postoji samo
 * na danima gdje se odluka razlikuje. Dijeljenje sa `evaluated` dalo bi manji
 * broj koji izgleda kao „rijetko se dešava", a to nije ono što pitanje traži.
 */
export function reasonBreakdown(report: ShadowReportResponse): Array<{
  reason: string;
  days: number;
  sharePct: number;
}> {
  if (report.differences === 0) return [];
  return [...report.byReason]
    .sort((a, b) => b.days - a.days || a.reason.localeCompare(b.reason))
    .map((entry) => ({
      reason: entry.reason,
      days: entry.days,
      sharePct: Math.round((entry.days / report.differences) * 100),
    }));
}

/**
 * D1 — izbor perioda za grijanje na webu.
 *
 * **Nalaz (audit analitike §2).** Web je imao **fiksne** periode: shadow 30
 * dana, historija od 2026-01-01, a `heating-summary` **samo za jedan dan**.
 * Mobilni je od prije imao dan/sedmica/mjesec/godina + poređenje sa prethodnim
 * periodom. Isti podatak, dva različita odgovora na pitanje „kako se kotao
 * ponašao ove sedmice" — ovo prenosi mobilni izbor na web.
 *
 * **Namjerno NE kopira mobilni `getPreviousDateRange` 1:1.** Mobilni pomjera
 * `end = new Date()` i računa u milisekundama, pa mu „prethodni mjesec" traje
 * tačno onoliko koliko i tekući (31 dan u januaru → 31 dan u decembru), a sedmica
 * klizi po dobu dana. Web računa **po lokalnom danu**, pa je „prethodna sedmica"
 * zaista 01.–07.11. → 25.–31.10., a granica je ponoć, ne trenutak otvaranja
 * stranice.
 */

export type HeatingPeriod = "day" | "week" | "month" | "year";

export interface HeatingRange {
  /** Uključivo, `YYYY-MM-DD`, lokalni dan. */
  from: string;
  /** Uključivo, `YYYY-MM-DD`, lokalni dan. */
  to: string;
  bucket: "hour" | "day";
}

const pad = (n: number): string => String(n).padStart(2, "0");

/** `YYYY-MM-DD` iz lokalnih komponenti — NE `toISOString()`. */
export function toLocalDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Raspon za period, završava se sa `today` (uključivo).
 *
 * `bucket` prati mobilni: jedan dan ide po satu (inače bi „danas" imao jedan
 * stupac i ništa se ne bi vidjelo), sve ostalo po danu.
 */
export function rangeForPeriod(
  period: HeatingPeriod,
  today = new Date(),
): HeatingRange {
  const to = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const from = new Date(to);

  switch (period) {
    case "day":
      // Sam dan: `from` = `to`, bucket po satu.
      break;
    case "week":
      from.setDate(from.getDate() - 6);
      break;
    case "month":
      from.setDate(from.getDate() - 29);
      break;
    case "year":
      /*
       * Godina je 365 dana unazad, ne `setFullYear(-1)`: 29.02. bi sa
       * `setFullYear` dao 01.03. i raspon bi bio 366 dana u prestupnoj godini.
       */
      from.setDate(from.getDate() - 364);
      break;
  }

  return {
    from: toLocalDate(from),
    to: toLocalDate(to),
    bucket: period === "day" ? "hour" : "day",
  };
}

/**
 * Prethodni period **iste dužine**, neposredno prije tekućeg.
 *
 * Dužina se mjeri u danima (`to - from`), pa prethodna sedmica ima 7 dana bez
 * obzira na prelaz mjeseca. Bez ovoga „u odnosu na prošlu sedmicu" nema šta da
 * uporedi — a to je jedini način da broj znači nešto.
 */
export function previousRange(range: HeatingRange): HeatingRange {
  const from = new Date(`${range.from}T00:00:00`);
  const to = new Date(`${range.to}T00:00:00`);
  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000);

  const prevTo = new Date(from);
  prevTo.setDate(prevTo.getDate() - 1);
  const prevFrom = new Date(prevTo);
  prevFrom.setDate(prevFrom.getDate() - days);

  return {
    from: toLocalDate(prevFrom),
    to: toLocalDate(prevTo),
    bucket: range.bucket,
  };
}

/**
 * Promjena u procentima, ili `null` kad prethodno nije uporedivo.
 *
 * Živi ovdje, a ne u komponenti, jer `react-refresh` traži da fajl sa
 * komponentom izvozi samo komponente.
 *
 * `previous === 0` → `null`, ne beskonačno: „+∞ %" nije odgovor. Isto važi za
 * `null` (B1: nije mjereno) — nije nula, pa nema ni procenta.
 */
export function percentChange(
  current: unknown,
  previous: unknown,
): number | null {
  const isNum = (v: unknown): v is number =>
    typeof v === "number" && Number.isFinite(v);
  if (!isNum(current) || !isNum(previous)) return null;
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

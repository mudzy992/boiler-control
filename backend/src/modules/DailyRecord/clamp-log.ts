/**
 * F5.5 — svaki klamp se imenuje u logu, sa razlogom.
 *
 * **Problem.** Klamp polazne se do sada vidio samo u `params.clamp` zapisa:
 * `{ applied, rawFinalTemp, minC, maxC }`. To je dovoljno da se broj
 * **rekonstruiše** poslije, ali ne i da se vidi **zašto** je odsječen — a
 * razlika je bitna:
 *
 * - klamp na granicu **sistema** (30/55) znači da motor traži nešto što kotao
 *   fizički ne može; to je nalaz o motoru ili o podacima;
 * - klamp na granicu **doma** (`minHeatingFlowC`/`maxHeatingFlowC`) znači da
 *   korisnik tako želi; to nije greška i ne treba da izgleda kao jedna;
 * - klamp na **dnevnu promjenu** (±2 K) je namjerno usporavanje, ne odsjecanje.
 *
 * Bez imena, sva tri izgledaju isto u logu: „polazna je 55, traženo je 58".
 *
 * **Zašto funkcija, a ne `if` na licu mjesta.** Isti klamp postoji na tri
 * mjesta (motor, kontroler, pisac). Ako svako ima svoj tekst, log postaje
 * neuporediv između njih — a uporedivost je i razlog zašto se log piše.
 */

/** Koja granica je djelovala. Imena idu u log doslovno. */
export type FlowClampBound =
  | 'SYSTEM_MIN'
  | 'SYSTEM_MAX'
  | 'HOME_MIN'
  | 'HOME_MAX'
  | 'DAILY_CHANGE'
  | 'NONE';

export interface FlowClampInput {
  /** Vrijednost prije klemanja. */
  rawC: number;
  /** Vrijednost poslije klemanja. */
  clampedC: number;
  /** Fizička donja granica (30). */
  systemMinC: number;
  /** Fizička gornja granica (55). */
  systemMaxC: number;
  /** Granica doma, ako postoji. */
  homeMinC?: number | null;
  homeMaxC?: number | null;
}

export interface FlowClampReport {
  applied: boolean;
  bound: FlowClampBound;
  /** Koliko je odsječeno, u K; uvijek ≥ 0. */
  cutK: number;
  /** Jedna linija za log — i za čovjeka i za `grep`. */
  message: string;
}

function finite(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Koja je granica bila **odlučujuća**.
 *
 * Provjerava se od najspecifičnije ka najopštijoj: ako je dom postavio
 * granicu i klamp je na njoj, to je granica doma — iako je i ona unutar
 * sistema. Suprotno bi svaki klamp doma prijavio kao sistemski, pa bi se
 * korisničko podešavanje čitalo kao kvar motora.
 */
function decidingBound(
  clampedC: number,
  input: FlowClampInput,
): FlowClampBound {
  const tolerance = 0.001;
  const homeMin = finite(input.homeMinC);
  const homeMax = finite(input.homeMaxC);

  if (
    homeMax != null &&
    Math.abs(clampedC - Math.min(input.systemMaxC, homeMax)) <= tolerance
  ) {
    // Ako je dom tražio više od sistema, odlučila je sistemska granica.
    return homeMax >= input.systemMaxC ? 'SYSTEM_MAX' : 'HOME_MAX';
  }
  if (
    homeMin != null &&
    Math.abs(clampedC - Math.max(input.systemMinC, homeMin)) <= tolerance
  ) {
    return homeMin <= input.systemMinC ? 'SYSTEM_MIN' : 'HOME_MIN';
  }
  if (Math.abs(clampedC - input.systemMaxC) <= tolerance) return 'SYSTEM_MAX';
  if (Math.abs(clampedC - input.systemMinC) <= tolerance) return 'SYSTEM_MIN';
  return 'NONE';
}

/** Objašnjenje po granici — zašto postoji i šta znači kad se pojavi. */
const BOUND_EXPLANATION: Record<FlowClampBound, string> = {
  SYSTEM_MIN: 'fizička donja granica kotla',
  SYSTEM_MAX: 'fizička gornja granica kotla',
  HOME_MIN: 'donja granica koju je postavio dom',
  HOME_MAX: 'gornja granica koju je postavio dom',
  DAILY_CHANGE: 'dnevna promjena (usporavanje, nije odsjecanje)',
  NONE: 'nije odsječeno',
};

/**
 * Izvještaj o klampu. `applied` je `false` i kad je razlika manja od 0,001 K —
 * zaokruživanje nije klamp i ne smije puniti log.
 */
export function describeFlowClamp(input: FlowClampInput): FlowClampReport {
  const cutK = Math.abs(input.rawC - input.clampedC);
  const applied = cutK > 0.001;
  const bound = applied ? decidingBound(input.clampedC, input) : 'NONE';

  const message = applied
    ? `polazna odsječena ${input.rawC.toFixed(2)} → ${input.clampedC.toFixed(2)} °C ` +
      `(${cutK.toFixed(2)} K, granica ${bound}: ${BOUND_EXPLANATION[bound]})`
    : `polazna nije odsječena (${input.rawC.toFixed(2)} °C)`;

  return { applied, bound, cutK: Number(cutK.toFixed(3)), message };
}

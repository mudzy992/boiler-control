/**
 * Istraživanje (`17` §8.5) — jedina promjena polazne koja **nije** posljedica
 * izmjerenog problema, nego nedostatka podatka.
 *
 * Bez varijacije polazne nagib `s` se ne može identificirati: ako se polazna
 * mjesecima ne mijenja, regresija ima jedan `x` i beskonačno rješenja. Ali
 * istraživanje troši komfor, pa se dopušta samo tamo gdje je komfor već
 * dokazano iznad cilja.
 *
 * Pravila iz `17` §8.5, ovdje u kodu:
 *
 * | Pravilo | Zašto |
 * |---|---|
 * | prebačaj > 1 K u **3 od 5** zadnjih dana | rezerva mora biti očigledna, ne jedan topao dan |
 * | amplituda **1 K** | manje se ne vidi u podacima, više je već rizik |
 * | nikad dva dana zaredom u istu stranu | inače je to nova konvergencija, ne varijacija |
 * | nikad noću, nikad kad je `nightMin < 0` | noć je dio dana kad greška nema ko da primijeti |
 * | nikad bez prethodne polazne | nema se oko čega varirati |
 *
 * **Smjer je samo `LOWER`.** Varijacija prema dolje daje isto podataka o nagibu
 * kao i prema gore, ali je naplaćuje iz rezerve koju smo već dokazali. Varijacija
 * prema gore trošila bi komfor da bi kupila isti podatak — pa se ne radi dok ne
 * postoji razlog koji to nadjačava.
 */

/** Koliki prebačaj je rezerva, u K. */
export const EXPLORATION_OVERSHOOT_K = 1;

/** Koliko dana u prozoru mora imati rezervu. */
export const EXPLORATION_REQUIRED_DAYS = 3;

/** Prozor posmatranja, u danima. */
export const EXPLORATION_WINDOW_DAYS = 5;

/** Koliko se polazna pomjera u istraživanju, u K. */
export const EXPLORATION_AMPLITUDE_K = 1;

export type ExplorationDirection = 'LOWER';

export type ExplorationBlock =
  | 'NO_PREVIOUS'
  | 'NO_FORECAST'
  | 'COLD_NIGHT'
  | 'YESTERDAY'
  | 'NO_RESERVE';

export interface ExplorationDecision {
  direction: ExplorationDirection | null;
  /** Zašto nije dozvoljeno; `null` kad jeste. */
  block: ExplorationBlock | null;
}

export interface ExplorationInput {
  /** Prebačaji (K) zadnjih dana, najnoviji zadnji; `null` = nema mjerenja. */
  recentOvershootC: readonly (number | null)[];
  /** Noćni minimum za predstojeću noć; `null` = nema prognoze. */
  nightMinC: number | null;
  /** Jučerašnja odluka je već bila istraživanje. */
  exploredYesterday: boolean;
  /** Postoji li prethodna polazna oko koje se varira. */
  hasPreviousFlow: boolean;
}

/**
 * Red provjera je namjeran: prvo **sigurnost** (noć), pa **svrha** (da ne
 * ponavljamo juče), pa **dokaz** (rezerva). Ako je noć hladna, rezerva na
 * dnevnom prebačaju ne znači ništa.
 */
export function explorationFor(input: ExplorationInput): ExplorationDecision {
  const block = (reason: ExplorationBlock): ExplorationDecision => ({
    direction: null,
    block: reason,
  });

  if (!input.hasPreviousFlow) return block('NO_PREVIOUS');
  if (input.nightMinC == null) return block('NO_FORECAST');
  if (input.nightMinC < 0) return block('COLD_NIGHT');
  if (input.exploredYesterday) return block('YESTERDAY');

  const window = input.recentOvershootC
    .filter((value): value is number => value != null && Number.isFinite(value))
    .slice(-EXPLORATION_WINDOW_DAYS);

  const reserved = window.filter(
    (overshoot) => overshoot > EXPLORATION_OVERSHOOT_K,
  ).length;

  if (reserved < EXPLORATION_REQUIRED_DAYS) return block('NO_RESERVE');

  return { direction: 'LOWER', block: null };
}

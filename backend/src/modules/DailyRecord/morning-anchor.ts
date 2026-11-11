import { UNDERSHOOT_TOLERANCE_K } from './day-outcome';

/**
 * Predlog za dan: **jedna polazna, postavljena ujutro, za cijeli dan** (`F14`).
 *
 * Do sada je predlog postojao kao jutarnji broj, ali je motor polazne nastavljao
 * da računa na svakom pollingu (`BoilerService.calculateFlowTemp`), pa se broj
 * na ekranu mijenjao iz ciklusa u ciklus. Korisnik je tražio suprotno: jednu
 * vrijednost ujutro, i da se ne mijenja tokom dana.
 *
 * Ovo je mjesto gdje se ta odluka donosi — čista funkcija, bez baze i sata.
 *
 * Pravilo ima dva dijela, i drugi je namjerno uzak:
 *
 * 1. **Jutarnja preporuka je glavna.** Za dan koji ima jutarnji predlog, taj
 *    broj je mjerodavan bez obzira što formula sada računa drugačije (prognoza
 *    se popravila, sobna temperatura porasla, interval se promijenio).
 * 2. **Izmjena tokom dana je dozvoljena samo uz mjereni dokaz.** Dokaz je
 *    noćni manjak ili manjak u danu preko tolerancije — tj. izmjereno je da je
 *    kuća bila ispod cilja, a ne da formula misli da bi trebalo više. Kad se to
 *    dogodi, poruka to mora reći; bez toga bi ista promjena izgledala kao
 *    oscilacija.
 */

/** Zašto se broj mijenja usred dana. */
export type DaytimeChangeReason = 'NIGHT_UNDERSHOOT' | 'DAY_UNDERSHOOT';

export interface DaytimeChange {
  flowC: number;
  reason: DaytimeChangeReason;
  /** Izmjereni manjak u kelvinima — ide u tekst poruke. */
  measuredUndershootC: number;
}

export interface MorningAnchorInput {
  /** Jutarnji predlog za dan. `null` = dan nema predlog (preskočen, nema prognoze). */
  morningFlowC: number | null;
  /** Šta formula računa sada. */
  currentFlowC: number | null;
  /** Današnji izmjereni ishod ako već postoji. */
  today: {
    undershootC: number | null;
    nightUndershootC: number | null;
  } | null;
  /** Tvrda granica sistema (`maxHeatingFlowC`, katalog) — nikad se ne prelazi. */
  ceilingC?: number | null;
  /** Apsolutni raspon koji server primjenjuje na unos. */
  minC?: number;
  maxC?: number;
}

export interface MorningAnchorResult {
  /** Broj koji se prikazuje i koji se smije postaviti. */
  flowC: number | null;
  /** `MORNING` = jutarnji predlog; `CHANGED` = izmijenjen uz dokaz. */
  basis: 'MORNING' | 'CHANGED' | 'FORMULA' | 'NONE';
  /** Postoji li izmjena u odnosu na jutro. */
  changed: boolean;
  /** Zašto je izmijenjen — `null` kad nije. */
  change: DaytimeChange | null;
  /** Formula odstupa od jutra, ali nema dokaza → broj ostaje jutarnji. */
  formulaDriftC: number | null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Odabir broja za tekući dan.
 *
 * Prednost reda je dio pravila: dokaz (manjak) je jedini razlog da broj ode
 * **gore**; spuštanje usred dana nije dozvoljeno ni sa dokazom, jer bi to
 * značilo da kuća hladi dok je dan još pred nama — a to je upravo ono što je
 * korisnik prijavio („mijenja se iz ciklusa u ciklus").
 */
export function anchorDailyFlow(
  input: MorningAnchorInput,
): MorningAnchorResult {
  const minC = input.minC ?? 30;
  const maxC = input.maxC ?? 55;
  const ceiling = Math.min(
    maxC,
    input.ceilingC == null ? maxC : Math.max(minC, input.ceilingC),
  );
  const limit = (value: number) => clamp(value, minC, ceiling);

  const morning =
    input.morningFlowC == null || !Number.isFinite(input.morningFlowC)
      ? null
      : limit(input.morningFlowC);
  const formula =
    input.currentFlowC == null || !Number.isFinite(input.currentFlowC)
      ? null
      : limit(input.currentFlowC);

  // Bez jutarnjeg predloga nema se šta čuvati: formula je jedini broj, i to se
  // otvoreno kaže (`FORMULA`), da se ne čita kao „jutro je potvrdilo formulu".
  if (morning == null) {
    return {
      flowC: formula,
      basis: formula == null ? 'NONE' : 'FORMULA',
      changed: false,
      change: null,
      formulaDriftC: null,
    };
  }

  const night = input.today?.nightUndershootC ?? null;
  const day = input.today?.undershootC ?? null;

  const nightEvidence = night != null && night > UNDERSHOOT_TOLERANCE_K;
  const dayEvidence = day != null && day > UNDERSHOOT_TOLERANCE_K;

  // Dokaz mora tražiti VIŠE topline da bi bio razlog za promjenu. Manjak ispod
  // tolerancije je unutar mjerne nesigurnosti i ne mijenja ništa.
  if (nightEvidence || dayEvidence) {
    const reason: DaytimeChangeReason = nightEvidence
      ? 'NIGHT_UNDERSHOOT'
      : 'DAY_UNDERSHOOT';
    const measured = nightEvidence ? night : (day as number);
    // Cilj izmjene: formula, jer ona nosi izmjereni manjak; jutro je bilo
    // prenisko. Nikad ispod jutra — izmjena zbog manjka ide samo gore.
    const target = formula == null ? morning : Math.max(morning, formula);
    const next = limit(target);

    if (next > morning) {
      return {
        flowC: next,
        basis: 'CHANGED',
        changed: true,
        change: { flowC: next, reason, measuredUndershootC: measured },
        formulaDriftC: formula == null ? null : formula - morning,
      };
    }
  }

  return {
    flowC: morning,
    basis: 'MORNING',
    changed: false,
    change: null,
    formulaDriftC: formula == null ? null : formula - morning,
  };
}

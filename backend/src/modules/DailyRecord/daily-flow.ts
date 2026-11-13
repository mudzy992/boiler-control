import { anchorDailyFlow, type DaytimeChange } from './morning-anchor';

/**
 * F4.5 — **koji broj danas važi**, na jednom mjestu.
 *
 * Mjerenje (run `43246164833`) je pokazalo da se polazna mijenja kroz dan:
 * **10 od 27 kuća-dana** ima raspon veći od 0,5 K, najveći **2,76 K**. Uzrok
 * nije `anchorDailyFlow` — on već čuva jutarnji broj — nego to što
 * `BoilerService.calculateFlowTemp` **računa iznova** i njegov broj ide na
 * kotao (`/boiler/sync`) i u `BoilerHistory` (polling).
 *
 * Ova funkcija je odgovor: isti ulaz ⇒ isti broj za isti dan, jer se jutarnji
 * predlog **ne dira** dok nema izmjerenog dokaza.
 *
 * **Zašto čista funkcija, a ne metoda servisa.** Pravilo „jedan broj za dan"
 * mora važiti na svakom mjestu koje broj predlaže — `/boiler/sync`, polling,
 * dashboard. Da je metoda na jednom servisu, drugo mjesto bi imalo svoju
 * kopiju, a dvije kopije istog pravila se raziđu prvom izmjenom. Bez baze i
 * bez sata: ulaz je zapis, izlaz je broj, pa se testira bez mockova.
 */

/** Ono što ovaj izbor treba iz `DailyRecord`-a — ništa više. */
export interface DailyFlowRecord {
  proposedFlowTemp: number | null;
  /** `null` = ishod još nije obračunat, pa nema dokaza za izmjenu. */
  outcomeAt: Date | null;
  undershootC: number | null;
  nightUndershootC: number | null;
}

export interface ResolvedDailyFlow {
  /**
   * Broj koji danas važi. `null` kad dana nema zapisa **i** formula ne daje
   * broj — tada se ne izmišlja ništa.
   */
  flowC: number | null;
  /**
   * `DAILY_RECORD` — broj je iz zapisa (jutarnji predlog ili izmjena uz dokaz);
   * `CURVE` — zapisa nema, pa se koristi ono što formula daje sada;
   * `NONE` — nema ni zapisa ni broja.
   */
  source: 'DAILY_RECORD' | 'CURVE' | 'NONE';
  /** Zašto se broj mijenjao usred dana; `null` kad se nije. */
  change: DaytimeChange | null;
  /** Formula odstupa od jutra, ali bez dokaza — broj ostaje jutarnji. */
  formulaDriftC: number | null;
}

export interface ResolveDailyFlowInput {
  /** Današnji `DailyRecord`, ili `null` kad red ne postoji. */
  record: DailyFlowRecord | null;
  /** Šta formula računa sada (može biti `null` ako nema vremena/prognoze). */
  curveFlowC: number | null;
  /** Tvrda granica sistema (`maxHeatingFlowC`) — nikad se ne prelazi. */
  ceilingC?: number | null;
}

/**
 * Presuda.
 *
 * Redoslijed je dio pravila i namjerno je ovakav:
 *
 * 1. **Zapis ima predlog** ⇒ on je mjerodavan. Formula se koristi samo da bi se
 *    izmjerio drift, i da bi **dokaz** (manjak) mogao podići broj. Bez dokaza
 *    formula ne mijenja ništa, ma koliko odstupala.
 * 2. **Zapisa nema** (ili predlog je `null`) ⇒ formula je jedini broj, i to se
 *    otvoreno kaže (`CURVE`), da se ne čita kao „jutro je potvrdilo formulu".
 * 3. **Nema ni jednog** ⇒ `null`. Nikad se ne izmišlja broj.
 *
 * `source` je `DAILY_RECORD` i kad je broj izmijenjen dokazom: izmjena je
 * zapisana u isti red, pa je i dalje zapis taj koji važi.
 */
export function resolveDailyFlow(
  input: ResolveDailyFlowInput,
): ResolvedDailyFlow {
  const { record, curveFlowC } = input;

  const morning = record?.proposedFlowTemp ?? null;
  const hasRecordFlow =
    morning != null && Number.isFinite(morning) && morning > 0;

  if (!hasRecordFlow) {
    return {
      flowC: curveFlowC,
      source: curveFlowC == null ? 'NONE' : 'CURVE',
      change: null,
      // Nema jutra, pa nema od čega mjeriti odstupanje.
      formulaDriftC: null,
    };
  }

  const anchor = anchorDailyFlow({
    morningFlowC: morning,
    currentFlowC: curveFlowC,
    // Dokaz postoji **samo** kad je ishod obračunat. `outcomeAt == null` znači
    // „nije se još mjerilo", i to nije isto kao „izmjereno je nula" — zato se
    // tada ne predaje ništa, umjesto nula.
    today:
      record?.outcomeAt == null
        ? null
        : {
            undershootC: record.undershootC,
            nightUndershootC: record.nightUndershootC,
          },
    ceilingC: input.ceilingC ?? null,
  });

  return {
    flowC: anchor.flowC,
    source: 'DAILY_RECORD',
    change: anchor.change,
    formulaDriftC: anchor.formulaDriftC,
  };
}

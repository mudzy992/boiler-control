/**
 * Instrumentacija shadow perioda (`24` §6.5, `17` §13 korak 6).
 *
 * Shadow period postoji da odgovori na **tri** pitanja prije nego odluka
 * kontrolera postane predlog koji korisnik vidi:
 *
 * 1. koliko se često odluka razlikuje od formule,
 * 2. u kojem smjeru (spušta ili podiže),
 * 3. da li je **svaka** razlika objašnjiva razlogom iz `shadowReasons`.
 *
 * Treće je jedino koje može biti greška. Prva dva su nalaz. Zato ovaj modul
 * razdvaja „razlika" od „neobjašnjena razlika" i **ne dozvoljava** da se prag
 * pređe sa neobjašnjenom razlikom — čak i ako je dana dovoljno.
 *
 * Funkcije su čiste (ulaz: redovi iz baze, izlaz: izvještaj) jer se jedino tako
 * pravilo može testirati bez baze i bez čekanja 21 dan.
 */

/** Red iz `DailyRecord`, samo kolone koje izvještaj čita. */
export interface ShadowRow {
  localDate: string;
  proposedFlowTemp: number | null;
  shadowFlowC: number | null;
  shadowAction: string | null;
  /** Razlozi spojeni sa `+` (tako ih piše shadow servis). */
  shadowReasons: string | null;
  shadowVersion: string | null;
  /** Da li je odluka tog dana bila istraživanje (`17` §8.5). */
  shadowExploration?: boolean | null;
  /** `null` znači da shadow za taj dan nije izračunat. */
  shadowAt?: Date | string | null;
}

export type ShadowDirection = 'LOWER' | 'HIGHER' | 'SAME';

export interface ShadowComparison {
  localDate: string;
  formulaC: number;
  decisionC: number;
  /** `decisionC - formulaC`; negativno znači da kontroler spušta. */
  deltaC: number;
  direction: ShadowDirection;
  reasons: string[];
  /** Razlika bez ijednog razloga je greška, ne ušteda. */
  explained: boolean;
}

export interface ShadowReasonCount {
  reason: string;
  /** Koliko dana sa **razlikom** ima taj razlog. */
  days: number;
}

export type ShadowVerdict =
  | 'NO_DATA'
  | 'NOT_ENOUGH_DAYS'
  | 'UNEXPLAINED_DIFFERENCES'
  | 'NO_DIFFERENCES'
  | 'READY';

export interface ShadowReport {
  /** Koliko redova uopšte postoji u periodu. */
  days: number;
  /** Za koliko dana je shadow izračunat. */
  evaluated: number;
  /** Za koliko dana još nije (shadow se računa uz predlog). */
  pending: number;
  /** Dani bez formule — nema se šta porediti, nije greška. */
  withoutFormula: number;
  /** Dani sa razlikom odluke i formule. */
  differences: number;
  lowered: number;
  raised: number;
  same: number;
  /** Udio dana sa razlikom u svim uporedivim danima, 1 decimala. */
  changeSharePct: number;
  byReason: ShadowReasonCount[];
  /** Razlike bez razloga — prazno polje je uslov za `READY`. */
  unexplained: ShadowComparison[];
  /** Najveća apsolutna razlika u °C, jedna decimala. */
  maxAbsDeltaC: number;
  /** Prosječna apsolutna razlika u °C na danima sa razlikom, jedna decimala. */
  meanAbsDeltaC: number;
  /** Dani u kojima je razlog `MODEL_UNVERIFIED` (nepotvrđen model bojlera). */
  blockedByModel: number;
  /** Dani na kojima je odluka bila istraživanje, a ne konvergencija. */
  explored: number;
  firstDate: string | null;
  lastDate: string | null;
  verdict: ShadowVerdict;
  /** Rečenica uz presudu — za log, UI i docs, da se broj ne čita pogrešno. */
  verdictNote: string;
}

/**
 * Koliko dana shadow period mora trajati prije nego odluka smije postati
 * predlog. Tri sedmice: dovoljno da se vide i radni dani i vikendi, i da se
 * pojavi bar jedno hlađenje/noć ispod cilja. Manje od toga je nagađanje.
 */
export const SHADOW_MIN_DAYS = 21;

/**
 * Granica „isto". Polazna se zaokružuje na 0,5 °C u odluci, a formula na 0,1;
 * zato razlika od 0,05 nije razlika nego zaokruživanje.
 */
export const SHADOW_EQUAL_TOLERANCE_C = 0.05;

/** Razlozi spojeni `+`; prazno i `null` daju prazan spisak, ne `['']`. */
export function parseReasons(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split('+')
    .map((reason) => reason.trim())
    .filter((reason) => reason.length > 0);
}

function rounded(value: number, decimals = 1): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Poredi jedan dan. `null` kad se dan ne može porediti: nema formule, nema
 * odluke, ili shadow nije izračunat. Ti dani ulaze u `pending`/`withoutFormula`,
 * ne u razlike — inače bi nedostatak podatka izgledao kao neslaganje.
 */
export function compareShadowDay(row: ShadowRow): ShadowComparison | null {
  if (row.shadowFlowC == null) return null;
  if (row.proposedFlowTemp == null) return null;

  const deltaC = rounded(row.shadowFlowC - row.proposedFlowTemp, 2);
  const direction: ShadowDirection =
    deltaC < -SHADOW_EQUAL_TOLERANCE_C
      ? 'LOWER'
      : deltaC > SHADOW_EQUAL_TOLERANCE_C
        ? 'HIGHER'
        : 'SAME';

  const reasons = parseReasons(row.shadowReasons);
  const isSame = direction === 'SAME';

  return {
    localDate: row.localDate,
    formulaC: row.proposedFlowTemp,
    decisionC: row.shadowFlowC,
    deltaC: isSame ? 0 : deltaC,
    direction,
    reasons,
    // Za isti dan razlog nije potreban; za različit — jeste.
    explained: isSame || reasons.length > 0,
  };
}

/**
 * Izvještaj nad nizom redova. Deterministički: isti ulaz daje isti izlaz,
 * sortiran po datumu, bez oslanjanja na redoslijed iz baze.
 */
export function shadowReport(rows: ShadowRow[]): ShadowReport {
  const rowsSorted = [...rows].sort((a, b) =>
    a.localDate.localeCompare(b.localDate),
  );

  const comparisons = rowsSorted
    .map(compareShadowDay)
    .filter((comparison): comparison is ShadowComparison => comparison != null);

  const evaluated = rowsSorted.filter((row) => row.shadowAt != null).length;
  const pending = rowsSorted.filter(
    (row) => row.shadowAt == null && row.shadowFlowC == null,
  ).length;
  const withoutFormula = rowsSorted.filter(
    (row) => row.proposedFlowTemp == null,
  ).length;

  const differing = comparisons.filter(
    (comparison) => comparison.direction !== 'SAME',
  );
  const lowered = differing.filter((c) => c.direction === 'LOWER').length;
  const raised = differing.filter((c) => c.direction === 'HIGHER').length;

  const reasonCounts = new Map<string, number>();
  for (const comparison of differing) {
    for (const reason of new Set(comparison.reasons)) {
      reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
    }
  }
  const byReason: ShadowReasonCount[] = [...reasonCounts.entries()]
    .map(([reason, days]) => ({ reason, days }))
    .sort((a, b) => b.days - a.days || a.reason.localeCompare(b.reason));

  const unexplained = differing.filter((comparison) => !comparison.explained);

  const absDeltas = differing.map((comparison) => Math.abs(comparison.deltaC));
  const maxAbsDeltaC = absDeltas.length > 0 ? rounded(Math.max(...absDeltas)) : 0;
  const meanAbsDeltaC =
    absDeltas.length > 0
      ? rounded(absDeltas.reduce((sum, value) => sum + value, 0) / absDeltas.length)
      : 0;

  const explored = rowsSorted.filter((row) => row.shadowExploration === true).length;

  const blockedByModel = differing.filter((comparison) =>
    comparison.reasons.includes('MODEL_UNVERIFIED'),
  ).length;

  const changeSharePct =
    comparisons.length > 0
      ? rounded((differing.length / comparisons.length) * 100)
      : 0;

  const { verdict, verdictNote } = judge({
    evaluated,
    differences: differing.length,
    unexplained: unexplained.length,
  });

  return {
    days: rowsSorted.length,
    evaluated,
    pending,
    withoutFormula,
    differences: differing.length,
    lowered,
    raised,
    same: comparisons.length - differing.length,
    changeSharePct,
    byReason,
    unexplained,
    maxAbsDeltaC,
    meanAbsDeltaC,
    blockedByModel,
    explored,
    firstDate: rowsSorted[0]?.localDate ?? null,
    lastDate: rowsSorted[rowsSorted.length - 1]?.localDate ?? null,
    verdict,
    verdictNote,
  };
}

/**
 * Presuda. Redoslijed provjera je namjeran: **neobjašnjena razlika je prva**,
 * prije broja dana — nedostatak objašnjenja ne postaje manji time što se čekalo
 * duže, a presuda „još nema dovoljno dana" bi to sakrila.
 */
function judge(input: {
  evaluated: number;
  differences: number;
  unexplained: number;
}): { verdict: ShadowVerdict; verdictNote: string } {
  if (input.evaluated === 0) {
    return {
      verdict: 'NO_DATA',
      verdictNote:
        'Nema nijednog izračunatog shadow dana — o odluci se još ne može ništa reći.',
    };
  }

  if (input.unexplained > 0) {
    return {
      verdict: 'UNEXPLAINED_DIFFERENCES',
      verdictNote:
        `${input.unexplained} dan(a) ima razliku bez razloga. To je greška u ` +
        'kontroleru, ne ušteda — odluka se ne pušta dok se ne objasni.',
    };
  }

  if (input.evaluated < SHADOW_MIN_DAYS) {
    return {
      verdict: 'NOT_ENOUGH_DAYS',
      verdictNote:
        `${input.evaluated} od ${SHADOW_MIN_DAYS} dana. Sve razlike su ` +
        'objašnjene, ali period je prekratak da se vidi i hlađenje i vikend.',
    };
  }

  if (input.differences === 0) {
    return {
      verdict: 'NO_DIFFERENCES',
      verdictNote:
        'Odluka se nigdje ne razlikuje od formule. Nema šta da se pokvari, ali ' +
        'nema ni dokaza da kontroler išta mijenja — zamjena bi bila bez učinka.',
    };
  }

  return {
    verdict: 'READY',
    verdictNote:
      `${input.differences} razlika u ${input.evaluated} dana, sve objašnjene. ` +
      'Uslov za puštanje odluke na bojler je ispunjen.',
  };
}

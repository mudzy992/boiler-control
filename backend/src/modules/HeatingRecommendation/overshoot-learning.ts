/**
 * F5.4 — premašivanje cilja se uči **jednom**.
 *
 * **Problem koji se rješava.** U `heating.recommendation.service.ts` dvije
 * kolone akumuliraju **istu varijablu**:
 *
 *   overshoot = T_soba_trenutno − T_soba_cilj
 *   offset        ← pokretni prosjek `overshoot`
 *   avgOvershoot  ← pokretni prosjek `overshoot`
 *
 * a `full.strategy.ts` ih onda sabira sa težinama 1 i 0,5:
 *
 *   intervalOffset = offset + avgOvershoot·0,5 + …
 *
 * Dakle isti mjereni broj ulazi **dvaput**, jednom pun i jednom upola. To nije
 * dvostruka korekcija „zato što je važna" — to je ista korekcija primijenjena
 * 1,5 puta, i to bez ijednog mjesta u kodu gdje se to vidi kao odluka.
 *
 * **Zašto percentil, a ne prosjek.** Prosjek premašivanja je pogrešna mjera za
 * odluku koju nosi najgori slučaj. Kuća koja 25 dana premaši 0,1 K a 2 dana
 * 5 K (rođendan, otvoren prozor) ima prosjek 0,46 K — pa se polazna spušta
 * zbog dva dana koja nijesu bila greška modela. Medijana bi ih ignorisala, ali
 * bi ignorisala i sistematsko premašivanje od 2 K na polovini dana. **90.
 * percentil** je mjera koja odgovara pitanju: „koliko visoko premašuje kad
 * stvarno premašuje".
 *
 * **Zašto se `offset` ne briše.** On ima svoju ulogu: pokretni prosjek
 * **ukupnog** odstupanja (u oba smjera), pa nosi i podbačaj. Novi izraz koristi
 * samo premašivanje. Zato se `offset` zadržava kakav jeste, a `avgOvershoot`
 * prestaje ulaziti u odluku — v. `overshootCorrectionC()` i njegov jedini
 * pozivalac (`full.strategy.ts`).
 */

/**
 * Koliko uzoraka treba da bi percentil bio mjera, a ne slučajnost.
 *
 * 5 je minimum iz kojeg se 90. percentil može izračunati linearno a da ne
 * postane jednak maksimumu. Ispod toga funkcija vraća `null` — „ne znam", a ne
 * nulu: nula bi tvrdila da premašivanja nema, što sa 2 uzorka nije tvrdnja.
 */
export const OVERSHOOT_MIN_SAMPLES = 5;

/** Percentil koji se uzima. V. obrazloženje u zaglavlju. */
export const OVERSHOOT_PERCENTILE = 90;

/**
 * Gornja granica korekcije, u °C.
 *
 * Isti red veličine kao `MAX_DAILY_CHANGE_K` (2 K): korekcija veća od dnevnog
 * koraka bila bi veći skok od onoga što sistem smije napraviti u jednom danu,
 * pa bi je kontroler svejedno odsjekao — a onda bi broj u zapisu bio lažan.
 */
export const OVERSHOOT_MAX_CORRECTION_C = 2.0;

/**
 * Težina kojom percentil ulazi u polaznu.
 *
 * Namjerno **manje od 1**: 90. percentil je gornja granica ponašanja, a ne
 * tipično. Primijeniti ga pun značilo bi podesiti sistem prema najgorem danu
 * svaki dan. Ista logika kao `* 0.5` u staroj liniji, samo sada primijenjena
 * **jednom** i sa imenom.
 */
export const OVERSHOOT_WEIGHT = 0.5;

function finiteNumber(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Linearna interpolacija percentila — ista definicija kao u mjernim skriptama. */
export function percentile(
  values: readonly number[],
  p: number,
): number | null {
  const clean = values.filter((v) => Number.isFinite(v));
  if (clean.length === 0) return null;
  const sorted = [...clean].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0];
  const rank = (Math.min(100, Math.max(0, p)) / 100) * (sorted.length - 1);
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  if (low === high) return sorted[low];
  return sorted[low] + (sorted[high] - sorted[low]) * (rank - low);
}

export interface OvershootInput {
  /** Premašivanja cilja, po uzorku (K). Pozitivno = bilo je prevruće. */
  samples: readonly number[];
  /** Koliko uzoraka treba (mijenja se samo u testovima). */
  minSamples?: number;
  /** Percentil (mijenja se samo u testovima). */
  percentileValue?: number;
}

export interface OvershootEstimate {
  /**
   * Korekcija polazne u °C: **pozitivna znači spusti polaznu** (bilо je
   * prevruće). `null` = nema osnova.
   */
  correctionC: number | null;
  /** Koliko uzoraka je ušlo. */
  samples: number;
  /** Sirovi percentil, prije težine i granice — za log i za mjerenje. */
  rawC: number | null;
  /** Da li je granica djelovala. */
  capped: boolean;
  reason: 'NO_SAMPLES' | 'OK';
}

/**
 * Premašivanje → korekcija polazne.
 *
 * **Znak.** Premašivanje je pozitivno kad je soba bila toplija od cilja, pa
 * polazna treba **niže** — zato se vraća pozitivan broj koji pozivalac
 * oduzima. Obrnut znak bi tiho grijao umjesto da hladi, što je najgori ishod
 * (kuća se pregrijava, a aplikacija podiže).
 *
 * Negativna premašivanja (podbačaj) se **ne odbijaju** ovdje nego **ne ulaze**:
 * percentil od 90 uzima gornji rep, pa podbačaj sam po sebi ne mijenja
 * korekciju. Podbačaj ima svoje pravilo (`NIGHT_FLOOR`, `SHORT_CYCLES`).
 */
export function estimateOvershootCorrection(
  input: OvershootInput,
): OvershootEstimate {
  const minSamples = input.minSamples ?? OVERSHOOT_MIN_SAMPLES;
  const p = input.percentileValue ?? OVERSHOOT_PERCENTILE;

  const samples = input.samples.filter((v) => Number.isFinite(v));
  if (samples.length < minSamples) {
    return {
      correctionC: null,
      samples: samples.length,
      rawC: null,
      capped: false,
      reason: 'NO_SAMPLES',
    };
  }

  const raw = percentile(samples, p);
  if (raw == null || raw <= 0) {
    // Premašivanje nije pozitivno — nema šta da se spušta. To **nije** nula iz
    // nedostatka podataka nego izmjerena nula, i zato je `OK` sa `0`.
    return {
      correctionC: 0,
      samples: samples.length,
      rawC: raw,
      capped: false,
      reason: 'OK',
    };
  }

  const weighted = raw * OVERSHOOT_WEIGHT;
  const capped = weighted > OVERSHOOT_MAX_CORRECTION_C;
  return {
    correctionC: Math.min(OVERSHOOT_MAX_CORRECTION_C, weighted),
    samples: samples.length,
    rawC: raw,
    capped,
    reason: 'OK',
  };
}

/**
 * Korekcija iz već izračunatog percentila — za mjesto gdje se po uzorku ne
 * pamti istorija (`HeatingIntervalLearning` je jedan red).
 *
 * `p90OvershootC` je `null` kod redova napisanih prije F5.4; tada se vraća
 * `null`, dakle „ne mijenjaj", a ne stara vrijednost `avgOvershoot`. Stara
 * vrijednost je upravo ono što je ulazilo dvaput.
 */
export function overshootCorrectionFrom(
  p90OvershootC: number | null | undefined,
): number | null {
  const p90 = finiteNumber(p90OvershootC);
  if (p90 == null) return null;
  if (p90 <= 0) return 0;
  return Math.min(OVERSHOOT_MAX_CORRECTION_C, p90 * OVERSHOOT_WEIGHT);
}

/**
 * Sljedeća vrijednost `p90OvershootC` iz jednog novog uzorka.
 *
 * **Zašto ne tačan percentil.** `HeatingIntervalLearning` je jedan red po
 * intervalu — istoriju uzoraka ne pamtimo, pa se tačan 90. percentil iz
 * skupa ne može izračunati. Opcije su bile tri:
 *
 *   1. praviti novu tabelu uzoraka (migracija + rast baze),
 *   2. uzeti prosjek (upravo ono što F5.4 uklanja),
 *   3. držati **tekući percentil** kao jedan broj i ažurirati ga.
 *
 * Odabrano je (3), sa dvije namjerne osobine:
 *
 * - **dok uzoraka ima manje od `OVERSHOOT_MIN_SAMPLES`, ništa se ne mijenja**
 *   (`null`). Percentil iz dva uzorka je jednak maksimumu tih dvaju — to je
 *   isti problem kao prosjek, samo drugim imenom;
 * - **prema gore ide brže nego dolje**: novi uzorak iznad trenutnog percentila
 *   podiže ga za pola razlike, a ispod ga spušta za desetinu. Time percentil
 *   prati **rep** (dane kad stvarno premašuje), a ne svaki miran dan. To je
 *   razlika između „mjeri premašivanje" i „mjeri prosječno ponašanje".
 *
 * Asimetrija je odluka, ne slučajnost: kad rep poraste, model treba da reaguje
 * odmah (kuća se pregrijava); kad rep padne, dokaz slabije stoji, pa se
 * spušta sporo — isto pravilo kao `NIGHT_MARGIN_K` prema noćnom podbačaju.
 */
export function nextPercentile(input: {
  previousP90: number | null | undefined;
  samples: number;
  /** Novo premašivanje (K). */
  newSample: number;
  minSamples?: number;
}): number | null {
  const minSamples = input.minSamples ?? OVERSHOOT_MIN_SAMPLES;
  if (input.samples < minSamples) return input.previousP90 ?? null;

  const previous = finiteNumber(input.previousP90);
  const sample = finiteNumber(input.newSample);
  if (sample == null) return previous;
  if (previous == null) return sample;

  if (sample > previous) return previous + (sample - previous) * 0.5;
  return previous + (sample - previous) * 0.1;
}

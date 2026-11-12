/**
 * F5.3 — `confidence` učenja intervala.
 *
 * **Problem koji se rješava.** Stara formula je bila
 *
 *   conf' = min(1, (conf·n + 0,1) / (n+1))
 *
 * a to je običan pokretni prosjek sa **fiksnim prirastom 0,1**. Njena fiksna
 * tačka je 0,1: ako krene od 0,1, tu i ostaje. Izmjereno: poslije 320 uzoraka
 * `confidence` je još 0,1000. Dakle broj koji ulazi u **35 % health score-a**
 * nije mjerio ništa — bio je konstanta koja izgleda kao mjera.
 *
 * Zato se ovdje `confidence` **računa iz dokaza**, a ne akumulira:
 *
 *   conf = (n / (n + N_HALF)) · max(0, 1 − residualStd / RESIDUAL_SCALE_C)
 *
 * Prvi član je **koliko dokaza ima**: 0 uzoraka daje 0, `N_HALF` uzoraka daje
 * 0,5, beskonačno daje 1. To je jedina ispravna veza između „malo uzoraka" i
 * „nisam siguran" — više uzoraka ne može značiti manje pouzdanja.
 *
 * Drugi član je **koliko se uzorci slažu**: odstupanje od modela u stepenima.
 * Bez njega bi 100 uzoraka koji se međusobno razilaze (`residualStd` veliki)
 * dalo istu sigurnost kao 100 uzoraka koji se slažu — a to je suprotno od
 * onoga što riječ znači.
 *
 * **Zašto `max(0, …)` a ne `min(1, …)` na drugom članu.** `residualStd` iznad
 * `RESIDUAL_SCALE_C` znači da model ne objašnjava uzorke; sigurnost tada mora
 * pasti na **nulu**, a ne na malu vrijednost. Mala vrijednost bi kroz 35 %
 * težine health score-a izgledala kao „skoro pouzdano", što je najgori ishod:
 * pokvaren model sa visokim skorom.
 *
 * **Šta se NE tvrdi.** `confidence` nije vjerovatnoća i ne kalibriše se
 * (v. F3.1). On govori samo „koliko dokaza i koliko slaganja", i tako se i
 * koristi: kao težina, ne kao tvrdnja o tačnosti.
 */

/**
 * Koliko uzoraka daje `confidence = 0,5` (uz savršeno slaganje).
 *
 * 10 je odabrano jer je interval učenja (`intervalKey`) **dio dana**, pa se
 * jedan uzorak skuplja jednom dnevno: 10 uzoraka je deset dana istog dijela
 * dana. Ispod toga je dovoljno rijetko da se ne smije nositi zdravstveni skor.
 */
export const CONFIDENCE_HALF_SAMPLES = 10;

/**
 * `residualStd` pri kojem drugi član pada na nulu.
 *
 * 2,0 K je izabrano iz istog razloga kao `THERMOSTAT_DEAD_ZONE_K = 1,0`:
 * odstupanje reda mrtve zone je šum, odstupanje duplo veće od nje znači da
 * model opisuje drugu kuću. Vrijednost je namjerno **u stepenima**, ne u
 * procentima — da se ne pomiješa sa `confidence` koji je 0..1.
 */
export const RESIDUAL_SCALE_C = 2.0;

/** Donja granica: bez ijednog uzorka nema osnova. */
export const CONFIDENCE_MIN = 0;
/** Gornja granica: nikad se ne tvrdi potpuna sigurnost. */
export const CONFIDENCE_MAX = 1;

/**
 * Granica ispod koje se `confidence` **ne koristi** kao puna težina.
 *
 * Nije dio formule nego pravilo primjene: offset pomnožen sa 0,1 gotovo nije
 * pomjeren, a sistem se ponaša kao da učenja nema. Zapisano da se prag vidi, a
 * ne da se izvodi iz `0.1` razbacanog po strategijama.
 */
export const CONFIDENCE_NEGLIGIBLE = 0.1;

export interface ConfidenceInput {
  /** Broj uzoraka iz kojih je model naučen. */
  samples: number | null | undefined;
  /** Standardno odstupanje ostataka, u °C. `null` = nije izmjereno. */
  residualStd: number | null | undefined;
  /** Koliko uzoraka daje 0,5 — mijenja se samo u testovima. */
  halfSamples?: number;
  /** Skala ostatka — mijenja se samo u testovima. */
  residualScaleC?: number;
}

export interface ConfidenceResult {
  /** 0..1. `0` znači „nema dokaza", ne „loše je". */
  confidence: number;
  /** Dio koji nosi količina dokaza (0..1). */
  evidencePart: number;
  /** Dio koji nosi slaganje (0..1). */
  agreementPart: number;
  /** Zašto je nula, kad jeste — da se u logu vidi razlog, ne samo broj. */
  reason: 'NO_SAMPLES' | 'NO_AGREEMENT' | 'OK';
}

function finiteNumber(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function rounded(value: number, decimals = 4): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Izračun `confidence` iz dokaza.
 *
 * Redoslijed provjera je namjeran: prvo „ima li uzoraka", pa „slažu li se".
 * Obrnuto bi dalo isti broj, ali bi razlog u logu bio pogrešan (`NO_AGREEMENT`
 * za slučaj kad uopšte nema uzoraka).
 */
export function intervalConfidence(input: ConfidenceInput): ConfidenceResult {
  const halfSamples = input.halfSamples ?? CONFIDENCE_HALF_SAMPLES;
  const residualScaleC = input.residualScaleC ?? RESIDUAL_SCALE_C;

  const samples = finiteNumber(input.samples);
  if (samples == null || samples <= 0) {
    return {
      confidence: CONFIDENCE_MIN,
      evidencePart: 0,
      agreementPart: 0,
      reason: 'NO_SAMPLES',
    };
  }

  // 1. Koliko dokaza ima. Nikad ne prelazi 1 i strogo raste sa `n`.
  const evidencePart = samples / (samples + halfSamples);

  // 2. Koliko se uzorci slažu. Nepoznat ostatak **ne** znači savršeno
  //    slaganje: uzima se kao nula slaganja, jer bi suprotno davalo visoku
  //    sigurnost za model koji nikad nije provjeren.
  const residual = finiteNumber(input.residualStd);
  const agreementPart =
    residual == null
      ? 0
      : Math.max(0, Math.min(1, 1 - residual / residualScaleC));

  const raw = evidencePart * agreementPart;
  const confidence = Math.max(CONFIDENCE_MIN, Math.min(CONFIDENCE_MAX, raw));

  return {
    confidence: rounded(confidence),
    evidencePart: rounded(evidencePart),
    agreementPart: rounded(agreementPart),
    reason: confidence === 0 ? 'NO_AGREEMENT' : 'OK',
  };
}

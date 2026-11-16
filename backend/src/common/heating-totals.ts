/**
 * Kako se iz niza `HeatingEvent` redova dobijaju analitički brojevi — JEDAN IZVOR.
 *
 * **Zašto postoji.** Prije ovoga su isti brojevi računati na **tri** mjesta:
 * `dashboard.service.ts` (`getHeatingSummary`), `analytics-export.ts`
 * (`version=2`, CSV/JSON) i `version=1` izvoz koji zove isti servis. Tri mjesta
 * za jednu mjeru znače da se popravka mora desiti tri puta — a do 16.11. se
 * nije ni desila ni jednom.
 *
 * **Dva kvara koja su ovdje popravljena, oba izmjerena** (`AUDIT-analitika.md`,
 * run `43841582208`):
 *
 *   1. **Otvoren ciklus.** `totalCycles` je bio `events.length`, a trajanje se
 *      sabiralo samo za redove sa `timestampEnd`. Otvoren ciklus je zato ulazio
 *      u imenilac a ne u brojilac, pa je prosječno trajanje **padalo dok
 *      grijanje traje**. Mjerenje: prosjek je pao 223,06 → 219,73 min **bez**
 *      promjene stvarnog trajanja, jer je 1 ciklus od 67 bio otvoren.
 *      Popravka: otvoren ciklus se mjeri **do sada**, jer grijanje još traje.
 *
 *   2. **Nula kao temperatura.** `avgIndoorTemp` je sabirao `roomCurrentTemp`
 *      bez filtera, pa je red sa 0 °C ulazio u prosjek kao stvarna nula. Kolona
 *      je `Float` (obavezna), pa nula nije `null` — u bazi je **vrijednost**,
 *      ali fizički nemoguća za sobu: nula u sobi je senzor koji nije javio, ne
 *      mjerenje. Mjerenje: 1 takav red → prikaz 20,31 °C umjesto 20,62 °C.
 *      Popravka: takav red se **izostavlja** i **broji**, i taj broj se vraća
 *      klijentu (`excludedZeroTemp`) — da ekran može reći „prosjek od 65 od
 *      66" umjesto da prećuti da nešto fali.
 *
 * Funkcije su namjerne ČISTE (bez Prisma/DI), da se tvrde bez baze.
 */

/** Sočna temperatura ispod koje red nije mjerenje (`M2` u auditu). */
export const MIN_PLAUSIBLE_ROOM_C = 5;

export interface HeatingEventLike {
  timestampStart: Date;
  timestampEnd: Date | null;
  roomCurrentTemp: number;
  roomTargetTemp: number;
}

export interface HeatingTotals {
  /** Broj ciklusa — svi redovi, otvoreni i zatvoreni. */
  totalCycles: number;
  /** Ukupno trajanje; otvoren ciklus se mjeri do `now`. */
  totalDurationMin: number;
  /** Prosječno trajanje; `0` samo kad nema ciklusa. */
  avgDurationMin: number;
  /**
   * Prosječna unutrašnja temperatura, bez fizički nemogućih redova.
   * `null` kad nijedan red nema upotrebljivu temperaturu — nula bi tvrdila
   * mjerenje koje ne postoji.
   */
  avgIndoorTemp: number | null;
  /** Koliko je redova izostavljeno iz `avgIndoorTemp` (senzor nije javio). */
  excludedZeroTemp: number;
  /** Koliko je ciklusa bilo otvoreno u trenutku mjerenja. */
  openCycles: number;
}

/**
 * Trajanje jednog ciklusa u minutama.
 *
 * Otvoren ciklus traje **do `now`** — to je jedina vrijednost koja ne mijenja
 * prosjek samim tim što je mjerenje palo usred grijanja. Ako je `now` prije
 * početka (sat unazad), trajanje je 0, ne negativno.
 */
export function cycleDurationMin(event: HeatingEventLike, now: Date): number {
  const end = event.timestampEnd ?? now;
  const ms = end.getTime() - event.timestampStart.getTime();
  return ms > 0 ? ms / 60_000 : 0;
}

/** Da li je temperatura upotrebljiva kao mjerenje sobe. */
export function isPlausibleRoomTemp(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= MIN_PLAUSIBLE_ROOM_C
  );
}

/**
 * Sve ukupne mjere iz niza događaja.
 *
 * `now` je parametar, ne `new Date()` unutra: bez toga test ne može tvrditi
 * trajanje otvorenog ciklusa, a rezultat bi zavisio od trenutka izvršavanja.
 */
export function heatingTotals(
  events: readonly HeatingEventLike[],
  now: Date,
): HeatingTotals {
  let totalDuration = 0;
  let openCycles = 0;
  let tempSum = 0;
  let tempCount = 0;
  let excludedZeroTemp = 0;

  for (const event of events) {
    if (!event.timestampEnd) openCycles += 1;
    totalDuration += cycleDurationMin(event, now);

    if (isPlausibleRoomTemp(event.roomCurrentTemp)) {
      tempSum += event.roomCurrentTemp;
      tempCount += 1;
    } else {
      excludedZeroTemp += 1;
    }
  }

  const totalCycles = events.length;

  return {
    totalCycles,
    totalDurationMin: Math.round(totalDuration),
    avgDurationMin: totalCycles
      ? Number((totalDuration / totalCycles).toFixed(2))
      : 0,
    /*
     * Tri slučaja, tri različita odgovora — i granica je namjerna:
     *
     *   nema događaja      → `0`   (postojeći ugovor; `totalCycles` već kaže
     *                               da je prazno, pa nula ne tvrdi mjerenje)
     *   ima, ali nijedna
     *   temperatura nije
     *   mjerena            → `null` (nula bi rekla „u sobi je 0 °C")
     *   ima mjerenja       → prosjek
     *
     * Prvi slučaj NIJE kvar iz B1 — zato se ne mijenja. Mijenja se samo onaj
     * gdje je nula glumila mjerenje.
     */
    avgIndoorTemp: totalCycles
      ? tempCount
        ? Number((tempSum / tempCount).toFixed(2))
        : null
      : 0,
    excludedZeroTemp,
    openCycles,
  };
}

/**
 * Prosjeci po bucketu, uz iste filtere kao `heatingTotals`.
 *
 * Vraća sirova sabiranja; klijent (servis/izvoz) zadržava svoj oblik odgovora.
 */
export interface BucketTotals {
  cycles: number;
  durationMin: number;
  /** Sabirci za prosjeke — samo iz redova sa upotrebljivom temperaturom. */
  targetSum: number;
  currentSum: number;
  /**
   * Broj redova iz kojih su **oba** prosjeka. Jedan imenilac, jer bucket
   * poredi `avgTargetTemp` sa `avgCurrentTemp`: dva različita skupa redova
   * dala bi razliku koja ne postoji.
   */
  tempCount: number;
}

export function emptyBucket(): BucketTotals {
  return {
    cycles: 0,
    durationMin: 0,
    targetSum: 0,
    currentSum: 0,
    tempCount: 0,
  };
}

/** Dodaje jedan događaj u bucket — ista pravila kao `heatingTotals`. */
export function addEventToBucket(
  bucket: BucketTotals,
  event: HeatingEventLike,
  now: Date,
): BucketTotals {
  bucket.cycles += 1;
  bucket.durationMin += cycleDurationMin(event, now);

  // Zajednički imenilac: red ulazi u prosjeke samo ako ima **obje**
  // temperature upotrebljive. Inače bi „cilj vs postignuto" poredio prosjek
  // cilja iz 10 redova sa prosjekom sobe iz 9.
  if (
    isPlausibleRoomTemp(event.roomCurrentTemp) &&
    Number.isFinite(event.roomTargetTemp)
  ) {
    bucket.targetSum += event.roomTargetTemp;
    bucket.currentSum += event.roomCurrentTemp;
    bucket.tempCount += 1;
  }
  return bucket;
}

/**
 * Petominutni bucket za vremensku seriju (`17` §5.1, `19` §4).
 *
 * Zašto bucket, a ne trenutak upisa: polling ide svake minute, pa bi serija
 * bez poravnanja imala 1440 redova dnevno i svaki red u drugom dijelu minute.
 * Poravnanjem na bucket dobija se 288 redova, a `@@unique([deviceId, at])`
 * postaje garancija da se isti bucket ne može zapisati dvaput — i poslije
 * restarta procesa.
 *
 * Bucket se računa iz apsolutnog vremena (epoha je poravnata na pet minuta),
 * pa je nezavisan od vremenske zone. Lokalni dan se iz njega izvodi kasnije,
 * istom funkcijom kao dnevni zapis.
 */

export const OBSERVATION_INTERVAL_MIN = 5;

const MS_PER_MINUTE = 60_000;

export function observationIntervalMs(
  intervalMin = OBSERVATION_INTERVAL_MIN,
): number {
  return intervalMin * MS_PER_MINUTE;
}

/** Početak bucketa kojem trenutak pripada. */
export function observationBucketStart(
  now: Date,
  intervalMin = OBSERVATION_INTERVAL_MIN,
): Date {
  const step = observationIntervalMs(intervalMin);
  return new Date(Math.floor(now.getTime() / step) * step);
}

/**
 * Redni broj bucketa. Koristi se samo za poređenje "je li se bucket promijenio"
 * — nikad se ne upisuje u bazu.
 */
export function observationBucketIndex(
  now: Date,
  intervalMin = OBSERVATION_INTERVAL_MIN,
): number {
  return Math.floor(now.getTime() / observationIntervalMs(intervalMin));
}

/**
 * Broj redova koji serija proizvodi u danu. Dokumentovana granica, ne procjena:
 * 24 h / 5 min = 288 po uređaju.
 */
export function observationsPerDay(
  intervalMin = OBSERVATION_INTERVAL_MIN,
): number {
  return (24 * 60) / intervalMin;
}

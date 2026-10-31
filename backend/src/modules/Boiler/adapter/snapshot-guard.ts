/**
 * REL-7 (B-026): validacija kvaliteta Tuya snapshot-a.
 *
 * Problem koji ovo rješava: Tuya status je djelimičan — uređaj ponekad ne
 * pošalje `TempCurrent`, `TempSet` ili `Power`. Stari kod je ta polja pretvarao
 * u STVARNE vrijednosti:
 *
 *   `(status['TempCurrent'] ?? null) / 2`  ->  `null / 2 === 0`   (0 °C)
 *   `status['Power'] === true`             ->  `false`            (isključeno)
 *   `status['TempSet'] ?? 0`               ->  `0`                (cilj 0 °C)
 *
 * Poller te vrijednosti nije mogao razlikovati od stvarnog stanja, pa je na
 * njima birao pocetak/kraj grijanja i upisivao ih u bazu.
 *
 * VAŽNO — obim štete: aplikacija NE upravlja termostatom. Tuya API je
 * read-only (nema nijednog PUT/POST prema uređaju u `src/modules/Tuya/**`),
 * pa pogrešna odluka ne može fizički upaliti ni ugasiti grijanje. Šteta je
 * isključivo u podacima: lažni eventi, lažna historija i trajanja, lažne
 * notifikacije i pokvaren ulaz za preporuke/učenje.
 *
 * Princip: NE bilježiti promjenu stanja koju ne možemo posmatrati.
 * Nepoznato ostaje nepoznato — `null`/`undefined`, ne `0`/`false`.
 */

/**
 * Zastavica za ispravku. Zadano UKLJUČENO: staro ponašanje je sigurnosni bug
 * u podacima, pa ga ne treba čuvati kao zadano. Zastavica postoji samo za
 * rollback bez deploya koda.
 */
export const SNAPSHOT_GUARD_FLAG = 'INCOMPLETE_SNAPSHOT_GUARD_ENABLED';

const OFF_VALUES = new Set(['off', 'false', '0', 'no']);

/**
 * Čita env i odlučuje da li je guard aktivan. Čista funkcija (bez DI) da bi se
 * dala testirati bez Nest kontejnera — isti obrazac kao `auth-cookie.ts:25`.
 *
 * Sve osim eksplicitnog "off" znači UKLJUČENO, uključujući prazan string i
 * nepostojanje varijable.
 */
export function snapshotGuardEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const raw = (env[SNAPSHOT_GUARD_FLAG] ?? 'on').trim().toLowerCase();
  return !OFF_VALUES.has(raw);
}

/**
 * Normalizuje brojčano polje iz Tuya statusa.
 *
 * Ključna razlika u odnosu na stari kod: **0 je stvarna vrijednost**, a
 * nedostajuće polje je `null`. Stari `?? 0` je brisao tu razliku.
 */
export function toNullableNumber(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'boolean') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * Normalizuje boolean polje iz Tuya statusa.
 *
 * `false` je stvarna vrijednost (korisnik je ugasio termostat); nedostajuće
 * polje je `undefined`. Stari `=== true` je brisao tu razliku.
 *
 * Namjerno NE prihvata stringove `'true'`/`'false'`: postojeći kod je očekivao
 * boolean (`status['Power'] === true`) i nema dokaza da Tuya za ovaj model
 * šalje string. Tiho proširivanje bi moglo pretvoriti stvarni kvar u tiho
 * drugačije ponašanje.
 */
export function toNullableBoolean(raw: unknown): boolean | undefined {
  return typeof raw === 'boolean' ? raw : undefined;
}

/** Imena polja koja nedostaju, radi loga i metrike. Prazan niz = kompletan. */
export function missingSnapshotFields(snapshot: {
  currentTemp: number | null;
  targetTemp: number | null;
  powerOn?: boolean;
}): string[] {
  const missing: string[] = [];
  if (snapshot.currentTemp === null) missing.push('TempCurrent');
  if (snapshot.targetTemp === null) missing.push('TempSet');
  if (snapshot.powerOn === undefined) missing.push('Power');
  return missing;
}

/** Da li je snapshot dovoljno potpun da se na njemu smije odlučivati. */
export function isSnapshotComplete(snapshot: {
  currentTemp: number | null;
  targetTemp: number | null;
  powerOn?: boolean;
}): boolean {
  return missingSnapshotFields(snapshot).length === 0;
}

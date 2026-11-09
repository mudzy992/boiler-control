/**
 * Zaborav granice iz kratkih ciklusa (`24` §7).
 *
 * Granica se pamti jer bi se inače polazna vraćala na istu grešku svaki drugi
 * dan: naučeno „ispod 50 °C počinju kratki ciklusi" mora nadživjeti jučerašnji
 * dan, inače se sutra spusti na 49 i ciklusi se ponove.
 *
 * Ali **zauvijek** je pogrešno na drugu stranu. Kratki ciklusi su svojstvo
 * **uslova**, ne kuće: pojave se pri blagoj zimi, kad kotao radi na maloj
 * modulaciji, ili kad je neko zgazio prag na termostatu. Ako se 30 dana nisu
 * ponovili, granica je prestala da bude dokaz i postala je navika koja drži
 * polaznu višom nego što treba — a too visoka polazna je ono što je i dovelo do
 * pregrijavanja.
 *
 * Zato granica **ističe**, i to se vidi u podacima: `shortCycleFloorAt` je
 * datum kad je dokaz posljednji put potvrđen.
 */

/**
 * Koliko dana granica važi bez ponavljanja. Mjesec dana pokriva i hladniji i
 * topliji dio istog perioda, a duže bi značilo da granica preživi sezonu u
 * kojoj je nastala.
 */
export const SHORT_CYCLE_FLOOR_TTL_DAYS = 30;

export type ShortCycleFloorAge = 'NONE' | 'FRESH' | 'EXPIRED' | 'UNKNOWN';

export interface StoredShortCycleFloor {
  /** Zapamćena granica; `null` kad je nikad nije bilo. */
  floorC: number | null;
  /** Kada je dokaz posljednji put potvrđen; `null` za starije zapise. */
  at: Date | null;
}

export interface EffectiveShortCycleFloor {
  /** Granica koja se smije koristiti; `null` kad je nema ili je istekla. */
  floorC: number | null;
  age: ShortCycleFloorAge;
  /** Starost u danima; `null` kad nema datuma. */
  ageDays: number | null;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Granica koja se primjenjuje danas.
 *
 * Namjerno **nema** tihe pretpostavke o starim zapisima: granica bez datuma
 * ostaje na snazi (`UNKNOWN`), jer brisanje granice koja je nastala iz stvarnih
 * kratkih ciklusa znači vraćanje na polaznu koja ih je proizvela. Nedostatak
 * datuma nije dokaz da je dokaz istekao.
 */
export function effectiveShortCycleFloor(
  stored: StoredShortCycleFloor | null | undefined,
  now: Date,
  ttlDays: number = SHORT_CYCLE_FLOOR_TTL_DAYS,
): EffectiveShortCycleFloor {
  const floorC = stored?.floorC ?? null;
  if (floorC == null || !Number.isFinite(floorC)) {
    return { floorC: null, age: 'NONE', ageDays: null };
  }

  const at = stored?.at ?? null;
  if (at == null || Number.isNaN(at.getTime())) {
    return { floorC, age: 'UNKNOWN', ageDays: null };
  }

  // Sat na serveru može biti ispred upisa; negativna starost nije razlog da
  // granica istekne.
  const ageDays = Math.max(0, (now.getTime() - at.getTime()) / MS_PER_DAY);

  if (ageDays >= ttlDays) {
    return { floorC: null, age: 'EXPIRED', ageDays };
  }

  return { floorC, age: 'FRESH', ageDays };
}

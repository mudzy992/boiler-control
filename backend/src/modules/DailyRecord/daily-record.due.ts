import {
  isProposalDue,
  localDateKey,
  resolveHomeTimeZone,
} from './proposal-schedule';

/**
 * Koja kuća i koji lokalni dan treba zapis u ovom trenutku.
 *
 * Odvojeno od pisca namjerno: ovo je **filter** (koga zvati), a pisac je
 * **autoritet** (šta se piše). Filter postoji da cron ne poziva bazu po svakoj
 * kući svakih pet minuta; ako se filter i pisac raziđu, pisac je taj koji
 * odlučuje, jer on ponovo računa zonu i dan.
 */

export type DueHomeSource = {
  id: number;
  weatherTimezone: string | null;
  user: {
    id: number;
    timezone: string | null;
    activeHomeProfileId: number | null;
  };
};

export type DueHome = {
  homeProfileId: number;
  userId: number;
  localDate: string;
  timeZone: string;
};

/**
 * Jedna kuća po korisniku: aktivna ako je postavljena, inače najstarija.
 *
 * Ovo je popravka greške iz `18` §3 (1): cron je uzimao `homeProfiles[0]`
 * neovisno od `activeHomeProfileId`, pa je korisnik sa dva doma dobijao
 * predlog za pogrešan. Kad `activeHomeProfileId` nije postavljen, najstarija
 * kuća je ista ona koju je stari kod koristio — dakle nema regresije za
 * korisnike sa jednim domom, a nema ni tihe promjene ponašanja.
 */
export function selectDueHomes(
  homes: readonly DueHomeSource[],
  now: Date,
): DueHome[] {
  const byUser = new Map<number, DueHomeSource[]>();
  for (const home of homes) {
    const list = byUser.get(home.user.id);
    if (list) list.push(home);
    else byUser.set(home.user.id, [home]);
  }

  const due: DueHome[] = [];
  for (const list of byUser.values()) {
    const activeId = list[0].user.activeHomeProfileId;
    const active =
      activeId != null
        ? list.find((home) => home.id === activeId)
        : list.reduce((oldest, home) => (home.id < oldest.id ? home : oldest));

    if (!active) continue;

    const zone = resolveHomeTimeZone({
      homeTimeZone: active.weatherTimezone,
      userTimeZone: active.user.timezone,
    });
    if (!isProposalDue(now, zone.zone)) continue;

    due.push({
      homeProfileId: active.id,
      userId: active.user.id,
      localDate: localDateKey(now, zone.zone),
      timeZone: zone.zone,
    });
  }

  return due;
}

import type { Prisma } from '../generated/prisma/client';

/**
 * JSON snapshot za kolone tipa `Json` (`DailyRecord.params`).
 *
 * Zašto funkcija, a ne `as` cast: Prisma tipizira `Json` **strukturno** i
 * odbija svaki objekat koji ima polje tipa `undefined` — iako `undefined` u
 * JSON-u i ne postoji. Tipovi naših izvora (`FlowTempResult`, breakdown) imaju
 * opciona polja, pa je razlika između „tip ne odgovara" i „podatak ne postoji"
 * tačno ovdje.
 *
 * Round-trip kroz `JSON.stringify`/`parse` **nije trik da se zaobiđe
 * kompajler**: to je ista transformacija koju bi baza uradila pri upisu. Polja
 * sa `undefined` vrijednošću nestaju, `Date` postaje ISO string, a `NaN`/`Infinity`
 * postaju `null` — i sve troje se dešava prije nego što podatak napusti proces,
 * umjesto tiho na granici baze.
 *
 * Zamka koju treba znati: `undefined` se gubi, pa snapshot ne razlikuje
 * „polje nije bilo postavljeno" od „polje nije ni postojalo". Za reproducibilnost
 * (`17` §11) to je prihvatljivo jer se čita isti snapshot koji je i zapisan;
 * ako nekad zatreba razlika, polja treba pisati kao eksplicitni `null`.
 */
export function jsonSnapshot(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}

/**
 * Jedan modul za brojeve koji opisuju **fizičke i bezbjednosne granice** sistema
 * (plan `PLAN-formula-v2.md`, F5.1).
 *
 * Zašto postoji: ista granica je do danas stajala na više mjesta i to nije bila
 * teorijska opasnost nego stvarna — raspon polazne je bio `30–55` u
 * `DailyRecord/flow-bounds.ts` (model i kontroler) i `46–55` u
 * `Heating/strategies/base.strategy.ts` (stara kriva). Dakle dva dijela sistema
 * su za **istu** polaznu tvrdila različite granice, a nijedan nije bio pogrešan
 * sam po sebi: donja granica krive je bila posljedica toga što kriva ispod 46 °C
 * „prestaje da ima smisla za radijatore", dok model može predložiti niže.
 *
 * Zato ovdje nijesu svi brojevi jedan raspon, nego **imenovane činjenice sa
 * vlasnikom**:
 *
 *  - `BOILER_FLOW_MIN_C` / `BOILER_FLOW_MAX_C` — šta bojler fizički može;
 *  - `CURVE_MIN_FLOW_C` — ispod čega stara kriva nema smisla (vlasnik: kriva,
 *    koja se penzioniše u F4 i tada ovaj broj nestaje zajedno s njom);
 *  - `HOME_MIN_FLOW_C` / `HOME_MAX_FLOW_C` — šta korisnik smije upisati.
 *
 * Pravilo koje modul čuva: **nijedan sloj ne smije podići donju granicu preko
 * onoga što bojler može**, a svaka granica mora imati vlasnika koji je
 * objašnjava. Broj bez vlasnika je broj koji će se za godinu dana mijenjati
 * bez razloga.
 *
 * Ovo **nije** mjesto za pragove koji pripadaju odluci (npr. `stale time`,
 * `dwell`, broj dana za fit) — njih vlasnik ima u svom modulu i testira uz
 * odluku koju mijenjaju.
 */

/** Najniža polazna koju bojler fizički prihvata. */
export const BOILER_FLOW_MIN_C = 30;
/** Najviša polazna koju bojler fizički prihvata. */
export const BOILER_FLOW_MAX_C = 55;

/**
 * Donja granica stare krive. Vlasnik je kriva (`Heating/strategies`), ne model:
 * kriva je nastala za radijatore i ispod 46 °C nema smisla **za nju**. Model
 * tu granicu ne koristi — v. `DailyRecord/flow-bounds.ts`, koji je do sada
 * koristio `30` i bio u pravu za svoj sloj.
 *
 * Uklanja se u F4 zajedno sa krivom; do tada stoji ovdje da se vidi da je
 * razlika namjerna.
 */
export const CURVE_MIN_FLOW_C = 46;
/** Gornja granica stare krive — ista kao fizička, nije odvojen slučaj. */
export const CURVE_MAX_FLOW_C = BOILER_FLOW_MAX_C;

/**
 * Raspon koji korisnik smije upisati za dom. Danas je to isti raspon kao
 * fizički; izdvojen je jer ga F4.8 usklađuje sa modelom i tada se mijenja samo
 * ovdje, a ne na tri mjesta.
 */
export const HOME_MIN_FLOW_C = BOILER_FLOW_MIN_C;
export const HOME_MAX_FLOW_C = BOILER_FLOW_MAX_C;

/**
 * Najveća promjena polazne po danu. Protiv-oscilirajuća, ne fizička: bez nje
 * jedan loš dan može vratiti polaznu 8 °C gore, a sljedeći isto toliko dolje.
 */
export const MAX_DAILY_CHANGE_K = 2;

/**
 * Tolerancija podbačaja (`17` §14.1): `ε = 1,0 K`, ista vrijednost kao mrtva
 * zona termostata. Nije izabrana nego izmjerena — ispod nje se podbačaj ne
 * razlikuje od mjernog šuma senzora (0,5 °C kvantizacija + histereza 1 K).
 */
export const UNDERSHOOT_TOLERANCE_K = 1.0;

/**
 * Mrtva zona termostata. Fizički podatak uređaja, ne naša odluka — zato je ovdje
 * sa komentarom, a ne konstanta u servisu.
 */
export const THERMOSTAT_DEAD_ZONE_K = 1.0;

/**
 * Naziv i vrijednost svake granice, za provjeru u jednom prolazu.
 *
 * Namjerno kao podatak, a ne kao komentar: `flow-constants.spec.ts` provjerava
 * da su navedena imena **stvarno izvezena** i da su odnosi među njima onakvi
 * kakvi su opisani. Tako se ne može desiti da komentar tvrdi jedno a kod drugo.
 */
export const FLOW_CONSTANTS = [
  {
    name: 'BOILER_FLOW_MIN_C',
    value: BOILER_FLOW_MIN_C,
    owner: 'bojler',
    meaning: 'najniža polazna koju bojler prihvata',
  },
  {
    name: 'BOILER_FLOW_MAX_C',
    value: BOILER_FLOW_MAX_C,
    owner: 'bojler',
    meaning: 'najviša polazna koju bojler prihvata',
  },
  {
    name: 'CURVE_MIN_FLOW_C',
    value: CURVE_MIN_FLOW_C,
    owner: 'stara kriva (uklanja se u F4)',
    meaning: 'ispod ovoga kriva nema smisla za radijatore',
  },
  {
    name: 'CURVE_MAX_FLOW_C',
    value: CURVE_MAX_FLOW_C,
    owner: 'stara kriva (uklanja se u F4)',
    meaning: 'gornja granica krive, ista kao fizička',
  },
  {
    name: 'HOME_MIN_FLOW_C',
    value: HOME_MIN_FLOW_C,
    owner: 'korisnik (unos)',
    meaning: 'najniža polazna koju korisnik smije upisati',
  },
  {
    name: 'HOME_MAX_FLOW_C',
    value: HOME_MAX_FLOW_C,
    owner: 'korisnik (unos)',
    meaning: 'najviša polazna koju korisnik smije upisati',
  },
  {
    name: 'MAX_DAILY_CHANGE_K',
    value: MAX_DAILY_CHANGE_K,
    owner: 'kontroler',
    meaning: 'najveća promjena po danu (protiv oscilacije)',
  },
  {
    name: 'UNDERSHOOT_TOLERANCE_K',
    value: UNDERSHOOT_TOLERANCE_K,
    owner: 'mjerena tolerancija',
    meaning: 'ispod ovoga podbačaj se ne razlikuje od šuma senzora',
  },
  {
    name: 'THERMOSTAT_DEAD_ZONE_K',
    value: THERMOSTAT_DEAD_ZONE_K,
    owner: 'termostat',
    meaning: 'histereza uređaja, fizički podatak',
  },
] as const;

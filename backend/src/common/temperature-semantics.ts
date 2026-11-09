/**
 * Kanonska semantika temperatura u cijelom sistemu (`32`).
 *
 * Problem koji ovaj fajl rješava nije tehnički nego jezički: u aplikaciji
 * postoje **dvije potpuno različite** temperature koje se obje zovu „trenutna":
 *
 *   1. temperatura **vazduha u prostoriji** koju očitava termostat, i cilj koji
 *      se od nje očekuje (fiksni ili iz programa);
 *   2. temperatura **polazne vode** u kotlu — onu koju je korisnik ručno podesio
 *      na kotlu i upisao u aplikaciju, i onu koju aplikacija predlaže proračunom.
 *
 * Ako se prva i druga pomiješaju, aplikacija izgleda ispravno a prikazuje
 * pogrešan broj — i to je greška koju nijedan test tipova ne hvata, jer su obje
 * `number` u °C.
 *
 * Zato svako polje u sistemu mora nositi **porodicu** u imenu:
 *
 * | Porodica | Prefiks | Značenje | Piše |
 * |---|---|---|---|
 * | soba | `room…` | vazduh u prostoriji | termostat (poll) |
 * | polazna | `…FlowTemp` | voda koju kotao šalje u sistem | korisnik (ručno) / proračun |
 * | vanjska | `external…` / `outside…` | napolju | uređaj / prognoza |
 *
 * Zabranjena su gola imena: `currentTemp`, `targetTemp`, `suggestedTemp`,
 * `actualTemp`. Ne zato što su ružna, nego zato što ne kažu **šta** mjere.
 * Pravilo je izvršno: `tests/temperature-semantics.spec.ts` pada ako se broj
 * takvih imena u produkcijskom kodu poveća.
 */

/** Kojoj fizikalnoj veličini broj pripada. */
export type TemperatureFamily = 'ROOM' | 'FLOW' | 'OUTDOOR';

/**
 * Temperatura vazduha u prostoriji (°C) — s termostata.
 *
 * `RoomTempC` je namjerno *advisory* tip: brand ne postoji u runtime-u i ne
 * mijenja ništa u legacy kodu. Služi kao oznaka u novom kodu i kao mjesto gdje
 * se pravilo dokumentuje, a stvarnu zaštitu drži test imena.
 */
export type RoomTempC = number & { readonly __family?: 'ROOM' };

/** Temperatura polazne vode u kotlu (°C) — ručno upisana ili predložena. */
export type FlowTempC = number & { readonly __family?: 'FLOW' };

/** Vanjska temperatura (°C) — s uređaja ili iz prognoze. */
export type OutdoorTempC = number & { readonly __family?: 'OUTDOOR' };

export const asRoomTempC = (value: number): RoomTempC => value as RoomTempC;
export const asFlowTempC = (value: number): FlowTempC => value as FlowTempC;
export const asOutdoorTempC = (value: number): OutdoorTempC => value as OutdoorTempC;

/**
 * Kanonska imena po konceptu. Ovo je referenca za refaktorisanja: ako u kodu
 * vidiš nešto što nije u ovoj tabeli, ime je vjerovatno dvosmisleno.
 */
export const TEMPERATURE_FIELDS = {
  /** Soba, trenutno očitana. `HeatingEvent.currentTemp`, `ThermostatDevice.roomCurrentTemp`. */
  roomNow: 'roomCurrentTemp',
  /** Soba, cilj (fiksni ili iz programa). `HeatingEvent.targetTemp`. */
  roomTarget: 'roomTargetTemp',
  /** Polazna voda koju je korisnik upisao kao stvarnu. `BoilerHistory.actualTemp`. */
  flowRecorded: 'actualFlowTemp',
  /** Polazna voda koju predlaže proračun. `BoilerHistory.suggestedTemp`. */
  flowSuggested: 'suggestedFlowTemp',
  /** Polazna voda u `DailyRecord`-u — stanje koje je stvarno bilo na kotlu. */
  flowInDailyRecord: 'flowSetC',
  /** Vanjska temperatura s uređaja. `BoilerHistory.externalTemp`. */
  outdoor: 'externalTemp',
} as const;

/**
 * Naziv za prikaz, nikad golo „temperatura". UI mora reći **šta** mjeri, jer
 * korisnik gleda broj, a ne tip.
 */
export const TEMPERATURE_LABEL_HINT: Record<TemperatureFamily, string> = {
  ROOM: 'temperatura sobe',
  FLOW: 'temperatura polazne vode',
  OUTDOOR: 'vanjska temperatura',
};

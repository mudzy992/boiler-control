import * as constants from '../flow-constants';
import {
  CURVE_MAX_FLOW_C,
  CURVE_MIN_FLOW_C,
  FLOW_CONSTANTS,
  HOME_MAX_FLOW_C,
  HOME_MIN_FLOW_C,
  BOILER_FLOW_MAX_C,
  BOILER_FLOW_MIN_C,
  MAX_DAILY_CHANGE_K,
  THERMOSTAT_DEAD_ZONE_K,
  UNDERSHOOT_TOLERANCE_K,
} from '../flow-constants';
import { FLOW_MAX_C, FLOW_MIN_C } from '../flow-bounds';

/**
 * F5.1 — jedna granica, jedan vlasnik (plan `PLAN-formula-v2.md`).
 *
 * Prije ovog modula raspon polazne je bio `30–55` u `flow-bounds.ts` (model i
 * kontroler) i `46–55` u `base.strategy.ts` (stara kriva). Oba su bila ispravna
 * za svoj sloj, ali se iz koda nije moglo vidjeti da je razlika namjerna — pa
 * je sljedeća izmjena mogla „usklađivanjem" pokvariti jedan od njih.
 *
 * Zato test ne provjerava da su brojevi jednaki, nego da su **odnosi** onakvi
 * kako su opisani, i da komentar i kod ne mogu razići.
 */
describe('F5.1 — granice polazne: jedan vlasnik po granici', () => {
  it('model i kontroler koriste granice bojlera, ne svoje kopije', () => {
    // `flow-bounds` mora izvesti vrijednosti iz zajedničkog modula — ako neko
    // vrati literal `30` / `55`, ovaj test pada i to je namjera.
    expect(FLOW_MIN_C).toBe(BOILER_FLOW_MIN_C);
    expect(FLOW_MAX_C).toBe(BOILER_FLOW_MAX_C);
  });

  it('kriva nikad ne ide ispod fizičke granice bojlera', () => {
    // Suština: kriva je **uža** (46–55), pa nikad ne traži od bojlera nešto što
    // ovaj ne može. Obrnut slučaj bi bio kvar, ne podešavanje.
    expect(CURVE_MIN_FLOW_C).toBeGreaterThanOrEqual(BOILER_FLOW_MIN_C);
    expect(CURVE_MAX_FLOW_C).toBeLessThanOrEqual(BOILER_FLOW_MAX_C);
  });

  it('korisnik ne može upisati van fizičkog raspona', () => {
    expect(HOME_MIN_FLOW_C).toBeGreaterThanOrEqual(BOILER_FLOW_MIN_C);
    expect(HOME_MAX_FLOW_C).toBeLessThanOrEqual(BOILER_FLOW_MAX_C);
    expect(HOME_MIN_FLOW_C).toBeLessThan(HOME_MAX_FLOW_C);
  });

  it('tolerancija podbačaja nije manja od mrtve zone termostata', () => {
    // Ispod mrtve zone podbačaj se ne razlikuje od histereze uređaja, pa bi
    // tolerancija manja od nje brojala šum kao kvar. Vrijednosti su iste (1,0),
    // i to je izmjereno, ne podešeno — zato `>=`, a ne `===`: ako se jednog dana
    // razlikuju, tolerancija smije biti samo veća.
    expect(UNDERSHOOT_TOLERANCE_K).toBeGreaterThanOrEqual(
      THERMOSTAT_DEAD_ZONE_K,
    );
    expect(MAX_DAILY_CHANGE_K).toBeGreaterThan(0);
  });

  it('svaka granica iz tabele postoji kao izvoz i ima vlasnika', () => {
    const exported = constants as unknown as Record<string, unknown>;
    for (const entry of FLOW_CONSTANTS) {
      // Komentar u modulu i tabela moraju opisivati isto — ako se izvoz preimenuje
      // a tabela ne, dokumentacija laže a ništa ne pada.
      expect(typeof exported[entry.name]).toBe('number');
      expect(exported[entry.name]).toBe(entry.value);
      expect(entry.owner.length).toBeGreaterThan(0);
      expect(entry.meaning.length).toBeGreaterThan(0);
    }
  });

  it('tabela ne sadrži duplikate imena', () => {
    const names = FLOW_CONSTANTS.map((entry) => entry.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

import { describe, it, expect } from "vitest";
import {
  ABSOLUTE_MAX_FLOW_TEMP,
  ABSOLUTE_MIN_FLOW_TEMP,
  DEFAULT_FLOW_RANGE,
  MIN_CURRENT_FLOW_TEMP,
  MAX_CURRENT_FLOW_TEMP,
  flowTempRangeMessage,
  isWithinFlowTempRange,
  resolveFlowRange,
  validateFlowTempInput,
} from "../boilerLimits";
// `?raw` daje sadržaj backend DTO-a kao string, pa test može provjeriti da se
// klijentske granice i dalje poklapaju sa serverom.
import setTempDto from "../../../../backend/src/modules/Boiler/dto/set-current-temp.dto.ts?raw";

/**
 * FE2-14 (FE-010): granice temperature polaznog voda.
 *
 * Ovi testovi zaključavaju da klijentske granice ostanu u paritetu s backend
 * `SetCurrentTempDto`. Ako neko promijeni granicu na serveru a ne ovdje (ili
 * obrnuto), web bi ili propuštao zahtjeve koje server odbija, ili blokirao one
 * koje server prihvata.
 *
 * NAPOMENA — health score i pragovi upozorenja (20/3/1.5/90/15) su FE2-14
 * preseljeni u backend (`backend/src/common/heating-health.ts`) i tamo
 * testirani (`heating-health.spec.ts`, 23 testa). Frontend ih više NE računa,
 * pa ovdje namjerno nema njihovih testova — imati ih na oba mjesta bi značilo
 * vratiti duplikaciju koju FE2-14 uklanja.
 */

describe("FE2-14: granice temperature polaznog voda", () => {
  /*
   * `F13` (treći krug): rezerva je **46–55**, ne 48–55.
   *
   * Snimka: Početna je predlagala 47,7 °C, a unos 47 je odbijen sa „mora biti
   * između 48 i 55". Motor izlaz klampa na 46, pa je zadana granica 48 bila
   * *viša* od onoga što isti sistem predlaže — ponuda koja se ne može
   * prihvatiti nije korisnikova greška.
   */
  it("donja granica je 46 (kao motor), gornja 55", () => {
    expect(MIN_CURRENT_FLOW_TEMP).toBe(46);
    expect(MAX_CURRENT_FLOW_TEMP).toBe(55);
  });

  it("predlog iz snimke (47.7 °C) prolazi kroz rezervni raspon", () => {
    expect(isWithinFlowTempRange(47.7)).toBe(true);
    expect(isWithinFlowTempRange(47)).toBe(true);
  });

  it("granice su INKLUDIRAJUĆE na obje strane", () => {
    expect(isWithinFlowTempRange(48)).toBe(true);
    expect(isWithinFlowTempRange(55)).toBe(true);
    expect(isWithinFlowTempRange(51.5)).toBe(true);
  });

  it("vrijednosti izvan granica se odbijaju", () => {
    /*
     * FE-010 je ovdje imao `47.9 → false` sa objašnjenjem „backend je odbija".
     * To više nije tačno: DTO nosi apsolutni raspon 30–55, a motor predlaže i
     * ispod 48. Sada se odbija samo ono što odbija i motor.
     */
    expect(isWithinFlowTempRange(45.9)).toBe(false);
    expect(isWithinFlowTempRange(55.1)).toBe(false);
    expect(isWithinFlowTempRange(0)).toBe(false);
  });

  it("poruka o rasponu sadrži obje granice", () => {
    const msg = flowTempRangeMessage();
    expect(msg).toContain(String(MIN_CURRENT_FLOW_TEMP));
    expect(msg).toContain(String(MAX_CURRENT_FLOW_TEMP));
  });

  it("PARITET S BACKENDOM: klijentske granice odgovaraju @Min/@Max u DTO-u", () => {
    const minMatch = /@Min\((\d+)\)/.exec(setTempDto);
    const maxMatch = /@Max\((\d+)\)/.exec(setTempDto);

    expect(minMatch).not.toBeNull();
    expect(maxMatch).not.toBeNull();
    /*
     * `F13`: DTO nosi APSOLUTNI raspon (30–55), a domaći (zadano 48–55) se
     * provjerava u servisu i čita sa `GET /api/boiler/flow-range`. Prije je
     * `@Min(48)` bio i korisnički i fizički minimum, pa je motor mogao
     * predložiti 46 °C koje aplikacija odbija.
     */
    expect(Number(minMatch?.[1])).toBe(ABSOLUTE_MIN_FLOW_TEMP);
    expect(Number(maxMatch?.[1])).toBe(ABSOLUTE_MAX_FLOW_TEMP);
  });

  it("I5 validateFlowTempInput: 46/55 ok, van granica i prazno ne", () => {
    expect(validateFlowTempInput(46)).toEqual({ ok: true, value: 46 });
    expect(validateFlowTempInput(48)).toEqual({ ok: true, value: 48 });
    expect(validateFlowTempInput(55)).toEqual({ ok: true, value: 55 });
    expect(validateFlowTempInput(51.26)).toEqual({ ok: true, value: 51.3 });
    expect(validateFlowTempInput(47.9)).toEqual({ ok: true, value: 47.9 });
    expect(validateFlowTempInput(45.9)).toEqual({
      ok: false,
      reason: "outOfRange",
    });
    expect(validateFlowTempInput(55.1)).toEqual({
      ok: false,
      reason: "outOfRange",
    });
    expect(validateFlowTempInput(null)).toEqual({
      ok: false,
      reason: "required",
    });
    expect(validateFlowTempInput(undefined)).toEqual({
      ok: false,
      reason: "required",
    });
  });
});

/**
 * `F13`: raspon je po domu. Test čuva tri stvari koje se ne vide iz UI-a:
 * (1) odgovor servera se prihvata kad je ispravan, (2) neispravan se odbija u
 * cjelini umjesto djelimično, (3) 46 °C je dozvoljeno kad dom tako kaže — to je
 * konkretan slučaj zbog kojeg je granica i mijenjana.
 */
describe("F13: raspon polazne po domu", () => {
  it("prihvata raspon doma koji je niži od 48", () => {
    const range = resolveFlowRange({ min: 46, max: 55, source: "HOME" });
    expect(range).toEqual({ min: 46, max: 55, source: "HOME" });
    expect(validateFlowTempInput(46, range)).toEqual({ ok: true, value: 46 });
    expect(validateFlowTempInput(45.9, range)).toEqual({
      ok: false,
      reason: "outOfRange",
    });
  });

  it.each([
    [{ min: 55, max: 46 }, DEFAULT_FLOW_RANGE],
    [{ min: 20, max: 55 }, DEFAULT_FLOW_RANGE],
    [{ min: 46, max: 60 }, DEFAULT_FLOW_RANGE],
    [{ min: "46", max: 55 }, DEFAULT_FLOW_RANGE],
    [null, DEFAULT_FLOW_RANGE],
  ])("neispravan odgovor %j pada na rezervni raspon", (raw, expected) => {
    expect(resolveFlowRange(raw)).toEqual(expected);
  });

  it("poruka o rasponu koristi granice doma, ne tvrde 48/55", () => {
    const message = flowTempRangeMessage({ min: 46, max: 52, source: "HOME" });
    expect(message).toContain("46");
    expect(message).toContain("52");
    expect(message).not.toContain("48");
  });
});

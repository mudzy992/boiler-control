import { describe, expect, it } from "vitest";
import {
  METRICS_COVERAGE_THRESHOLD_PERCENT,
  evaluateMetricsGate,
  fieldsWithData,
} from "../metrics-gate";

/**
 * C1 — kapija za ekran nad mjernim kolonama.
 *
 * Plan traži: kartica **tek** kad pokrivenost pređe 25 %. Trenutno je 5,8 %
 * (5/86), pa bi bez kapije ekran bio prazan na 81 od 86 dana — i to izgleda kao
 * kvar, ne kao nedostatak podatka.
 *
 * Ove tvrdnje su granica, ne utisak: 24,9 % je sakriveno, 25 % je vidljivo.
 */

const coverage = (
  days: number,
  best: number,
  byField: Record<string, number> = {},
) => ({
  days,
  bestFieldShare: best,
  byField,
});

describe("C1 — kapija pokrivenosti", () => {
  it("trenutno stanje (5,8 %) je SAKRIVENO", () => {
    const gate = evaluateMetricsGate(coverage(86, 5.8, { dutyPercent: 5 }));
    expect(gate.visible).toBe(false);
    // Sužavanje tipa je dio tvrdnje: `reason` postoji SAMO kad je sakriveno.
    if (gate.visible) throw new Error("kapija je propustila 5,8 %");
    expect(gate.reason).toBe("low-coverage");
    expect(gate.percent).toBe(5.8);
  });

  it("granica je tačna: 24,9 skriveno, 25 vidljivo", () => {
    expect(evaluateMetricsGate(coverage(100, 24.9)).visible).toBe(false);
    expect(evaluateMetricsGate(coverage(100, 25)).visible).toBe(true);
    expect(METRICS_COVERAGE_THRESHOLD_PERCENT).toBe(25);
  });

  it("nula dana je no-data, a ne 0 %", () => {
    expect(evaluateMetricsGate(coverage(0, 0))).toEqual({
      visible: false,
      reason: "no-data",
      percent: 0,
    });
    const none = evaluateMetricsGate(null);
    if (none.visible) throw new Error("kapija je propustila prazan odgovor");
    expect(none.reason).toBe("no-data");
  });

  it("ako server ne pošalje bestFieldShare, izvodi se iz byField", () => {
    // Starija verzija servera / djelimičan odgovor: polje nedostaje.
    const gate = evaluateMetricsGate({
      days: 4,
      byField: { dutyPercent: 3, overshootC: 1 },
    } as never);
    expect(gate.percent).toBe(75);
    expect(gate.visible).toBe(true);
  });

  it("NaN iz servera ne prolazi kapiju", () => {
    const gate = evaluateMetricsGate({
      days: 10,
      bestFieldShare: Number.NaN,
      byField: { dutyPercent: 1 },
    });
    expect(gate.percent).toBe(10);
    expect(gate.visible).toBe(false);
  });

  it("prikazuje samo kolone koje imaju mjerenja, najbolja prva", () => {
    const fields = fieldsWithData(
      coverage(10, 60, {
        dutyPercent: 6,
        overshootC: 0,
        hysteresisK: 2,
        heatRateCPerHour: 0,
      }),
    );

    // Kolone sa 0 dana se NE prikazuju: prazna kolona tvrdi da je mjerenje
    // postojalo i da je bilo prazno.
    expect(fields.map((f) => f.field)).toEqual(["dutyPercent", "hysteresisK"]);
    expect(fields[0].share).toBe(60);
    expect(fields[1].share).toBe(20);
  });

  it("nema dana → nema kolona", () => {
    expect(fieldsWithData(null)).toEqual([]);
    expect(fieldsWithData(coverage(0, 0, { dutyPercent: 0 }))).toEqual([]);
  });
});

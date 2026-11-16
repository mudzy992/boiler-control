import { describe, expect, it } from "vitest";
import { previousRange, rangeForPeriod, toLocalDate } from "../heating-period";

/**
 * D1 — račun raspona za birač perioda.
 *
 * Test fiksira **granice**, ne utisak: prethodni period mora imati istu dužinu
 * u danima i završiti se dan prije tekućeg. Mobilni `getPreviousDateRange`
 * računa u milisekundama od `new Date()`, pa mu sedmica klizi po dobu dana —
 * web to ne smije ponoviti.
 */

const day = (iso: string): Date => new Date(`${iso}T12:00:00`);

describe("D1 — period grijanja", () => {
  it("dan je jedan dan, bucket po satu", () => {
    expect(rangeForPeriod("day", day("2026-11-07"))).toEqual({
      from: "2026-11-07",
      to: "2026-11-07",
      bucket: "hour",
    });
  });

  it("sedmica je 7 dana uključivo sa danas", () => {
    expect(rangeForPeriod("week", day("2026-11-07"))).toEqual({
      from: "2026-11-01",
      to: "2026-11-07",
      bucket: "day",
    });
  });

  it("mjesec je 30 dana", () => {
    const range = rangeForPeriod("month", day("2026-11-07"));
    expect(range.from).toBe("2026-10-09");
    expect(range.to).toBe("2026-11-07");
  });

  it("godina je 365 dana", () => {
    const range = rangeForPeriod("year", day("2026-11-07"));
    expect(range.from).toBe("2025-11-08");
  });

  it("prethodna sedmica ima istu dužinu i završava dan prije", () => {
    const current = rangeForPeriod("week", day("2026-11-07"));
    expect(previousRange(current)).toEqual({
      from: "2026-10-25",
      to: "2026-10-31",
      bucket: "day",
    });
  });

  it("prethodni period preko granice mjeseca/godine", () => {
    const current = rangeForPeriod("week", day("2026-01-03"));
    expect(current.from).toBe("2025-12-28");
    expect(previousRange(current)).toEqual({
      from: "2025-12-21",
      to: "2025-12-27",
      bucket: "day",
    });
  });

  it("prethodni dan je juče, isti bucket", () => {
    const current = rangeForPeriod("day", day("2026-03-01"));
    expect(previousRange(current)).toEqual({
      from: "2026-02-28",
      to: "2026-02-28",
      bucket: "hour",
    });
  });

  it("lokalni datum ne sklizne dan ranije zbog UTC", () => {
    /*
     * `toISOString()` na ponoć lokalnog vremena u zoni istočno od UTC daje
     * **prethodni** dan. Zato `toLocalDate` čita lokalne komponente.
     */
    expect(toLocalDate(new Date(2026, 10, 7))).toBe("2026-11-07");
    expect(toLocalDate(new Date(2026, 0, 1))).toBe("2026-01-01");
  });
});

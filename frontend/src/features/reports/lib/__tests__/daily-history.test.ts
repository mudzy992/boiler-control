import { describe, expect, it } from "vitest";
import {
  coveredGroups,
  historyHeadline,
  isHistoryEmpty,
  missingGroups,
  originLabelKey,
  sortNewestFirst,
  valueOrNull,
} from "../daily-history";
import type { DailyHistoryResponse, DailyHistoryRow } from "../../types";

/**
 * Prikaz historije dnevnih zapisa (`31`).
 *
 * Testira se jedna stvar: da se **rekonstruisan dan ne može pročitati kao
 * izmjeren**. Backfill je upisao 301 dan koji su izvedeni iz starih događaja;
 * ako ekran izgubi porijeklo ili pokaže `0` umjesto „—", korisnik čita
 * rekonstrukciju kao mjerenje i to je greška koju nijedan tip ne hvata.
 */

function row(overrides: Partial<DailyHistoryRow> = {}): DailyHistoryRow {
  return {
    localDate: "2026-03-10",
    proposedFlowTemp: null,
    proposedAt: null,
    cycles: null,
    cyclesSource: "NONE",
    medianCycleMin: null,
    dutyPercent: null,
    overshootC: null,
    undershootC: null,
    flowSetC: null,
    flowSetSource: null,
    gasM3: null,
    degreeDays: null,
    nightUndershootC: null,
    hysteresisK: null,
    heatRateCPerHour: null,
    shadowFlowC: null,
    shadowAction: null,
    modelVersion: null,
    outcomeVersion: null,
    outcomeAt: null,
    origin: "LIVE",
    has: {
      cycles: false,
      gas: false,
      degreeDays: false,
      night: false,
      hysteresis: false,
      heatRate: false,
      shadow: false,
    },
    ...overrides,
  };
}

function report(rows: DailyHistoryRow[]): DailyHistoryResponse {
  return {
    homeProfileId: 1,
    rows,
    summary: {
      days: rows.length,
      live: rows.filter((entry) => entry.origin === "LIVE").length,
      backfill: rows.filter((entry) => entry.origin === "BACKFILL").length,
      withCycles: rows.filter((entry) => entry.has.cycles).length,
      withGas: rows.filter((entry) => entry.has.gas).length,
      withDegreeDays: rows.filter((entry) => entry.has.degreeDays).length,
      withShadow: rows.filter((entry) => entry.has.shadow).length,
      firstDate: rows[0]?.localDate ?? null,
      lastDate: rows[rows.length - 1]?.localDate ?? null,
    },
    truncated: false,
  };
}

describe("originLabelKey", () => {
  it("rekonstruisan red ima svoju etiketu, ne istu kao izmjeren", () => {
    expect(originLabelKey("BACKFILL")).toBe("reports.historyOriginBackfill");
    expect(originLabelKey("LIVE")).toBe("reports.historyOriginLive");
    expect(originLabelKey("BACKFILL")).not.toBe(originLabelKey("LIVE"));
  });
});

describe("coveredGroups / missingGroups", () => {
  it("vraća grupe u stalnom redu, da tabela ne skače po redu", () => {
    const entry = row({
      has: {
        cycles: true,
        gas: true,
        degreeDays: false,
        night: false,
        hysteresis: false,
        heatRate: false,
        shadow: true,
      },
    });
    expect(coveredGroups(entry)).toEqual(["cycles", "gas", "shadow"]);
    expect(missingGroups(entry)).toEqual([
      "degreeDays",
      "night",
      "hysteresis",
      "heatRate",
    ]);
  });

  it("pokrivenost i nedostatak se dopunjuju do svih grupa", () => {
    const entry = row({
      has: {
        cycles: true,
        gas: false,
        degreeDays: true,
        night: false,
        hysteresis: false,
        heatRate: false,
        shadow: false,
      },
    });
    expect(coveredGroups(entry).length + missingGroups(entry).length).toBe(7);
  });

  it("red bez ijednog mjerenja nema pokrivenih grupa", () => {
    expect(coveredGroups(row())).toEqual([]);
  });
});

describe("isHistoryEmpty", () => {
  it("prazan odgovor je prazan", () => {
    expect(isHistoryEmpty(report([]))).toBe(true);
  });

  it("odsutan odgovor je prazan, ali ga komponenta razlikuje od greške", () => {
    expect(isHistoryEmpty(undefined)).toBe(true);
    expect(isHistoryEmpty(null)).toBe(true);
  });

  it("odgovor sa jednim redom nije prazan", () => {
    expect(isHistoryEmpty(report([row()]))).toBe(false);
  });
});

describe("historyHeadline", () => {
  it("prenosi brojeve i granice perioda iz sažetka", () => {
    const data = report([
      row({ localDate: "2026-01-05" }),
      row({ localDate: "2026-01-06", origin: "BACKFILL" }),
    ]);
    const headline = historyHeadline(data);

    expect(headline.days).toBe(2);
    expect(headline.backfill).toBe(1);
    expect(headline.live).toBe(1);
    expect(headline.firstDate).toBe("2026-01-05");
    expect(headline.lastDate).toBe("2026-01-06");
  });

  it("bez podataka nema izmišljenih datuma", () => {
    const headline = historyHeadline(undefined);
    expect(headline.days).toBe(0);
    expect(headline.firstDate).toBeNull();
    expect(headline.lastDate).toBeNull();
  });

  it("skraćenje se prenosi dalje — prikaz ne tvrdi da je to sve", () => {
    const data = { ...report([row()]), truncated: true };
    expect(historyHeadline(data).truncated).toBe(true);
  });
});

describe("valueOrNull", () => {
  it("null i undefined ostaju null, a ne nula", () => {
    expect(valueOrNull(null)).toBeNull();
    expect(valueOrNull(undefined)).toBeNull();
  });

  it("nula je stvarna vrijednost i ostaje nula", () => {
    // Dan bez ciklusa je izmjereno `0`; pretvaranje u „—" izgubilo bi mjerenje.
    expect(valueOrNull(0)).toBe(0);
  });

  it("NaN i beskonačno ne idu u prikaz", () => {
    expect(valueOrNull(Number.NaN)).toBeNull();
    expect(valueOrNull(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

/**
 * Redoslijed u tabeli (`36`): najnoviji dan prvi.
 *
 * Prije je tabela prikazivala ono što server vrati — uzlazno od 01.01.2026, pa
 * je korisnik na vrhu vidio januar, a današnji dan negdje na dnu. Server i dalje
 * vraća uzlazno (za grafikone), pa obrtanje mora biti eksplicitno i testirano.
 */
describe("sortNewestFirst", () => {
  const row = (localDate: string) =>
    ({
      localDate,
      origin: "LIVE",
      modelVersion: "daily-1",
    }) as unknown as DailyHistoryRow;

  it("najnoviji datum je prvi", () => {
    const rows = [row("2026-11-06"), row("2026-11-08"), row("2026-11-07")];

    expect(sortNewestFirst(rows).map((item) => item.localDate)).toEqual([
      "2026-11-08",
      "2026-11-07",
      "2026-11-06",
    ]);
  });

  it("ne mijenja ulazni niz", () => {
    const rows = [row("2026-11-06"), row("2026-11-08")];
    sortNewestFirst(rows);

    expect(rows.map((item) => item.localDate)).toEqual([
      "2026-11-06",
      "2026-11-08",
    ]);
  });

  it("radi i preko granice mjeseca i godine", () => {
    const rows = [row("2025-12-31"), row("2026-01-01"), row("2026-11-08")];

    expect(sortNewestFirst(rows)[0].localDate).toBe("2026-11-08");
    expect(sortNewestFirst(rows)[2].localDate).toBe("2025-12-31");
  });

  it("prazna historija ostaje prazna", () => {
    expect(sortNewestFirst([])).toEqual([]);
  });
});

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DailyMetricsCard } from "../components/daily-metrics-card";
import { averageOfMeasured } from "../lib/metrics-gate";
import { apiClient } from "../../../services/api";
import "../../../locales/config";

/**
 * C1 — kartica nad dnevnim mjernim kolonama.
 *
 * Tri stvari koje se lako previde, a ovdje su zaključane:
 *  1. **kapija**: 5,8 % (stvarno stanje) → kartice NEMA; 60 % → ima je;
 *  2. **prosjek samo preko mjerenih dana** — izostanak nije nula, pa ne smije
 *     ući u imenilac;
 *  3. **prazna kolona se ne prikazuje**: kolona sa 0 dana tvrdi da je mjerenje
 *     postojalo i bilo prazno.
 */

function renderCard() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <DailyMetricsCard homeProfileId={1} from="2026-10-01" to="2026-11-07" />
    </QueryClientProvider>,
  );
}

const response = (coverage: Record<string, unknown>, rows: unknown[] = []) =>
  ({ homeProfileId: 1, from: null, to: null, rows, coverage }) as never;

describe("C1 — kartica mjernih kolona", () => {
  it("na stvarnoj pokrivenosti (5,8 %) kartice NEMA", async () => {
    vi.spyOn(apiClient, "getDailyMetrics").mockResolvedValue(
      response({
        days: 86,
        withOutcome: 86,
        bestFieldShare: 5.8,
        byField: { dutyPercent: 5, overshootC: 2, hysteresisK: 0 },
      }),
    );

    const { container } = renderCard();

    // Sačekaj da upit razriješi, pa tvrdi da kartice nema.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByText("Boiler behaviour")).toBeNull();
    expect(container.innerHTML).not.toContain("Burner duty");
  });

  it("na 60 % kartica postoji i prikazuje samo kolone sa mjerenjem", async () => {
    vi.spyOn(apiClient, "getDailyMetrics").mockResolvedValue(
      response(
        {
          days: 10,
          withOutcome: 10,
          bestFieldShare: 60,
          byField: { dutyPercent: 6, hysteresisK: 3, nightFlowC: 0 },
        },
        [
          { localDate: "2026-11-01", dutyPercent: 40, hysteresisK: 0.4 },
          { localDate: "2026-11-02", dutyPercent: 60, hysteresisK: 0.6 },
          // Treći dan NEMA mjerenja — ne smije ući u prosjek.
          { localDate: "2026-11-03" },
        ],
      ),
    );

    renderCard();

    expect(await screen.findByText("Boiler behaviour")).toBeTruthy();
    // Prosjek dva mjerena dana: (40+60)/2 = 50, ne (40+60+0)/3 = 33,3.
    expect(await screen.findByText("50")).toBeTruthy();
    expect(screen.queryByText("33")).toBeNull();
    // Kolona sa 0 dana se ne prikazuje.
    expect(screen.queryByText("Night flow temp")).toBeNull();
  });

  it("averageOfMeasured: bez ijednog mjerenja vraća null, nikad 0", () => {
    expect(averageOfMeasured([], "dutyPercent")).toBeNull();
    expect(
      averageOfMeasured([{ localDate: "2026-11-01" }], "dutyPercent"),
    ).toBeNull();
    // Stvarna nula JESTE mjerenje i ulazi u prosjek.
    expect(
      averageOfMeasured(
        [
          { localDate: "2026-11-01", dutyPercent: 0 },
          { localDate: "2026-11-02", dutyPercent: 10 },
        ],
        "dutyPercent",
      ),
    ).toEqual({ value: 5, days: 2 });
  });
});

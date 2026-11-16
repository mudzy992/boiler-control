import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HeatingPage } from "../pages/HeatingPage";
import { apiClient } from "../../../services/api";
import "../../../locales/config";
import { percentChange } from "../lib/heating-period";

/**
 * D1 — web birač perioda za grijanje.
 *
 * Nalaz: web je imao **fiksne** periode (heating-summary samo za jedan dan),
 * mobilni dan/sedmica/mjesec/godina + prethodni period. Ovaj test zaključava
 * tri stvari:
 *
 *  1. birač mijenja **stvarni raspon** koji ide na server (ne samo oznaku);
 *  2. traži se i **prethodni** period — bez njega broj ne znači ništa;
 *  3. `avgIndoorTemp: null` je „—", nikad `0,00 °C`.
 */

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <HeatingPage />
    </QueryClientProvider>,
  );
}

const summary = (cycles: number, indoor: number | null) => ({
  summary: {
    totalCycles: cycles,
    totalDurationMin: cycles * 20,
    avgDurationMin: cycles ? 20 : 0,
    avgIndoorTemp: indoor,
  },
  buckets: [],
});

describe("D1 — birač perioda grijanja", () => {
  it("mijenja raspon poslan serveru i traži prethodni period", async () => {
    vi.spyOn(apiClient, "getHeatingEvents").mockResolvedValue({
      rows: [],
      total: 0,
    } as never);
    const summarySpy = vi
      .spyOn(apiClient, "getDashboardHeatingSummary")
      .mockResolvedValue(summary(10, 21.5) as never);

    renderPage();

    // Početno: sedmica (7 dana → bucket 'day').
    await waitFor(() => expect(summarySpy).toHaveBeenCalled());
    const firstCalls = summarySpy.mock.calls.map(([arg]) => arg);
    expect(firstCalls.every((arg) => arg.bucket === "day")).toBe(true);
    // Dva poziva: tekući + prethodni period.
    expect(firstCalls.length).toBe(2);

    summarySpy.mockClear();
    /*
     * Vezuje se za `id`, ne za tekst: testno okruženje podrazumijeva `en-US`,
     * pa bi tvrdnja na bosanski natpis pala i sa ispravnim kodom.
     */
    await userEvent.click(screen.getByRole("radio", { name: "Today" }));

    // Dan → bucket 'hour', i dalje dva poziva (tekući + juče).
    await waitFor(() => expect(summarySpy).toHaveBeenCalled());
    const dayCalls = summarySpy.mock.calls.map(([arg]) => arg);
    expect(dayCalls.length).toBe(2);
    expect(dayCalls.every((arg) => arg.bucket === "hour")).toBe(true);
  });

  it('null prosječna temperatura je „—", a ne 0,00', async () => {
    vi.spyOn(apiClient, "getHeatingEvents").mockResolvedValue({
      rows: [],
      total: 0,
    } as never);
    vi.spyOn(apiClient, "getDashboardHeatingSummary").mockResolvedValue(
      summary(4, null) as never,
    );

    renderPage();

    // Red „Prosječna sobna temp." ima dvije kolone sa „—" (tekući i prethodni).
    await screen.findByText("Average room temp (°C)");
    expect(screen.queryByText("0.00")).toBeNull();
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2);
  });

  it("procenat promjene: prethodno 0 nije beskonačno", () => {
    expect(percentChange(5, 0)).toBeNull();
    expect(percentChange(5, null)).toBeNull();
    expect(percentChange(null, 5)).toBeNull();
    expect(percentChange(10, 8)).toBeCloseTo(25);
    expect(percentChange(0, 4)).toBeCloseTo(-100);
  });
});

import { describe, expect, it } from 'vitest';
import { processDashboardData } from '../process-dashboard-data';
import type { DashboardResponse } from '../types';

/**
 * „Nema podataka" nije nula (`18` §5).
 *
 * Tri greške koje ovaj test čuva, sve tri su bile u kodu:
 *   - `roomCurrentTemp ?? 0` je nedostatak mjerenja prikazivao kao 0,0 °C;
 *   - `lastUpdate: new Date()` je vrijeme računanja prikazivao kao vrijeme
 *     mjerenja, pa je svježina uvijek izgledala savršena;
 *   - `homes[0]` je prikazivao prvi dom, a ne aktivni.
 */

function response(overrides: Partial<DashboardResponse> = {}): DashboardResponse {
  return {
    capabilities: {},
    system: {
      weather: {},
      boiler: {
        externalTemp: 4,
        suggestedFlowTemp: 44,
        actualFlowTemp: null,
      },
      recommendation: {
        recommendedFlowTemp: 44,
        expectedHeatTimeMin: 45,
        confidenceScore: 0.6,
      },
    },
    homes: [
      {
        profile: { id: 1, floorArea: 100 },
        thermostats: [
          {
            alias: 'dnevna',
            roomCurrentTemp: 21.5,
            roomTargetTemp: 22,
            mode: 'AUTO',
            lastSeen: '2026-11-18T08:00:00.000Z',
            program: [],
          },
        ],
        recentHeatingEvents: [],
      },
    ],
    ...overrides,
  };
}

describe('processDashboardData — istinitost podataka', () => {
  it('temperatura koja ne postoji je null, a ne 0', () => {
    const data = processDashboardData(
      response({
        homes: [
          {
            profile: { id: 1, floorArea: 100 },
            thermostats: [],
            recentHeatingEvents: [],
          },
        ],
      }),
    );

    expect(data.roomCurrentTemp).toBeNull();
    expect(data.roomTargetTemp).toBeNull();
    // Bitno: null nije 0 — `toBe(0)` bi prošlo da je zamjena ostala.
    expect(data.roomCurrentTemp).not.toBe(0);
  });

  it('stvarna 0 °C ostaje 0 — ne pretvara se u „nema podataka"', () => {
    const data = processDashboardData(
      response({
        homes: [
          {
            profile: { id: 1, floorArea: 100 },
            thermostats: [
              {
                alias: 'dnevna',
                roomCurrentTemp: 0,
                roomTargetTemp: 0,
                mode: 'AUTO',
                lastSeen: '2026-11-18T08:00:00.000Z',
                program: [],
              },
            ],
            recentHeatingEvents: [],
          },
        ],
      }),
    );

    expect(data.roomCurrentTemp).toBe(0);
    expect(data.roomTargetTemp).toBe(0);
  });

  it('svježina je zadnje javljanje termostata, a ne vrijeme računanja', () => {
    const data = processDashboardData(response());
    expect(data.lastSeen).toBe('2026-11-18T08:00:00.000Z');

    // Test mora pasti i ako se vrati „sada": dva poziva u različito vrijeme
    // ne smiju dati različit `lastSeen`.
    const again = processDashboardData(response());
    expect(again.lastSeen).toBe(data.lastSeen);
  });

  it('bez `lastSeen` svježina je null, ne izmišljen datum', () => {
    const data = processDashboardData(
      response({
        homes: [
          {
            profile: { id: 1, floorArea: 100 },
            thermostats: [
              {
                alias: 'dnevna',
                roomCurrentTemp: 20,
                roomTargetTemp: 21,
                mode: 'AUTO',
                program: [],
              },
            ],
            recentHeatingEvents: [],
          },
        ],
      }),
    );

    expect(data.lastSeen).toBeNull();
  });

  it('uzima aktivni dom, a ne prvi u nizu', () => {
    const twoHomes = response({
      homes: [
        {
          profile: { id: 1, floorArea: 100 },
          thermostats: [
            {
              alias: 'prvi dom',
              roomCurrentTemp: 18,
              roomTargetTemp: 19,
              mode: 'AUTO',
              lastSeen: '2026-11-18T06:00:00.000Z',
              program: [],
            },
          ],
          recentHeatingEvents: [],
        },
        {
          profile: { id: 2, floorArea: 220 },
          thermostats: [
            {
              alias: 'drugi dom',
              roomCurrentTemp: 23,
              roomTargetTemp: 24,
              mode: 'AUTO',
              lastSeen: '2026-11-18T09:00:00.000Z',
              program: [],
            },
          ],
          recentHeatingEvents: [],
        },
      ],
    });

    const data = processDashboardData(twoHomes, 2);
    expect(data.roomCurrentTemp).toBe(23);
    expect(data.lastSeen).toBe('2026-11-18T09:00:00.000Z');

    // Nepoznat/odsutan aktivni profil: ostaje prvi, ali se to vidi po broju.
    expect(processDashboardData(twoHomes)?.roomCurrentTemp).toBe(18);
  });

  it('stopa anomalija se računa iz stvarnih događaja', () => {
    const event = {
      id: 1,
      startedAt: '2026-11-17T05:00:00.000Z',
      endedAt: '2026-11-17T06:00:00.000Z',
      roomTargetTemp: 21,
      roomCurrentTemp: 19,
      durationMinutes: 60,
      isAnomaly: true,
    };
    const data = processDashboardData(
      response({
        homes: [
          {
            profile: { id: 1, floorArea: 100 },
            thermostats: [
              {
                alias: 'dnevna',
                roomCurrentTemp: 21,
                roomTargetTemp: 21,
                mode: 'AUTO',
                lastSeen: '2026-11-18T08:00:00.000Z',
                program: [],
              },
            ],
            recentHeatingEvents: [event, { ...event, id: 2, isAnomaly: false }],
          },
        ],
      }),
    );

    expect(data.anomalyCount).toBe(1);
    expect(data.anomalyRate).toBe(50);
  });
});

import {
  SHORT_CYCLE_FLOOR_TTL_DAYS,
  effectiveShortCycleFloor,
} from '../short-cycle-floor';

/**
 * Zaborav granice iz kratkih ciklusa (`24` §7). Rizik je obostran: prerano
 * zaboravljanje vraća polaznu na vrijednost za koju znamo da pravi cikluse,
 * prekasno drži kuću na previsokoj. Zato se testiraju obje strane, uključujući
 * granicu tačno na 30 dana i zapise bez datuma.
 */

const NOW = new Date('2026-11-15T06:00:00Z');

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);
}

describe('effectiveShortCycleFloor', () => {
  it('svježa granica se koristi, sa starošću u danima', () => {
    const result = effectiveShortCycleFloor(
      { floorC: 50, at: daysAgo(3) },
      NOW,
    );
    expect(result.floorC).toBe(50);
    expect(result.age).toBe('FRESH');
    expect(result.ageDays).toBeCloseTo(3, 6);
  });

  it('granica na samoj granici roka (30 dana) ističe', () => {
    const result = effectiveShortCycleFloor(
      { floorC: 50, at: daysAgo(SHORT_CYCLE_FLOOR_TTL_DAYS) },
      NOW,
    );
    expect(result).toMatchObject({
      floorC: null,
      age: 'EXPIRED',
      ageDays: SHORT_CYCLE_FLOOR_TTL_DAYS,
    });
  });

  it('dan prije roka se još koristi', () => {
    const result = effectiveShortCycleFloor(
      { floorC: 50, at: daysAgo(SHORT_CYCLE_FLOOR_TTL_DAYS - 1) },
      NOW,
    );
    expect(result.floorC).toBe(50);
    expect(result.age).toBe('FRESH');
  });

  it('bez granice nema ni starosti ni brisanja', () => {
    expect(effectiveShortCycleFloor({ floorC: null, at: null }, NOW)).toEqual({
      floorC: null,
      age: 'NONE',
      ageDays: null,
    });
    expect(effectiveShortCycleFloor(null, NOW).age).toBe('NONE');
  });

  it('granica bez datuma ostaje — nedostatak datuma nije dokaz da je istekla', () => {
    // Stariji zapisi nemaju `shortCycleFloorAt`. Brisanje bi vratilo polaznu
    // tačno na vrijednost koja je pravila cikluse.
    expect(effectiveShortCycleFloor({ floorC: 50, at: null }, NOW)).toEqual({
      floorC: 50,
      age: 'UNKNOWN',
      ageDays: null,
    });
  });

  it('sat ispred upisa ne čini granicu isteklom', () => {
    const future = new Date(NOW.getTime() + 2 * 24 * 60 * 60 * 1000);
    const result = effectiveShortCycleFloor({ floorC: 50, at: future }, NOW);
    expect(result.floorC).toBe(50);
    expect(result.ageDays).toBe(0);
  });

  it('rok se može skratiti za test, ali podrazumijevani je 30 dana', () => {
    expect(SHORT_CYCLE_FLOOR_TTL_DAYS).toBe(30);
    expect(
      effectiveShortCycleFloor({ floorC: 50, at: daysAgo(5) }, NOW, 4).age,
    ).toBe('EXPIRED');
  });
});

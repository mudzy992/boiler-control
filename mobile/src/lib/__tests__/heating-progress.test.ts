import {
  IDEAL_HEAT_MINUTES,
  heatingProgress,
  heatingZone,
  medianCycleMinutes,
  minutesSince,
} from '../heating-progress';

/**
 * `36`: pragovi trake grijanja. Zelena dok se ciklus drži proračunatog vremena,
 * žuta između procjene i idealnih 120 minuta, crvena preko 120. Greška ovdje se
 * čita kao upozorenje, pa pragovi moraju biti tačni na granici.
 */
describe('heating progress', () => {
  const now = new Date('2026-11-08T12:00:00.000Z').getTime();
  const startedAt = '2026-11-08T11:10:00.000Z'; // prije 50 min

  it('mjeri protekle minute od početka ciklusa', () => {
    expect(minutesSince(startedAt, now)).toBeCloseTo(50, 5);
  });

  it('ne vraća negativno vrijeme ako sat uređaja kasni', () => {
    expect(minutesSince('2026-11-08T12:05:00.000Z', now)).toBe(0);
  });

  it('bez početka nema proteklog vremena', () => {
    expect(minutesSince(null, now)).toBeNull();
  });

  it('ispod procjene je zelena zona', () => {
    expect(heatingZone(30, 45)).toBe('within');
  });

  it('između procjene i 120 minuta je žuta zona', () => {
    expect(heatingZone(70, 45)).toBe('over');
  });

  it('preko idealnih 120 minuta je crvena zona', () => {
    expect(heatingZone(121, 45)).toBe('beyond');
  });

  it('bez procjene zona nije izmišljena', () => {
    expect(heatingZone(70, null)).toBe('unknown');
  });

  it('računa razmjere na skali koja nikad nije manja od idealnog', () => {
    const model = heatingProgress({ startedAt, now, predictedMin: 45 });

    expect(model.elapsedMin).toBeCloseTo(50, 5);
    expect(model.scaleMax).toBe(IDEAL_HEAT_MINUTES);
    expect(model.elapsedRatio).toBeCloseTo(50 / 120, 5);
    expect(model.predictedRatio).toBeCloseTo(45 / 120, 5);
    expect(model.idealRatio).toBe(1);
    expect(model.zone).toBe('over');
  });

  it('produžuje skalu kad ciklus probije 120 minuta', () => {
    const model = heatingProgress({
      startedAt: '2026-11-08T09:30:00.000Z', // 150 min
      now,
      predictedMin: 45,
    });

    expect(model.elapsedMin).toBeCloseTo(150, 5);
    expect(model.scaleMax).toBe(150);
    expect(model.elapsedRatio).toBe(1);
    expect(model.idealRatio).toBeCloseTo(120 / 150, 5);
    expect(model.zone).toBe('beyond');
  });

  it('nula ili negativna procjena se tretira kao „nema procjene"', () => {
    // Backend u zapis ume da upiše `0` kad motor nema podatke (`daily-record.writer`).
    // Nula na traci bi izgledala kao procjena „0 min", što nije tačno.
    expect(heatingProgress({ startedAt, now, predictedMin: 0 }).predictedMin).toBeNull();
    expect(heatingProgress({ startedAt, now, predictedMin: -5 }).predictedRatio).toBeNull();
  });
});

describe('medianCycleMinutes', () => {
  const cycle = (startMin: number, endMin: number) => ({
    startedAt: new Date(2026, 10, 8, 8, startMin).toISOString(),
    endedAt: new Date(2026, 10, 8, 8, endMin).toISOString(),
  });

  it('uzima medijanu završenih ciklusa', () => {
    expect(medianCycleMinutes([cycle(0, 40), cycle(0, 60), cycle(0, 50)])).toBe(50);
  });

  it('kod parnog broja uzima sredinu dvaju srednjih', () => {
    expect(medianCycleMinutes([cycle(0, 40), cycle(0, 50), cycle(0, 60), cycle(0, 70)])).toBe(55);
  });

  it('otvoren ciklus ne ulazi u medijanu', () => {
    const open = { startedAt: cycle(0, 10).startedAt, endedAt: null };
    expect(medianCycleMinutes([open, cycle(0, 40), cycle(0, 60)])).toBe(50);
  });

  it('jedan dug ciklus ne pomjera medijanu kao prosjek', () => {
    const values = [cycle(0, 40), cycle(0, 45), cycle(0, 50), cycle(0, 500)];
    const median = medianCycleMinutes(values) as number;
    expect(median).toBeLessThan(70);
  });

  it('bez završenih ciklusa nema procjene', () => {
    expect(medianCycleMinutes([])).toBeNull();
  });

  it('prihvata i `timestampStart`/`timestampEnd` oblik sa `/heating-events`', () => {
    expect(
      medianCycleMinutes([
        {
          timestampStart: '2026-11-08T08:00:00.000Z',
          timestampEnd: '2026-11-08T08:30:00.000Z',
        },
      ]),
    ).toBe(30);
  });
});

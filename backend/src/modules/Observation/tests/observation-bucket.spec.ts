import {
  OBSERVATION_INTERVAL_MIN,
  observationBucketIndex,
  observationBucketStart,
  observationsPerDay,
} from '../observation-bucket';

describe('petominutni bucket', () => {
  it('poravnava na početak bucketa, ne na trenutak upisa', () => {
    expect(
      observationBucketStart(new Date('2026-11-09T06:03:47.512Z')).toISOString(),
    ).toBe('2026-11-09T06:00:00.000Z');
    expect(
      observationBucketStart(new Date('2026-11-09T06:05:00.000Z')).toISOString(),
    ).toBe('2026-11-09T06:05:00.000Z');
    // 07:09:59 je još bucket 07:05.
    expect(
      observationBucketStart(new Date('2026-11-09T07:09:59.999Z')).toISOString(),
    ).toBe('2026-11-09T07:05:00.000Z');
  });

  it('pet uzastopnih minuta daje isti bucket, šesti daje novi', () => {
    const base = Date.UTC(2026, 10, 9, 6, 0, 0);
    const first = observationBucketIndex(new Date(base));
    for (let minute = 1; minute < 5; minute++) {
      expect(
        observationBucketIndex(new Date(base + minute * 60_000)),
      ).toBe(first);
    }
    expect(observationBucketIndex(new Date(base + 5 * 60_000))).toBe(first + 1);
  });

  it('bucket ne zavisi od vremenske zone', () => {
    const instant = new Date('2026-11-09T06:02:00Z');
    // Isti trenutak, ista vrijednost — bucket je apsolutno vrijeme.
    expect(observationBucketStart(instant).getTime()).toBe(
      Date.UTC(2026, 10, 9, 6, 0, 0),
    );
  });

  it('288 redova dnevno po uređaju — dokumentovana granica', () => {
    expect(OBSERVATION_INTERVAL_MIN).toBe(5);
    expect(observationsPerDay()).toBe(288);
    expect(observationsPerDay(15)).toBe(96);
  });

  it('interval koji ne dijeli dan ravnomjerno ne mijenja formulu', () => {
    // 7 min nije dijeljiv, ali funkcija ne pretpostavlja djeljivost.
    expect(observationsPerDay(7)).toBeCloseTo(205.714, 2);
  });
});

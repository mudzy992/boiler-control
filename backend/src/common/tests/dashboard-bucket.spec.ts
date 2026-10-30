import {
  bucketKey,
  isBucketV2Enabled,
  legacyHourKey,
  localDayKey,
  utcDayKey,
  v2HourKey,
} from '../dashboard-bucket';

const FLAG = 'DASHBOARD_BUCKET_V2_ENABLED';

describe('isBucketV2Enabled', () => {
  const original = process.env[FLAG];
  afterEach(() => {
    if (original === undefined) delete process.env[FLAG];
    else process.env[FLAG] = original;
  });

  it('zadano je ISKLJUČENO (ne mijenja isporučeni ugovor)', () => {
    delete process.env[FLAG];
    expect(isBucketV2Enabled()).toBe(false);
  });

  it.each([
    ['on', true],
    ['ON', true],
    [' on ', true],
    ['off', false],
    ['OFF', false],
    // Nije `Boolean(raw)`: ove vrijednosti su truthy stringovi.
    ['false', false],
    ['0', false],
    ['1', false],
    ['možda', false],
    ['', false],
  ])('%p → %p', (raw, expected) => {
    process.env[FLAG] = raw;
    expect(isBucketV2Enabled()).toBe(expected);
  });
});

describe('ključevi bucket-a', () => {
  const jan = new Date('2026-01-02T10:00:00Z');

  it('v1 hour je HH:00 bez datuma', () => {
    expect(legacyHourKey(new Date('2026-01-02T10:00:00Z'))).toMatch(
      /^\d{2}:00$/,
    );
  });

  it('v1 day: summary je server-local, stats je UTC', () => {
    // Ova dva se razilaze oko ponoći — to je B-020.
    expect(utcDayKey(jan)).toBe('2026-01-02');
    expect(localDayKey(jan)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('v2 hour nosi datum i razlikuje se od v1', () => {
    expect(v2HourKey(jan)).toBe('2026-01-02T10:00Z');
  });

  describe('bucketKey', () => {
    const original = process.env[FLAG];
    beforeEach(() => delete process.env[FLAG]);
    afterEach(() => {
      if (original === undefined) delete process.env[FLAG];
      else process.env[FLAG] = original;
    });

    it('v1: day ovisi o endpointu (summary local, stats utc)', () => {
      const d = new Date('2026-01-01T23:30:00Z');
      expect(bucketKey(d, 'day', 'utc')).toBe('2026-01-01');
      // U zoni istočno od UTC-a ovo je već 2. januar.
      expect(bucketKey(d, 'day', 'server-local')).toBe(localDayKey(d));
    });

    it('v2: day je UTC na OBA endpointa (razlika nestaje)', () => {
      process.env[FLAG] = 'on';
      const d = new Date('2026-01-01T23:30:00Z');
      expect(bucketKey(d, 'day', 'utc')).toBe('2026-01-01');
      expect(bucketKey(d, 'day', 'server-local')).toBe('2026-01-01');
    });
  });
});

/**
 * ZADNJA NEDJELJA OKTOBRA 2026 = 25.10. Sat 02:30 se u Europe/Sarajevo dešava
 * DVA puta: 00:30Z je 02:30 CEST (UTC+2), a 01:30Z je 02:30 CET (UTC+1).
 *
 * NAMJERNO SE NE KORISTI `process.env.TZ`. Izmjereno: runtime dodjela TZ radi u
 * čistom Node (`getTimezoneOffset()` → -120), ali je jest IGNORIŠE (offset
 * ostaje 0), pa bi takav test tiho postao besmislen. Zona se zato postavlja
 * eksplicitno kroz `Intl`, što je deterministički u svakom okruženju.
 */
const ZONE = 'Europe/Sarajevo';

function localTimeIn(d: Date, timeZone = ZONE): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const hour = get('hour') === '24' ? '00' : get('hour');
  return `${hour}:${get('minute')}`;
}

describe('DST: ponovljeni sat (Europe/Sarajevo, 2026-10-25)', () => {
  const first = new Date('2026-10-25T00:30:00Z');
  const second = new Date('2026-10-25T01:30:00Z');
  const original = process.env[FLAG];
  afterEach(() => {
    if (original === undefined) delete process.env[FLAG];
    else process.env[FLAG] = original;
  });

  it('oba trenutka su lokalno 02:30, a razmak im je tačno 1 sat', () => {
    expect(localTimeIn(first)).toBe('02:30');
    expect(localTimeIn(second)).toBe('02:30');
    expect(second.getTime() - first.getTime()).toBe(3600 * 1000);
    // Kontrola: u UTC-u se razlikuju, dakle `Intl` zaista radi.
    expect(localTimeIn(first, 'UTC')).toBe('00:30');
    expect(localTimeIn(second, 'UTC')).toBe('01:30');
  });

  it('v1 ključ ne sadrži ni datum ni offset, pa takve trenutke NE MOŽE razlikovati', () => {
    expect(legacyHourKey(first)).toMatch(/^\d{2}:00$/);
    expect(legacyHourKey(second)).toMatch(/^\d{2}:00$/);
  });

  it('isti sat različitih dana daje IDENTIČAN v1 ključ (neovisno o zoni)', () => {
    // Januar nema DST prelaz, pa je ovo tačno u svakoj zoni.
    const a = new Date('2026-01-01T10:00:00Z');
    const b = new Date('2026-01-02T10:00:00Z');
    expect(legacyHourKey(a)).toBe(legacyHourKey(b));
  });

  it('v2 ključ RAZDVAJA ponovljeni sat', () => {
    process.env[FLAG] = 'on';
    expect(v2HourKey(first)).toBe('2026-10-25T00:00Z');
    expect(v2HourKey(second)).toBe('2026-10-25T01:00Z');
    expect(bucketKey(first, 'hour', 'utc')).not.toBe(
      bucketKey(second, 'hour', 'utc'),
    );
  });
});

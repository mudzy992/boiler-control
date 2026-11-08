import i18n from '../../locales/config';
import {
  formatDate,
  formatDateRange,
  formatInteger,
  formatNumber,
  formatShortDate,
  formatTime,
} from '../format';

/**
 * F6 (GAS-02): formatiranje po jeziku, ne po hardkodiranom `toFixed`/`en-US`.
 * Test pokriva oba jezika jer je greška bila upravo u tome što se format nije
 * mijenjao sa jezikom.
 */

const changeTo = async (lng: 'en-US' | 'bs-BS') => {
  await i18n.changeLanguage(lng);
};

describe('formatNumber', () => {
  it('koristi bosanski format (zarez decimalno, tačka za hiljade)', async () => {
    await changeTo('bs-BS');
    expect(formatNumber(12345.6)).toBe('12.345,60');
    expect(formatNumber(1234.567, 3)).toBe('1.234,567');
  });

  it('koristi engleski format (tačka decimalno, zarez za hiljade)', async () => {
    await changeTo('en-US');
    expect(formatNumber(12345.6)).toBe('12,345.60');
  });

  it('vraća crticu za nevalidan broj, nikad NaN', () => {
    expect(formatNumber(Number.NaN)).toBe('—');
    expect(formatNumber(Number.POSITIVE_INFINITY)).toBe('—');
  });

  it('formatInteger nema decimale', async () => {
    await changeTo('bs-BS');
    expect(formatInteger(1234.7)).toBe('1.235');
    await changeTo('en-US');
  });
});

describe('datumi', () => {
  const iso = '2026-03-09T18:05:00.000Z';

  it('formatDate prati jezik, nikad nije hardkodiran en-US', async () => {
    await changeTo('bs-BS');
    const bs = formatDate(iso);
    expect(bs).toMatch(/\d{2}\.? ?\d{1,2}\.? ?\d{4}\.?/);
    await changeTo('en-US');
    expect(formatDate(iso)).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
  });

  it('formati su različiti između jezika', async () => {
    await changeTo('bs-BS');
    const bs = formatDate(iso);
    await changeTo('en-US');
    const en = formatDate(iso);
    expect(bs).not.toBe(en);
  });

  it('formatShortDate i formatTime ne vraćaju prazno', async () => {
    await changeTo('bs-BS');
    expect(formatShortDate(iso)).toMatch(/\d{1,2}\.\s?\d{1,2}\./);
    expect(formatTime(iso)).toMatch(/\d{2}:\d{2}/);
    await changeTo('en-US');
  });

  it('nevalidan datum daje crticu, ne "Invalid Date"', () => {
    expect(formatDate('nije-datum')).toBe('—');
    expect(formatDate(null)).toBe('—');
    expect(formatTime(undefined)).toBe('—');
  });

  it('formatDateRange koristi en-dash i oba kraja', async () => {
    await changeTo('bs-BS');
    const range = formatDateRange('2026-01-01', '2026-02-01');
    expect(range).toContain('–');
    expect(range.split('–')).toHaveLength(2);
    await changeTo('en-US');
  });
});

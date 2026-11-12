import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describeFlowClamp } from '../clamp-log';

/**
 * F5.5 — svaki klamp se imenuje u logu.
 *
 * Ključna tvrdnja nije „log postoji" nego da **tri različita razloga ne izgledaju
 * isto**. Prije ovoga sva tri su u `params.clamp` bila jedan broj, pa se iz
 * zapisa nije moglo reći je li motor tražio nemoguće ili korisnik tako želi.
 */
describe('F5.5 describeFlowClamp', () => {
  const base = { systemMinC: 30, systemMaxC: 55 };

  it('fizička granica kotla se imenuje kao sistemska', () => {
    const report = describeFlowClamp({ ...base, rawC: 58, clampedC: 55 });
    expect(report.applied).toBe(true);
    expect(report.bound).toBe('SYSTEM_MAX');
    expect(report.cutK).toBeCloseTo(3, 3);
    expect(report.message).toContain('SYSTEM_MAX');
    expect(report.message).toContain('fizička gornja granica kotla');
  });

  it('granica doma se NE prijavljuje kao kvar motora', () => {
    // Dom je postavio 52; motor je tražio 54. To nije greška, to je podešavanje.
    const report = describeFlowClamp({
      ...base,
      rawC: 54,
      clampedC: 52,
      homeMaxC: 52,
    });
    expect(report.bound).toBe('HOME_MAX');
    expect(report.message).toContain('postavio dom');
  });

  it('dom iznad fizičke granice se svodi na sistemsku', () => {
    // Dom je upisao 60 (neispravno); stvarna granica je 55.
    const report = describeFlowClamp({
      ...base,
      rawC: 62,
      clampedC: 55,
      homeMaxC: 60,
    });
    expect(report.bound).toBe('SYSTEM_MAX');
  });

  it('donja granica doma se razlikuje od fizičke', () => {
    const homeMin = describeFlowClamp({
      ...base,
      rawC: 44,
      clampedC: 48,
      homeMinC: 48,
    });
    expect(homeMin.bound).toBe('HOME_MIN');

    const systemMin = describeFlowClamp({ ...base, rawC: 26, clampedC: 30 });
    expect(systemMin.bound).toBe('SYSTEM_MIN');
  });

  it('zaokruživanje nije klamp i ne puni log', () => {
    const report = describeFlowClamp({ ...base, rawC: 50.0001, clampedC: 50 });
    expect(report.applied).toBe(false);
    expect(report.bound).toBe('NONE');
    expect(report.message).toContain('nije odsječena');
  });

  it('odsječeno je uvijek nenegativno i tačno', () => {
    const report = describeFlowClamp({ ...base, rawC: 30.5, clampedC: 30 });
    expect(report.cutK).toBeCloseTo(0.5, 3);
    expect(report.cutK).toBeGreaterThanOrEqual(0);
  });

  describe('zapis i log ne mogu reći različito', () => {
    const writer = readFileSync(
      join(__dirname, '../daily-record.writer.ts'),
      'utf8',
    );

    it('`params.clamp` koristi isti izvještaj, ne svoj proračun', () => {
      // Da pisac ima svoj `proposedFlowTemp !== result.finalTemp`, prag bi se
      // razišao od onog u logu (0,001 K) i zapis bi tvrdio klamp kojeg log
      // nema — ili obrnuto.
      expect(writer).toContain('applied: clampReport.applied');
      expect(writer).toContain('bound: clampReport.bound');
      expect(writer).toContain('cutK: clampReport.cutK');
    });

    it('klamp se loguje, i to sa imenom granice i granicama doma', () => {
      expect(writer).toContain('clampReport.message');
      expect(writer).toContain('minHeatingFlowC');
      expect(writer).toContain('maxHeatingFlowC');
    });
  });
});

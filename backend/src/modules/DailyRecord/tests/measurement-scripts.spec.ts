import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * F3.4 i F3.5 — skripte za mjerenje, provjerene na onome što im je zajedničko.
 *
 * Statistiku i klasifikaciju već pokriva `--self-test` u svakoj skripti (i on
 * ide u CI **prije** konekcije). Ovdje se provjerava ono što `--self-test` ne
 * može: da skripte **poštuju pravilo samo-čitanja**. Skripta koja mjeri a
 * usput piše bila bi gora od nijedne — broj bi bio tačan, ali bi ga bilo
 * nemoguće ponoviti.
 *
 * Zašto čitanjem teksta a ne izvršavanjem: `.cjs` skripte traže bazu i
 * `ts-node`; predmet je sastav (koji SQL ide na server), ne rezultat. Isti
 * pristup kao `shadow-report-script.spec.ts`.
 */
describe('F3.4 / F3.5 read-only mjerenja', () => {
  const scripts = join(__dirname, '../../../../scripts');
  const cases = [
    { name: 'F3.4 greška prognoze', file: 'forecast-error-readonly.cjs' },
    { name: 'F3.5 saturacija', file: 'saturation-readonly.cjs' },
  ];

  for (const { name, file } of cases) {
    describe(name, () => {
      const source = readFileSync(join(scripts, file), 'utf8');

      it('je samo čitanje — nema INSERT/UPDATE/DELETE/DDL', () => {
        const sql = source.toUpperCase();
        for (const forbidden of [
          'INSERT INTO',
          'UPDATE "',
          'DELETE FROM',
          'ALTER TABLE',
          'DROP TABLE',
          'TRUNCATE',
          'CREATE TABLE',
        ]) {
          expect(sql).not.toContain(forbidden);
        }
      });

      it('otvara transakciju i postavlja je na READ ONLY', () => {
        // `SET TRANSACTION` mora biti **unutar** `BEGIN`; izvan njega
        // PostgreSQL ga odbija, a sesijska varijanta (`SET SESSION ...`) je
        // druga stvar i lako se zamijeni.
        expect(source).toContain("query('BEGIN')");
        expect(source).toContain("query('SET TRANSACTION READ ONLY')");
        const begin = source.indexOf("query('BEGIN')");
        const readOnly = source.indexOf("query('SET TRANSACTION READ ONLY')");
        expect(begin).toBeGreaterThan(-1);
        expect(readOnly).toBeGreaterThan(begin);
      });

      it('traži odvojenu read-only kredencijal, ne glavni URL', () => {
        expect(source).toContain('DATABASE_URL_READONLY');
        // Glavni `DATABASE_URL` ima pravo pisanja; ako se pojavi, skripta je
        // jednim prepisivanjem okruženja postala skripta koja piše.
        expect(source).not.toMatch(/process\.env\.DATABASE_URL\b(?!_READONLY)/);
      });

      it('ima --self-test koji radi bez baze i imenuje prag', () => {
        expect(source).toContain('--self-test');
        expect(source).toContain('runSelfTest');
        expect(source).toContain('Samotest prošao');
      });

      it('objavljuje rezultat kao ::notice (jedini kanal iz CI-ja)', () => {
        expect(source).toContain('::notice::');
      });
    });
  }
});

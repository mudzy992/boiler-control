import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * F3.7 — čitač shadow izvještaja (`scripts/shadow-report-readonly.cjs`).
 *
 * Zašto test za skriptu: skripta je namjerno **tanka** — ne računa ništa sama,
 * nego pušta `shadowReport()` iz `shadow-report.ts`. Ako bi neko u njoj dodao
 * svoje brojanje („da bude brže"), izvještaj iz CI-ja i onaj iz HTTP rute
 * prestali bi da se slažu, a to se ne bi vidjelo ni u jednom testu servisa.
 *
 * Zato se ovdje provjerava upravo to: da skripta uvozi i zove zajedničku
 * funkciju, a ne svoju kopiju pravila.
 *
 * Datoteka je `.cjs` (nije TypeScript), pa se čita kao tekst — nema šta da se
 * izvrši bez baze, a i ne treba: predmet je sastav, ne rezultat.
 */
describe('F3.7 read-only shadow izvještaj', () => {
  const scriptPath = join(
    __dirname,
    '../../../../scripts/shadow-report-readonly.cjs',
  );
  const source = readFileSync(scriptPath, 'utf8');

  it('koristi zajedničku funkciju, ne svoju kopiju pravila', () => {
    expect(source).toContain('shadow-report.ts');
    expect(source).toContain('shadowReport(');
    // Nema sopstvenog brojanja razlika: `differences`, `lowered`, `raised` i
    // `unexplained` moraju doći iz modula, a ne iz upita ili petlje ovdje.
    expect(source).not.toMatch(/lowered\s*[:=]\s*\w+\.filter/);
    expect(source).not.toMatch(/unexplained\s*=\s*.*\.filter/);
  });

  it('je samo čitanje — nema INSERT/UPDATE/DELETE/DDL', () => {
    const sql = source.toUpperCase();
    for (const forbidden of [
      'INSERT INTO',
      'UPDATE "',
      'DELETE FROM',
      'ALTER TABLE',
      'DROP TABLE',
      'TRUNCATE',
    ]) {
      expect(sql).not.toContain(forbidden);
    }
    // Sesija se na strani servera proglašava read-only — zaštita ne zavisi od
    // toga da li je korisnik u bazi slučajno vlasnik tabele.
    expect(source).toContain('SET TRANSACTION READ ONLY');
    expect(source).toContain('ROLLBACK');
  });

  it('ne traži tajnu iz koda — samo iz okruženja', () => {
    expect(source).toContain('DATABASE_URL_READONLY');
    // Nijedan konekcioni string se ne smije pojaviti kao literal.
    expect(source).not.toMatch(/postgres(ql)?:\/\//);
  });

  it('uz rezultat ispisuje ograničenje uzorka', () => {
    // „0 razlika" na malom uzorku mora se čitati kao „nema podataka". Bez ovoga
    // bi prazan shadow period izgledao kao slaganje kontrolera i formule.
    expect(source).toContain('SHADOW_MIN_DAYS');
    expect(source.toLowerCase()).toContain('backfill');
  });
});

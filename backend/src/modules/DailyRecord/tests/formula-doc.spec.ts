import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * F5.6 — `docs/FORMULA.md` i `scripts/audit/formula_doc_check.cjs`.
 *
 * Dokument sa brojevima je najlakše mjesto da tiho postane laž: kod se promijeni
 * u jednom fajlu, dokument ostane na starom broju, i niko to ne primijeti jer
 * dokument niko ne izvršava. Zato ovaj test ne provjerava „da li dokument
 * postoji", nego **da li provjera pada kada treba**.
 *
 * Dvije stvari se ovdje drže:
 *
 *  1. pravi dokument se slaže sa kodom (provjera prolazi na njemu);
 *  2. ista provjera, na kopiji dokumenta sa jednim izmijenjenim brojem, pada i
 *     imenuje **taj** broj. Bez (2) bi provjera mogla biti pokvarena (npr. da
 *     uvijek vraća 0) i niko ne bi znao.
 *
 * Kopija ide u `os.tmpdir()`, pravi dokument se ne dira — test koji kvari pravi
 * fajl je test koji nekad ostane pokvaren.
 */
describe('F5.6 FORMULA.md', () => {
  const root = join(__dirname, '../../../../..');
  const script = join(root, 'scripts/audit/formula_doc_check.cjs');
  const doc = join(root, 'docs/FORMULA.md');

  function run(env: Record<string, string> = {}) {
    return spawnSync(process.execPath, [script], {
      encoding: 'utf8',
      env: { ...process.env, ...env },
    });
  }

  it('se slaže sa kodom', () => {
    const result = run();
    expect(result.stderr).not.toContain('::error::');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('se slažu sa kodom');
  });

  it('sadrži jednačinu i sve tvrde granice', () => {
    const text = readFileSync(doc, 'utf8');
    // Jednačina je suština dokumenta; bez nje je dokument samo lista brojeva.
    expect(text).toContain('F_eq = T_cilj + s·(T_cilj − O_ref) − (c + u_day)');
    expect(text).toContain('O_ref');
    expect(text).toContain('DWELL_DAYS');
    expect(text).toContain('MAX_DAILY_CHANGE_K');
    // Reference na plan, ne kopija plana.
    expect(text).toContain('docs/plans/PLAN-formula-v2.md');
  });

  it('padne i imenuje broj kada se dokument raziđe sa kodom', () => {
    const original = readFileSync(doc, 'utf8');
    const drifted = original.replace(
      '| `DWELL_DAYS` | 3 |',
      '| `DWELL_DAYS` | 4 |',
    );
    // Ako zamjena ne pogodi ništa, test bi prošao bez dokaza — zato provjera.
    expect(drifted).not.toBe(original);

    const tmp = join(
      process.env.TMPDIR ?? '/tmp',
      `formula-drift-${process.pid}-${Date.now()}.md`,
    );
    writeFileSync(tmp, drifted, 'utf8');
    const result = run({ FORMULA_DOC: tmp });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('DWELL_DAYS');
    expect(result.stdout).toContain('dokument 4 ≠ kod 3');
  });
});

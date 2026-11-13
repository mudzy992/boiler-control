import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DEFAULT_PROPOSAL_ENGINE,
  PROPOSAL_ENGINE_ENV,
  parseProposalEngine,
  resolveProposalEngine,
} from '../proposal-engine';

/**
 * F4.1 — prekidač `PROPOSAL_ENGINE`.
 *
 * Najvažniji test nije „čita se vrijednost" nego **šta se dešava sa tipfelerom**.
 * Da `PROPOSAL_ENGINE=modl` tiho padne na `curve`, čovjek bi mislio da je model
 * pušten u produkciju — a razlika se vidi tek na računu za gas, mjesec dana
 * kasnije. Zato se nepoznata vrijednost **odbija i imenuje**.
 */
describe('F4.1 proposal-engine', () => {
  it('zadano ne mijenja ponašanje', () => {
    // Ovo je jedina vrijednost pri kojoj deploy ništa ne mijenja. Ako se
    // promijeni, mijenja se i ponašanje produkcije bez ijedne izmjene koda —
    // zato je test, a ne komentar.
    expect(DEFAULT_PROPOSAL_ENGINE).toBe('curve');
    expect(PROPOSAL_ENGINE_ENV).toBe('PROPOSAL_ENGINE');
  });

  it('čita obje dozvoljene vrijednosti', () => {
    expect(parseProposalEngine('curve').engine).toBe('curve');
    expect(parseProposalEngine('model').engine).toBe('model');
    expect(parseProposalEngine('model').valid).toBe(true);
  });

  it('toleriše razmake i velika slova — to nije tipfeler', () => {
    expect(parseProposalEngine('  MODEL \n').engine).toBe('model');
    expect(parseProposalEngine('Curve').engine).toBe('curve');
  });

  it('prazno i nedefinisano daju zadano, bez problema', () => {
    for (const raw of ['', '   ', null, undefined]) {
      const parsed = parseProposalEngine(raw);
      expect(parsed.engine).toBe(DEFAULT_PROPOSAL_ENGINE);
      expect(parsed.valid).toBe(true);
      expect(parsed.problem).toBeNull();
    }
  });

  it('tipfeler se odbija i imenuje — ne prolazi tiho', () => {
    const parsed = parseProposalEngine('modl');
    expect(parsed.engine).toBe(DEFAULT_PROPOSAL_ENGINE);
    expect(parsed.valid).toBe(false);
    // Poruka mora sadržati i ono što je pogrešno upisano i šta je dozvoljeno:
    // inače čovjek u logu vidi „neispravno" bez ijedne informacije.
    expect(parsed.problem).toContain('modl');
    expect(parsed.problem).toContain('curve, model');
  });

  it('"true"/"1" se ne prihvataju kao "model"', () => {
    // Klasična zamjena: prekidač izgleda kao bulov, pa se upiše `true`.
    // Da se to prihvati, uključilo bi se nešto što niko nije tražio.
    for (const raw of ['true', '1', 'on', 'yes', 'model ']) {
      const parsed = parseProposalEngine(raw);
      if (raw.trim() === 'model') continue;
      expect(parsed.valid).toBe(false);
      expect(parsed.engine).toBe('curve');
    }
  });

  it('iz okruženja: problem se vraća, ali vrijednost ostaje sigurna', () => {
    const ok = resolveProposalEngine({ PROPOSAL_ENGINE: 'model' });
    expect(ok).toEqual({ engine: 'model', problem: null });

    const bad = resolveProposalEngine({ PROPOSAL_ENGINE: 'nesto' });
    expect(bad.engine).toBe('curve');
    expect(bad.problem).toContain('nesto');

    // Bez promjenljive: zadano, tiho (nije greška, to je normalno stanje).
    expect(resolveProposalEngine({})).toEqual({
      engine: 'curve',
      problem: null,
    });
  });

  describe('prekidač je zaista spojen na predlog', () => {
    const writer = readFileSync(
      join(__dirname, '../daily-record.writer.ts'),
      'utf8',
    );

    it('writer čita prekidač i zapisuje koji je motor STVARNO dao broj', () => {
      expect(writer).toContain('resolveProposalEngine()');
      // F4.2: u `params` ide `engineUsed`, a ne traženi motor. Razlika je
      // bitna: ako je tražen `model` a model nije dao broj (nema noćne
      // prognoze), predlog je sa krive — i zapis to mora reći, inače bi se
      // poslije tvrdilo da je modelski put radio.
      expect(writer).toContain('const engineUsed =');
      expect(writer).toContain('engine: engineUsed');
      expect(writer).not.toContain('engine: engineChoice.engine');
    });

    it('nepoznata vrijednost se loguje, a predlog se ne obara', () => {
      // Prekid znači „nema predloga za danas" — gore od pogrešnog motora.
      expect(writer).toContain('engineChoice.problem');
      expect(writer).toMatch(
        /logger\.warn\(`Kuća \$\{home\.id\}: \$\{engineChoice\.problem\}`\)/,
      );
    });
  });
});

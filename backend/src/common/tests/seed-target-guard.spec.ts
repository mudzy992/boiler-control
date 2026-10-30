/**
 * REL-4 / B-021 — seed i reset su destruktivni bez provjere ciljne baze.
 *
 * `prisma/seed.ts` radi 14× `deleteMany()` nad svim tabelama i ispisuje testnu
 * lozinku na stdout. Ako `DATABASE_HOST`/`DATABASE_NAME` pokazuju na
 * produkciju, jedna greška u `.env` briše stvarne podatke.
 *
 * Guard mora odlučiti **prije** nego što se otvori ijedna konekcija, pa je
 * čista funkcija nad env objektom — bez Prisme, bez mreže.
 */
import {
  evaluateSeedTarget,
  assertSeedTargetAllowed,
} from '../seed-target-guard';

const SAFE = {
  NODE_ENV: 'test',
  DATABASE_HOST: 'localhost',
  DATABASE_NAME: 'boiler_control_test',
};

describe('REL-4 / B-021: provjera ciljne baze prije seeda', () => {
  it('dozvoljava lokalnu bazu s testnom konvencijom imena', () => {
    const d = evaluateSeedTarget(SAFE);
    expect(d.allowed).toBe(true);
  });

  it('ODBIJA produkciju po NODE_ENV, čak i uz testno ime baze', () => {
    const d = evaluateSeedTarget({ ...SAFE, NODE_ENV: 'production' });
    expect(d.allowed).toBe(false);
    expect(d.reason).toMatch(/production/i);
  });

  it('ODBIJA nepoznatu (ne-testnu) bazu na localhostu', () => {
    const d = evaluateSeedTarget({ ...SAFE, DATABASE_NAME: 'boiler_control' });
    expect(d.allowed).toBe(false);
  });

  it('ODBIJA nedostajuće ime baze', () => {
    const d = evaluateSeedTarget({ ...SAFE, DATABASE_NAME: undefined });
    expect(d.allowed).toBe(false);
    expect(d.reason).toMatch(/DATABASE_NAME/i);
  });

  it('ODBIJA nelokalni host, čak i uz testno ime baze', () => {
    const d = evaluateSeedTarget({
      ...SAFE,
      DATABASE_HOST: 'prod-db.boiler-control.ba101.top',
    });
    expect(d.allowed).toBe(false);
    expect(d.reason).toMatch(/host/i);
  });

  it('dozvoljava nelokalni host ako je baza izričito na allowlistu', () => {
    const d = evaluateSeedTarget({
      ...SAFE,
      DATABASE_HOST: 'ci-postgres',
      DATABASE_NAME: 'audit_disposable',
      SEED_ALLOWED_DATABASES: 'audit_disposable, boiler_control_test',
    });
    expect(d.allowed).toBe(true);
  });

  it('allowlist NE pomaže protiv NODE_ENV=production', () => {
    const d = evaluateSeedTarget({
      ...SAFE,
      NODE_ENV: 'production',
      SEED_ALLOWED_DATABASES: 'boiler_control_test',
    });
    expect(d.allowed).toBe(false);
  });

  it('SEED_ALLOW_ANY_TARGET dozvoljava nelokalni testni host, ali ne produkciju', () => {
    const disposable = evaluateSeedTarget({
      ...SAFE,
      DATABASE_HOST: 'ci-postgres',
      SEED_ALLOW_ANY_TARGET: 'on',
    });
    expect(disposable.allowed).toBe(true);

    const prod = evaluateSeedTarget({
      ...SAFE,
      NODE_ENV: 'production',
      DATABASE_HOST: 'ci-postgres',
      SEED_ALLOW_ANY_TARGET: 'on',
    });
    expect(prod.allowed).toBe(false);
  });

  it('SEED_ALLOW_ANY_TARGET prima samo "on" — sve ostalo je neaktivno', () => {
    for (const value of ['1', 'true', 'yes', 'ON', '']) {
      const d = evaluateSeedTarget({
        ...SAFE,
        DATABASE_HOST: 'ci-postgres',
        SEED_ALLOW_ANY_TARGET: value,
      });
      expect(d.allowed).toBe(false);
    }
  });

  it('reason nikad ne sadrži vrijednost lozinke', () => {
    const d = evaluateSeedTarget({
      ...SAFE,
      DATABASE_NAME: 'boiler_control',
      DATABASE_PASSWORD: 'SuperSecret123',
    });
    expect(d.allowed).toBe(false);
    expect(d.reason).not.toMatch(/SuperSecret123/);
  });

  it('assertSeedTargetAllowed baca za nepoznat cilj, a ne baca za dozvoljen', () => {
    expect(() => assertSeedTargetAllowed(SAFE)).not.toThrow();
    expect(() =>
      assertSeedTargetAllowed({ ...SAFE, DATABASE_NAME: 'boiler_control' }),
    ).toThrow(/boiler_control/);
  });
});

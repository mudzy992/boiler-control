/**
 * REL-4 / B-021 — provjera ciljne baze prije destruktivnog seeda.
 *
 * `prisma/seed.ts` radi `deleteMany()` nad svim tabelama. Prije ove provjere
 * nijedan uslov nije stajao između pogrešnog `.env`-a i brisanja stvarnih
 * podataka. Guard je **čista funkcija nad env objektom**: ne otvara konekciju,
 * ne čita Prizmu, ne dira mrežu — pa se odbijanje desi prije prvog paketa
 * prema bazi.
 *
 * Politika (od najstrožije prema najblažoj):
 *   1. `NODE_ENV=production`            → uvijek ODBIJ, bez izuzetka.
 *   2. Nedostaje `DATABASE_NAME`        → ODBIJ.
 *   3. Baza je na `SEED_ALLOWED_DATABASES` → DOZVOLI (bilo koji host).
 *   4. `SEED_ALLOW_ANY_TARGET=on`       → DOZVOLI (disposable CI baza).
 *   5. Host je lokalan IME baze testno  → DOZVOLI.
 *   6. Sve ostalo                       → ODBIJ.
 *
 * `reason` nikad ne smije sadržavati tajne — samo imena varijabli i vrijednost
 * baze/hosta, koji nisu vjerodajnice.
 */

export interface SeedTargetEnv {
  NODE_ENV?: string;
  DATABASE_HOST?: string;
  DATABASE_NAME?: string;
  /**
   * Namjerno dio ulaza: guard ga **nikad ne čita**, a test dokazuje da se
   * vrijednost ne pojavljuje u `reason`.
   */
  DATABASE_PASSWORD?: string;
  /** CSV lista imena baza koje su izričito dozvoljene. */
  SEED_ALLOWED_DATABASES?: string;
  /** Eksplicitni override za disposable baze; prima isključivo `on`. */
  SEED_ALLOW_ANY_TARGET?: string;
}

export interface SeedTargetDecision {
  allowed: boolean;
  reason: string;
}

const LOCAL_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '0.0.0.0',
  'host.docker.internal',
]);

/**
 * Testna konvencija imena: baza se smije smatrati disposable samo ako joj ime
 * jasno kaže da jeste. `boiler_control` (produkcija) ne prolazi.
 */
export function hasTestDatabaseName(name: string): boolean {
  const n = name.toLowerCase();
  return /(^|[_-])(test|tests|testing|spec|dev|local|disposable|audit)([_-]|$)/.test(
    n,
  );
}

function parseAllowlist(raw: string | undefined): Set<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

export function evaluateSeedTarget(env: SeedTargetEnv): SeedTargetDecision {
  const dbName = env.DATABASE_NAME?.trim();
  const dbHost = env.DATABASE_HOST?.trim();

  // 1. Produkcija je apsolutna granica — nijedan override je ne zaobilazi.
  if (env.NODE_ENV === 'production') {
    return {
      allowed: false,
      reason:
        'NODE_ENV je "production". Destruktivni seed se ne smije pokrenuti nad produkcijskom bazom.',
    };
  }

  // 2. Bez imena baze nema ni cilja — odbij prije konekcije.
  if (!dbName) {
    return {
      allowed: false,
      reason: 'DATABASE_NAME nije postavljen; cilj seeda nije poznat.',
    };
  }

  // 3. Izrični allowlist vlasnika.
  if (parseAllowlist(env.SEED_ALLOWED_DATABASES).has(dbName)) {
    return {
      allowed: true,
      reason: `Baza "${dbName}" je na SEED_ALLOWED_DATABASES.`,
    };
  }

  const local = !!dbHost && LOCAL_HOSTS.has(dbHost.toLowerCase());
  const testName = hasTestDatabaseName(dbName);
  const anyTarget = env.SEED_ALLOW_ANY_TARGET === 'on';

  // 4. Disposable CI baza na hostu koji nije lokalan.
  if (anyTarget && testName) {
    return {
      allowed: true,
      reason: `SEED_ALLOW_ANY_TARGET je "on" i baza "${dbName}" ima testno ime.`,
    };
  }

  // 5. Klasični lokalni razvoj.
  if (local && testName) {
    return {
      allowed: true,
      reason: `Lokalni host "${dbHost}" i testna baza "${dbName}".`,
    };
  }

  if (!local) {
    return {
      allowed: false,
      reason: `Host "${dbHost ?? '(nije postavljen)'}" nije lokalan, a baza "${dbName}" nije na allowlistu.`,
    };
  }

  return {
    allowed: false,
    reason: `Baza "${dbName}" nema testno ime i nije na SEED_ALLOWED_DATABASES.`,
  };
}

/**
 * Vrši provjeru i baca ako cilj nije dozvoljen. Poruka sadrži ime baze (nije
 * tajna), ali nikad lozinku.
 */
export function assertSeedTargetAllowed(env: SeedTargetEnv): void {
  const decision = evaluateSeedTarget(env);
  if (!decision.allowed) {
    throw new Error(
      `Seed odbijen: ${decision.reason} ` +
        'Za disposable bazu postavi SEED_ALLOWED_DATABASES ili SEED_ALLOW_ANY_TARGET=on.',
    );
  }
}

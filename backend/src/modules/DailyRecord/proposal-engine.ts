/**
 * F4.1 — koji motor proizvodi **predlog** koji ide korisniku.
 *
 * Do sada je na tom mjestu bila samo stara kriva (`FlowTemperatureEngine`), a
 * model je radio u sjenci (`DailyRecord.shadowFlowC`). Prekidač postoji da se
 * prelazak može napraviti **riječju u okruženju**, a ne izdanjem — i da se
 * može vratiti istom riječju.
 *
 * **Zašto `curve` ostaje zadano.** Dok F3.1 ne izmjeri pokrivenost intervala
 * pouzdanosti, model nije provjeren na stvarnim podacima; puštanje bi bilo
 * zamjena jedne neprovjerene vrijednosti drugom. Zadano je zato **staro
 * ponašanje**, i to je jedina vrijednost pri kojoj deploy ništa ne mijenja.
 *
 * **Zašto ime `PROPOSAL_ENGINE`, a ne `FORMULA`.** „Formula" je u ovom projektu
 * korištena za staru krivu *i* za novi izraz, pa bi ime okruženja bilo
 * dvosmisleno. „Engine" imenuje mjesto u kodu (`FlowTemperatureEngine`), ne
 * matematiku — a matematika je upravo ono što se bira.
 */

/** Vrijednosti koje prekidač prihvata. */
export type ProposalEngine = 'curve' | 'model';

/** Vrijednost koja **ne mijenja ponašanje** deploya. */
export const DEFAULT_PROPOSAL_ENGINE: ProposalEngine = 'curve';

/**
 * Ime promjenljive okruženja. Zapisano ovdje, a ne razbacano po `process.env`,
 * da se pretraga za imenom nađe na jednom mjestu — uključujući `docker-compose`
 * i `.env.example`.
 */
export const PROPOSAL_ENGINE_ENV = 'PROPOSAL_ENGINE';

/**
 * Pročitaj prekidač.
 *
 * Nepoznata vrijednost **ne** pada na zadano tiho: tada bi `PROPOSAL_ENGINE=modl`
 * (tipfeler) radio staru krivu, a čovjek bi mislio da je model pušten — i to je
 * greška koja se vidi tek po računu za gas. Zato se nepoznata vrijednost
 * odbija, a pozivalac odlučuje šta dalje (v. `resolveProposalEngine`).
 */
export function parseProposalEngine(raw: string | null | undefined): {
  engine: ProposalEngine;
  valid: boolean;
  problem: string | null;
} {
  if (raw == null || raw.trim() === '') {
    return { engine: DEFAULT_PROPOSAL_ENGINE, valid: true, problem: null };
  }
  const value = raw.trim().toLowerCase();
  if (value === 'curve' || value === 'model') {
    return { engine: value, valid: true, problem: null };
  }
  return {
    engine: DEFAULT_PROPOSAL_ENGINE,
    valid: false,
    problem:
      `nepoznata vrijednost "${raw}" za ${PROPOSAL_ENGINE_ENV} ` +
      `(dozvoljeno: curve, model) — koristim "${DEFAULT_PROPOSAL_ENGINE}"`,
  };
}

/** Čitanje iz okruženja, sa odbijenom nepoznatom vrijednošću. */
export function resolveProposalEngine(env: NodeJS.ProcessEnv = process.env): {
  engine: ProposalEngine;
  problem: string | null;
} {
  const parsed = parseProposalEngine(env[PROPOSAL_ENGINE_ENV]);
  return { engine: parsed.engine, problem: parsed.problem };
}

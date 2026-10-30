/**
 * REL-4 / B-021 — čuvar za destruktivne Prisma komande (`migrate reset`).
 *
 * `prisma migrate reset --force` briše šemu i podatke bez ikakvog pitanja.
 * Ova skripta se pokreće PRIJE nje i odbija ako cilj nije prepoznat kao
 * testni. Logika je ista kao za seed (`src/common/seed-target-guard.ts`) —
 * jedan izvor istine, bez dupliranja pravila.
 *
 * Izlazi: 0 = dozvoljeno, 2 = pogrešna upotreba, 1 = cilj odbijen.
 */
import 'dotenv/config';
import { evaluateSeedTarget } from 'src/common/seed-target-guard';

const HELP = `
Provjera ciljne baze prije destruktivne komande (REL-4 / B-021).

Upotreba:
  node -r tsconfig-paths/register scripts/require-safe-target.ts
  npm run db:reset        (već uključuje ovu provjeru)
  ... -- --help           Prikaži ovu pomoć.

Pravila (ista kao za seed):
  - NODE_ENV=production se uvijek odbija;
  - baza mora imati testno ime ILI biti na SEED_ALLOWED_DATABASES;
  - nelokalni host zahtijeva SEED_ALLOW_ANY_TARGET=on ili allowlist.

Skripta ne ispisuje vjerodajnice — samo ime hosta i baze.
`.trim();

function main(): number {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log(HELP);
    return 0;
  }

  const unknown = args.filter((a) => a.startsWith('-'));
  if (unknown.length > 0) {
    console.error(`Nepoznat argument: ${unknown.join(', ')}. Pokušaj --help.`);
    return 2;
  }

  const decision = evaluateSeedTarget(process.env);
  if (!decision.allowed) {
    console.error(`❌ Destruktivna komanda odbijena: ${decision.reason}`);
    console.error(
      '   Za disposable bazu postavi SEED_ALLOWED_DATABASES ili SEED_ALLOW_ANY_TARGET=on.',
    );
    return 1;
  }

  console.log(`✅ Cilj dozvoljen: ${decision.reason}`);
  return 0;
}

process.exit(main());

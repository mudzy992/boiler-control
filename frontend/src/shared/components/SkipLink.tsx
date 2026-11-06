/**
 * SkipLink — WCAG 2.2 2.4.1 (Skip Blokovi).
 *
 * Prikazuje se samo kada dobije tastaturatni fokus, omogućavajući
 * korisnicima tastature i čitača ekrana da preskoče glavnu navigaciju
 * i idu direktno na glavni sadržaj stranice.
 */
export function SkipLink({ href = '#main-content' }: { href?: string }) {
  return (
    <a
      href={href}
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 z-50 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md ring ring-primary ring-offset-2 transition-all"
    >
      Preskoči na glavni sadržaj
    </a>
  );
}

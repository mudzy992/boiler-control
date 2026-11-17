/**
 * Boje i razmaci za TV.
 *
 * **Tamna pozadina nije stil, nego zahtjev.** TV visi na zidu i svijetli ekran
 * od 55" u mračnoj sobi je reflektor. Isto važi za kontrast: korisnik gleda sa
 * 3 m, pa je najmanja veličina teksta 22 px (na telefonu je 13).
 */
export const colors = {
  background: '#0B1418',
  surface: '#132127',
  text: '#EAF2F4',
  textMuted: '#9DB2B8',
  accent: '#4DB6AC',
  fault: '#EF6C6C',
} as const;

/** Veći razmaci nego na mobilnom — isti razlog kao veličina teksta. */
export const spacing = {
  sm: 12,
  md: 24,
  lg: 40,
  xl: 64,
} as const;

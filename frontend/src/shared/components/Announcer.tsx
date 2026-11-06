import { useRef } from 'react';

/**
 * Announcer — WCAG 2.2 4.1.3 (Status Obavijesti).
 *
 * `aria-live` region koji obavještava čitače ekrana o dinamičkim
 * promenama u UI-ju (npr. "Profil sačuvan", "Greška pri slanju").
 *
 * Koristite `announce('Poruka', 'polite' | 'assertive')` sa bilo kojeg
 * componente. `polite` čeka da screen reader završi trenutnu govornu
 * poruku; `assertive` prekinje trenutnu poruku (za kritične greške).
 */
export function Announcer() {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={containerRef}
      className="sr-only pointer-events-none"
      aria-atomic="true"
      aria-relevant="additions text"
    />
  );
}



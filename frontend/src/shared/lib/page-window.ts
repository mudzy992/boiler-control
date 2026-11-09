/**
 * Granice prikazanog prozora tabele: „21–40 od 302".
 *
 * Izdvojeno iz `table-controls.tsx` (i iz komponente) iz dva razloga: može se
 * testirati bez renderovanja, a off-by-one ovdje korisnik vidi odmah — tabela bi
 * tvrdila da ima red 303 od 302.
 */
export interface PageWindow {
  from: number;
  to: number;
  canPrev: boolean;
  canNext: boolean;
}

export function pageWindow(total: number, offset: number, limit: number): PageWindow {
  if (total <= 0) return { from: 0, to: 0, canPrev: false, canNext: false };
  return {
    from: Math.min(offset + 1, total),
    to: Math.min(offset + limit, total),
    canPrev: offset > 0,
    canNext: offset + limit < total,
  };
}

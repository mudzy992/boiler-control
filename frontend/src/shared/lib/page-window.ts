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

/**
 * Brojevi stranica za podnožje tabele: `[1, 'gap', 4, 5, 6, 'gap', 16]`.
 *
 * Zašto izdvojeno: tabela historije ima 302 dana i 16 strana — red „1 … 5 6 7
 * … 16" mora biti tačan i kad je trenutna strana prva, zadnja ili u sredini.
 * Računanje u JSX-u bi se razlikovalo po slučaju, pa bi se i pogreška vidjela
 * samo na nekoj od tih strana.
 */
export type PageToken = number | 'gap';

export function pageList(
  pages: number,
  current: number,
  maxButtons = 5,
): PageToken[] {
  if (!Number.isFinite(pages) || pages <= 0) return [1];

  const total = Math.max(1, Math.floor(pages));
  const active = Math.min(Math.max(1, Math.floor(current)), total);
  // Sve stranice staju — nema potrebe za „…".
  if (total <= maxButtons + 2) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  const half = Math.floor((maxButtons - 1) / 2);
  let start = Math.max(2, active - half);
  const end = Math.min(total - 1, start + maxButtons - 1);
  // Prozor se pomjera uz desnu ivicu, da ne ostane „…" umjesto dvije zadnje.
  start = Math.max(2, Math.min(start, end - maxButtons + 1));

  const tokens: PageToken[] = [1];
  if (start > 2) tokens.push('gap');
  for (let page = start; page <= end; page += 1) tokens.push(page);
  if (end < total - 1) tokens.push('gap');
  tokens.push(total);
  return tokens;
}

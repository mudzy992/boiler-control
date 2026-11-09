import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { Label } from '@/shared/components/ui/Label';
import { pageList, pageWindow } from '@/shared/lib/page-window';

/**
 * Zajednički dijelovi za tabelarne prikaze (`36`).
 *
 * Zašto zajednički, a ne u svakoj stranici: tri tabele (`/heating`,
 * `/gas/readings`, `/reports`) imale su isti nedostatak — prikazivale su ono što
 * stigne u jednom odgovoru, bez filtera i bez ikakvog znaka da ima još redova.
 * Tri nezavisne kopije bi se razšle već pri prvom popravku.
 */

export interface DateRange {
  from: string;
  to: string;
}

/**
 * Filter raspona datuma.
 *
 * `type="date"` namjerno: daje nativni kalendar i tastaturu, a vrijednost je
 * `YYYY-MM-DD` — isti oblik koji backend prima. Ručni format bi značio da
 * korisnik može poslati `8.11.2026`, što server odbija.
 */
export function DateRangeFilter({
  value,
  onChange,
  disabled,
  idPrefix,
  label,
}: {
  value: DateRange;
  onChange: (next: DateRange) => void;
  disabled?: boolean;
  idPrefix: string;
  label?: string;
}): JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap items-end gap-3">
      {label ? (
        <span className="text-xs uppercase tracking-wide text-text-secondary">{label}</span>
      ) : null}
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-from`}>{t('common.from')}</Label>
        <Input
          id={`${idPrefix}-from`}
          type="date"
          value={value.from}
          max={value.to || undefined}
          disabled={disabled}
          onChange={(event) => onChange({ ...value, from: event.target.value })}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-to`}>{t('common.to')}</Label>
        <Input
          id={`${idPrefix}-to`}
          type="date"
          value={value.to}
          min={value.from || undefined}
          disabled={disabled}
          onChange={(event) => onChange({ ...value, to: event.target.value })}
        />
      </div>
      {value.from || value.to ? (
        <Button
          type="button"
          variant="ghost"
          onClick={() => onChange({ from: '', to: '' })}
          disabled={disabled}
        >
          {t('common.clear')}
        </Button>
      ) : null}
    </div>
  );
}

/**
 * Podnožje tabele: „Prikazano 21–40 od 302" + prethodna/sljedeća strana.
 *
 * Brojevi su jedina stvar koja razlikuje „tabela ima 50 redova" od „tabela
 * prikazuje 50 od 302". Bez njih korisnik ne zna ni da postoji strana 2 — isti
 * kvar kao tihi `take: 100` na serveru.
 */
export function TablePager({
  total,
  offset,
  limit,
  onChange,
  isFetching,
}: {
  total: number;
  offset: number;
  limit: number;
  onChange: (nextOffset: number) => void;
  isFetching?: boolean;
}): JSX.Element | null {
  const { t } = useTranslation();

  if (total <= 0) return null;

  const { from, to, canPrev, canNext } = pageWindow(total, offset, limit);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <p className="text-sm text-text-secondary">
        {t('common.showingRange', { from, to, total })}
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={!canPrev || isFetching}
          onClick={() => onChange(Math.max(0, offset - limit))}
        >
          {t('common.previous')}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!canNext || isFetching}
          onClick={() => onChange(offset + limit)}
        >
          {t('common.next')}
        </Button>
      </div>
    </div>
  );
}

/**
 * Podnožje sa **brojevima stranica** (`36`).
 *
 * Zašto uz `TablePager`: tabele sa dvije-tri strane (preporuke danas) su dobre
 * sa „prethodna/sljedeća", ali historija dnevnih zapisa ima 300+ dana i 16
 * strana — korisnik tada mora vidjeti gdje je i skočiti na stranu, a ne
 * kliktati „sljedeća" petnaest puta.
 *
 * Numeracija je 1-based i namjerno ne nudi „prva/zadnja" ikonicu: brojevi su
 * već tu, a dvije ikone bi tražile objašnjenje za čitač ekrana.
 */
export function PageNumbers({
  total,
  offset,
  limit,
  onChange,
  isFetching,
}: {
  total: number;
  offset: number;
  limit: number;
  onChange: (nextOffset: number) => void;
  isFetching?: boolean;
}): JSX.Element | null {
  const { t } = useTranslation();

  if (total <= 0) return null;

  const pages = Math.max(1, Math.ceil(total / limit));
  const current = Math.min(pages, Math.floor(offset / limit) + 1);
  const { from, to } = pageWindow(total, offset, limit);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <p className="text-sm text-text-secondary">
        {t('common.showingRange', { from, to, total })}
      </p>
      <nav className="flex flex-wrap items-center gap-1" aria-label={t('common.pagination')}>
        {pageList(pages, current).map((token, index) =>
          token === 'gap' ? (
            <span
              key={`gap-${index}`}
              className="px-1 text-sm text-text-secondary"
              aria-hidden="true"
            >
              …
            </span>
          ) : (
            <Button
              key={token}
              type="button"
              size="sm"
              variant={token === current ? 'default' : 'outline'}
              aria-current={token === current ? 'page' : undefined}
              aria-label={t('common.pageNumber', { page: token })}
              disabled={isFetching}
              onClick={() => onChange((token - 1) * limit)}
            >
              {token}
            </Button>
          ),
        )}
      </nav>
    </div>
  );
}

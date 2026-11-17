import { type JSX } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/services/api';
import { absoluteDownloadUrl } from '../lib/appDownloadUrl';

/**
 * Linkovi za preuzimanje aplikacija na login ekranu.
 *
 * ## Zašto na login ekranu
 *
 * Covjek koji prvi put dolazi na sajt **nema nalog** — pa ekran za prijavu ne
 * moze da mu pomogne. Ako linkovi nisu tu, jedini put do aplikacije je da neko
 * zna URL i pošalje ga. Zato linkovi stoje uz formu, ali **ispod** nje: ne
 * smiju odvuci pažnju onome ko se prijavljuje svaki dan.
 *
 * ## Odakle linkovi
 *
 * `GET /api/app-releases/available` (javno, bez tokena) vraća **najnovije
 * objavljeno izdanje po platformi** — mobilno i TV. Time link uvijek vodi na
 * zadnju objavljenu verziju i nema ručnog ažuriranja u kodu.
 *
 * ## Šta se NE prikazuje
 *
 * Platforma bez objavljenog izdanja dobija `null` i **link se ne prikazuje**.
 * Bolje bez linka nego link na 404: mrtav link na login ekranu izgleda kao da
 * je sajt pokvaren, a korisnik nema način da provjeri.
 *
 * ## Otkaz mreže
 *
 * Ako poziv padne, prikazuje se **ništa** (uz diskretan tekst), a ne greška.
 * Login forma mora raditi i kad `app-releases` ruta ne radi — blokiranje
 * prijave zbog sporednog sadržaja bilo bi gore od nedostatka linka.
 */

interface ReleaseLink {
  version: string;
  buildNumber: number;
  sizeBytes: number;
  notes: string | null;
  publishedAt: string;
  downloadUrl: string;
}

interface AvailableReleases {
  phone: ReleaseLink | null;
  tv: ReleaseLink | null;
}

const AVAILABLE_QUERY_KEY = ['app-releases', 'available'] as const;

function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function configuredApiBase(): string {
  return (import.meta.env.VITE_API_URL ?? '').trim();
}

export const AppDownloadLinks = (): JSX.Element | null => {
  const { t } = useTranslation();

  const query = useQuery({
    queryKey: AVAILABLE_QUERY_KEY,
    queryFn: () => apiClient.get<AvailableReleases>('/app-releases/available'),
    /*
     * Kratki `staleTime` nije optimizacija nego tacnost: linkovi se mijenjaju
     * samo kad admin objavi novo izdanje, i tada je vazno da se vidi ubrzo.
     * Pet minuta je kompromis izmedju svjezine i toga da login ekran ne pravi
     * poziv pri svakom otvaranju.
     */
    staleTime: 5 * 60 * 1000,
    /*
     * Bez `retry`: login ekran ne smije da visi zbog sporednog sadržaja.
     * Jedan pokušaj, pa tišina — v. uvod.
     */
    retry: false,
  });

  const phone = query.data?.phone ?? null;
  const tv = query.data?.tv ?? null;

  // Ništa objavljeno (ili greška): sekcija se ne prikazuje uopšte.
  if (!phone && !tv) return null;

  return (
    <div className='mt-4 space-y-3' data-testid='app-download-links'>
      <div className='text-center'>
        <p className='text-xs font-medium uppercase tracking-wide text-ink-dim'>
          {t('auth.downloadTitle')}
        </p>
      </div>
      <div className='grid gap-2 sm:grid-cols-2'>
        {phone ? (
          <DownloadCard
            label={t('auth.downloadPhone')}
            hint={t('auth.downloadPhoneHint')}
            release={phone}
          />
        ) : null}
        {tv ? (
          <DownloadCard
            label={t('auth.downloadTv')}
            hint={t('auth.downloadTvHint')}
            release={tv}
          />
        ) : null}
      </div>
    </div>
  );
};

function DownloadCard({
  label,
  hint,
  release,
}: {
  label: string;
  hint: string;
  release: ReleaseLink;
}): JSX.Element {
  const { t } = useTranslation();
  const size = formatSize(release.sizeBytes);

  return (
    <a
      href={absoluteDownloadUrl(release.downloadUrl, configuredApiBase())}
      /*
       * `download` je namjerno ovdje: bez njega Android browser otvori bajtove
       * kao tekst. Server šalje `Content-Disposition: attachment`, ali atribut
       * drži ponašanje i kad se link otvori kroz proxy koji zaglavlja mijenja.
       */
      download
      className='group flex flex-col gap-1 rounded border border-line bg-raised px-3 py-2.5 transition hover:border-signal'
      data-testid={`download-${release.downloadUrl}`}
    >
      <span className='text-sm font-medium text-ink group-hover:text-signal'>
        {label}
      </span>
      <span className='text-xs text-ink-dim'>{hint}</span>
      <span className='text-xs text-ink-muted'>
        {/* Verzija je vidljiva: korisnik tako zna je li link svjež. */}v
        {release.version}
        {size ? ` · ${size}` : ''}
      </span>
      <span className='text-xs font-medium text-signal'>
        {t('auth.downloadAction')}
      </span>
    </a>
  );
}

AppDownloadLinks.displayName = 'AppDownloadLinks';
DownloadCard.displayName = 'DownloadCard';

import mockReact from 'react';
import { Text as mockNativeText } from 'react-native';
import { render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { AppThemeProvider } from '../../../theme/AppTheme';
import { apiClient } from '../../../services/api/client';
import { DailyHistoryCard } from '../DailyHistoryCard';

/**
 * A1 (audit analitike, §3.1) — ugovor koji ovaj test čuva:
 *
 *   Kartica ne smije tvrditi da je prikazan cijeli period kad nije.
 *
 * **Stvarna greška koju test hvata.** `summary.days` je `rows.length` — dužina
 * *stranice* (`limit`, na telefonu 14), dok backend u istom odgovoru vraća
 * `total` (312) i `truncated: true`. Kartica je do 16.11. pisala
 * „{{count}} dana zabilježeno" sa `count = 14`, pa je korisnik sa 312 dana u
 * bazi čitao da ima 14. Web je istu stvar radio ispravno (`historyTruncated`
 * baner), mobilni ne.
 *
 * Tri slučaja, jer treći je onaj koji se lako pokvari popravkom:
 *   1. `truncated: true`  → rečenica **mora** nositi oba broja (14 i 312)
 *   2. `truncated: false` → rečenica ostaje jednostavna (nema „od 14 od 14")
 *   3. `truncated: true` a `total` nedostaje → **ne izmišlja** ukupan broj
 */

jest.mock('@expo/vector-icons', () => {
  const createIcon = () => (props: { name: string }) =>
    mockReact.createElement(mockNativeText, { accessibilityLabel: `icon-${props.name}` }, props.name);
  return { Ionicons: createIcon(), MaterialCommunityIcons: createIcon() };
});

/**
 * Stvarni prijevodi, ne ključevi.
 *
 * `f3Analytics.test.tsx` vraća sam ključ i time ne vidi je li rečenica tačna —
 * a ovdje je **rečenica** predmet testa. Zato se uzima pravi objekat iz
 * `locales/config.ts` i interpolira kao i18next, pa test padne ako se u
 * prijevodu izgubi `{{total}}`.
 *
 * Ako se ključ ne nađe, vraća se sam ključ (kao i18next bez fallbacka) — pa
 * nedostatak prijevoda izgleda kao nedostatak, ne kao prolaz.
 */
jest.mock('../../../hooks/useTranslation', () => {
  const { __translationsForTest } = jest.requireActual('../../../locales/config');
  return {
    useTranslation: () => ({
      t: (key: string, vars?: Record<string, unknown>) => {
        const [group, ...rest] = key.split('.');
        const dict = __translationsForTest['bs-BS'] as Record<string, Record<string, string>>;
        const template = rest.length ? dict?.[group]?.[rest.join('.')] : undefined;
        if (typeof template !== 'string') return key;
        if (!vars) return template;
        return Object.entries(vars).reduce(
          (acc, [name, value]) => acc.replace(new RegExp(`{{${name}}}`, 'g'), String(value)),
          template,
        );
      },
      i18n: { language: 'bs-BS' },
    }),
  };
});

jest.mock('../../../services/api/client', () => ({
  apiClient: { getDailyHistory: jest.fn() },
}));

const makeRow = (localDate: string) => ({
  localDate,
  cycles: 3,
  cyclesSource: 'SERIES' as const,
  gasM3: null,
  degreeDays: null,
  origin: 'LIVE' as const,
  has: { cycles: true, gas: false, degreeDays: false, shadow: false },
});

const baseSummary = {
  days: 2,
  live: 2,
  backfill: 0,
  withCycles: 2,
  withGas: 0,
  withDegreeDays: 0,
  withShadow: 0,
  firstDate: '2026-11-08',
  lastDate: '2026-11-09',
};

/*
 * `render` je u RTL 14 **asinhron** (`dist/render.js`: `async function render`),
 * pa se mora sačekati — inače upit nad ekranom padne na „render function has not
 * been called", što izgleda kao greška u komponenti.
 */
async function renderCard() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return await render(
    <QueryClientProvider client={client}>
      <AppThemeProvider>
        <DailyHistoryCard homeProfileId={7} from="2026-01-01" to="2026-11-16" limit={14} />
      </AppThemeProvider>
    </QueryClientProvider>,
  );
}

describe('A1 — dnevna historija ne tvrdi da je prikazan cijeli period', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('kad je period skraćen, naslov nosi i prikazani i ukupan broj', async () => {
    jest.mocked(apiClient.getDailyHistory).mockResolvedValue({
      homeProfileId: 7,
      rows: [makeRow('2026-11-08'), makeRow('2026-11-09')],
      summary: baseSummary,
      truncated: true,
      total: 312,
    } as never);

    // 14 je `limit`, ali stvarni `shown` dolazi iz `summary.days` (2 u ovom
    // testu) — test ne pretpostavlja broj, nego traži da su OBA u rečenici.
    const { findByText } = await renderCard();
    // Stvarna bosanska rečenica, sa oba broja. Da 14 (dužina stranice) nije
    // zamijenjeno za ukupan broj, vidi se po tome što je u rečenici 312.
    const line = await findByText('Prikazano najnovijih 2 od 312 zabilježenih dana');
    expect(line).toBeTruthy();
  });

  it('kad period nije skraćen, naslov ostaje jednostavan', async () => {
    jest.mocked(apiClient.getDailyHistory).mockResolvedValue({
      homeProfileId: 7,
      rows: [makeRow('2026-11-08'), makeRow('2026-11-09')],
      summary: baseSummary,
      truncated: false,
      total: 2,
    } as never);

    const { findByText, queryByText } = await renderCard();

    // Cijeli period: rečenica je jednostavna, bez „od N".
    await findByText('2 dana zabilježeno');
    expect(queryByText(/od .* zabilježenih dana/)).toBeNull();
  });

  it('kad `total` ne stigne, ne izmišlja ukupan broj', async () => {
    jest.mocked(apiClient.getDailyHistory).mockResolvedValue({
      homeProfileId: 7,
      rows: [makeRow('2026-11-08'), makeRow('2026-11-09')],
      summary: baseSummary,
      truncated: true,
      // `total` namjerno nedostaje — stariji backend ili skraćen odgovor.
    } as never);

    const { findByText, queryByText } = await renderCard();

    // Bez `total`-a se ne tvrdi ukupan broj — ostaje jednostavna rečenica.
    await findByText('2 dana zabilježeno');
    expect(queryByText(/od .* zabilježenih dana/)).toBeNull();
  });
});

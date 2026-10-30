import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { MockInstance } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import dayjs from 'dayjs';
import { GasReadingCard } from '../GasReadingCard';
import '../../locales/config';

/**
 * FE2-11 — GasReadingCard: izračun potrošnje i akcije.
 *
 * SEMANTIKA KOJU OVAJ TEST ZAKLJUČAVA (verificirano u
 * `GasReadingsPage.tsx:170-174, 262-266`):
 *   - `sortedReadings` je sortiran SILAZNO po datumu (`b - a`), najnovije prvi.
 *   - `previousReading={sortedReadings[index - 1]}` je stoga element ISPRED,
 *     tj. **NOVIJE** očitanje — ime prop-a je zbunjujuće.
 *   - Zato je `consumption = previousReading.counterValue - reading.counterValue`
 *     = (novije − starije) = pozitivno, i `daysDiff` = (novije − starije) > 0.
 *
 * Matematika je dakle ispravna uprkos imenu. Test namjerno koristi jasno
 * imenovane varijable (`starije`/`novije`) da se predznak ne može tiho
 * obrnuti pri refaktoru.
 */

const STARIJE = {
  id: 1,
  counterValue: 1000,
  readingDate: '2026-09-01T08:00:00.000Z',
  createdAt: '2026-09-01T08:00:00.000Z',
};

const NOVIJE = {
  counterValue: 1150.5,
  readingDate: '2026-10-01T08:00:00.000Z',
};

function renderCard(overrides: Partial<Parameters<typeof GasReadingCard>[0]> = {}) {
  const onDelete = vi.fn();
  const onToggleReference = vi.fn();
  render(
    <GasReadingCard
      reading={STARIJE}
      previousReading={NOVIJE}
      onDelete={onDelete}
      onToggleReference={onToggleReference}
      {...overrides}
    />,
  );
  return { onDelete, onToggleReference };
}

describe('GasReadingCard — izračun potrošnje', () => {
  it('potrošnja = novije − starije (pozitivno)', () => {
    renderCard();
    // 1150.5 − 1000 = 150.5
    expect(screen.getByText('+150.50 m³')).toBeInTheDocument();
  });

  it('dnevni prosjek = potrošnja / broj dana, zaokruženo na 2 decimale', () => {
    renderCard();
    // razlika 2026-09-01 -> 2026-10-01 = 30 dana; 150.5 / 30 = 5.0166.. -> 5.02
    expect(screen.getByText('5.02 m³/day')).toBeInTheDocument();
  });

  it('period prikazuje broj dana', () => {
    renderCard();
    expect(screen.getByText(/Period/)).toBeInTheDocument();
    expect(screen.getByText(/:\s*30$/)).toBeInTheDocument();
  });

  it('zaokružuje dnevni prosjek, ne sirovi rezultat dijeljenja', () => {
    // 100 / 3 = 33.333.. -> 33.33
    renderCard({
      reading: { ...STARIJE, counterValue: 0 },
      previousReading: {
        counterValue: 100,
        readingDate: dayjs(STARIJE.readingDate).add(3, 'day').toISOString(),
      },
    });
    expect(screen.getByText('33.33 m³/day')).toBeInTheDocument();
  });
});

describe('GasReadingCard — kada se blok potrošnje NE prikazuje', () => {
  it('bez previousReading nema bloka potrošnje', () => {
    renderCard({ previousReading: undefined });
    expect(screen.queryByText('Consumption')).not.toBeInTheDocument();
    expect(screen.queryByText('Daily Average')).not.toBeInTheDocument();
  });

  it('isti dan (daysDiff = 0) ne prikazuje potrošnju — dijeljenje s nulom', () => {
    renderCard({
      previousReading: { counterValue: 1200, readingDate: STARIJE.readingDate },
    });
    expect(screen.queryByText('Consumption')).not.toBeInTheDocument();
  });

  it('novije očitanje koje je STARIJE (obrnuti predznak) ne prikazuje blok', () => {
    // daysDiff bi bio negativan -> uslov `daysDiff > 0` nije ispunjen.
    renderCard({
      previousReading: {
        counterValue: 900,
        readingDate: dayjs(STARIJE.readingDate).subtract(10, 'day').toISOString(),
      },
    });
    expect(screen.queryByText('Consumption')).not.toBeInTheDocument();
  });
});

describe('GasReadingCard — brisanje s potvrdom', () => {
  let confirmSpy: MockInstance<(message?: string) => boolean>;

  beforeEach(() => {
    confirmSpy = vi.spyOn(window, 'confirm');
  });

  it('potvrda "da" zove onDelete s id-em očitanja', async () => {
    const user = userEvent.setup();
    confirmSpy.mockReturnValue(true);
    const { onDelete } = renderCard();

    await user.click(screen.getByRole('button', { name: /^delete$/i }));

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith(STARIJE.id);
  });

  it('potvrda "ne" NE zove onDelete', async () => {
    const user = userEvent.setup();
    confirmSpy.mockReturnValue(false);
    const { onDelete } = renderCard();

    await user.click(screen.getByRole('button', { name: /^delete$/i }));

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('isLoading onemogućuje dugme za brisanje', () => {
    renderCard({ isLoading: true });
    expect(screen.getByRole('button', { name: /deleting/i })).toBeDisabled();
  });
});

describe('GasReadingCard — značke i akcije', () => {
  it('standardno očitanje dobija STANDARD značku', () => {
    renderCard({ reading: { ...STARIJE, isInvoiceReference: false } });
    expect(screen.getByText('STANDARD')).toBeInTheDocument();
    expect(screen.queryByText('REFERENCE')).not.toBeInTheDocument();
  });

  it('referentno očitanje dobija REFERENCE značku i akcije računa', () => {
    renderCard({ reading: { ...STARIJE, isInvoiceReference: true } });
    expect(screen.getByText('REFERENCE')).toBeInTheDocument();
    expect(screen.getByText('Invoice Actions')).toBeInTheDocument();
  });

  it('značke IMAGE i INVOICE samo kad su fajlovi prisutni', () => {
    renderCard({
      reading: { ...STARIJE, hasMeterImage: true, hasInvoicePdf: true },
    });
    expect(screen.getByText('IMAGE')).toBeInTheDocument();
    expect(screen.getByText('INVOICE')).toBeInTheDocument();
  });

  it('bez fajlova nema IMAGE/INVOICE znački', () => {
    renderCard({
      reading: { ...STARIJE, hasMeterImage: false, hasInvoicePdf: false },
    });
    expect(screen.queryByText('IMAGE')).not.toBeInTheDocument();
    expect(screen.queryByText('INVOICE')).not.toBeInTheDocument();
  });

  it('Set Reference zove onToggleReference s id-em i novim stanjem', async () => {
    const user = userEvent.setup();
    const { onToggleReference } = renderCard({
      reading: { ...STARIJE, isInvoiceReference: false },
    });

    await user.click(screen.getByRole('button', { name: /set reference/i }));

    expect(onToggleReference).toHaveBeenCalledWith(STARIJE.id, true);
  });

  it('Unset Reference šalje false', async () => {
    const user = userEvent.setup();
    const { onToggleReference } = renderCard({
      reading: { ...STARIJE, isInvoiceReference: true },
    });

    await user.click(screen.getByRole('button', { name: /unset reference/i }));

    expect(onToggleReference).toHaveBeenCalledWith(STARIJE.id, false);
  });
});

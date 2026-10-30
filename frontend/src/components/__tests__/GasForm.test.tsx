import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import dayjs from 'dayjs';
import { GasForm } from '../GasForm';
import '../../locales/config';

/**
 * FE2-11 — GasForm validacija.
 *
 * Cilj je zaključati `validateForm()` iz `GasForm.tsx:47-69`, koji je do sada
 * bio netestiran. Testovi namjerno idu preko KORISNIČKOG unosa (userEvent),
 * a ne pozivanjem interne funkcije, pa hvataju i ponašanje DOM-a.
 *
 * Napomena o `type="number"`: browser/jsdom odbacuje nenumeričke znakove, pa
 * se grana „nije decimalni broj" ne može izazvati unosom slova. Izaziva se
 * s previše decimala (`1.2345`), što je jedini realan put do te grane.
 */

/** Payload koji `GasForm` šalje — tipiziran da `mock.calls[0][0]` prolazi tsc. */
type SubmitPayload = {
  counterValue: number;
  readingDate: string;
  meterImage?: File;
};

function renderForm(overrides: Partial<Parameters<typeof GasForm>[0]> = {}) {
  const onSubmit = vi.fn(async (_payload: SubmitPayload) => {});
  const onClose = vi.fn();
  render(
    <GasForm
      open
      onClose={onClose}
      onSubmit={onSubmit}
      {...overrides}
    />,
  );
  return { onSubmit, onClose };
}

describe('GasForm — prikaz', () => {
  it('ne renderuje ništa kad je open=false', () => {
    const { container } = render(
      <GasForm open={false} onClose={vi.fn()} onSubmit={vi.fn(async () => {})} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('prikazuje naslov i polje za unos', () => {
    renderForm();
    // 'Add Reading' je i naslov (h2) i submit dugme, pa getByText nije
    // jednoznacan - koristimo ulogu.
    expect(screen.getByRole('heading', { name: 'Add Reading' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter meter reading (m³)')).toBeInTheDocument();
  });
});

describe('GasForm — validacija counterValue', () => {
  it('prazan unos: prikazuje "obavezno" i NE zove onSubmit', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.click(screen.getByRole('button', { name: /add reading/i }));

    expect(await screen.findByText('Counter value is required')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('previše decimala (1.2345): prikazuje grešku o decimalama', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    const input = screen.getByPlaceholderText('Enter meter reading (m³)');
    await user.type(input, '1.2345');
    await user.click(screen.getByRole('button', { name: /add reading/i }));

    expect(
      await screen.findByText('Must be a valid decimal number (up to 3 places)'),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('nula: prikazuje "mora biti veće od 0"', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.type(screen.getByPlaceholderText('Enter meter reading (m³)'), '0');
    await user.click(screen.getByRole('button', { name: /add reading/i }));

    expect(
      await screen.findByText('Counter value must be greater than 0'),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('ispravan unos s 3 decimale prolazi validaciju', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.type(screen.getByPlaceholderText('Enter meter reading (m³)'), '123.456');
    await user.click(screen.getByRole('button', { name: /add reading/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0].counterValue).toBe(123.456);
  });
});

describe('GasForm — datum', () => {
  it('prazan datum: prikazuje "Date is required" i ne šalje', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.click(screen.getByLabelText('Use current date & time'));
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    expect(dateInput).not.toBeNull();

    // Prazan datum je constraint-validan (nema `required`), pa submit STVARNO
    // dođe do validateForm() — za razliku od budućeg datuma.
    expect(dateInput.checkValidity()).toBe(true);

    await user.clear(dateInput);
    await user.type(screen.getByPlaceholderText('Enter meter reading (m³)'), '50');
    await user.click(screen.getByRole('button', { name: /add reading/i }));

    expect(await screen.findByText('Date is required')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('budući datum: validateForm postavlja grešku (browser `max` je blokira prije toga)', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.click(screen.getByLabelText('Use current date & time'));
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    const future = dayjs().add(2, 'day').format('YYYY-MM-DD');
    fireEvent.change(dateInput, { target: { value: future } });
    await user.type(screen.getByPlaceholderText('Enter meter reading (m³)'), '50');

    // NALAZ (FE2-11): date input ima `max={danas}`, pa budući datum daje
    // `validity.rangeOverflow = true` i browser odbija submit PRIJE nego
    // `handleSubmit` počne. Znači grana `futureDateError` u validateForm()
    // je kroz date picker nedostižna — korisnik vidi browser tooltip, ne naš
    // prevedeni tekst. Ovdje namjerno zaobilazimo constraint validation
    // (fireEvent.submit) da testiramo SAMU komponentinu validaciju.
    expect(dateInput.validity.rangeOverflow).toBe(true);

    const form = document.querySelector('form') as HTMLFormElement;
    fireEvent.submit(form);

    expect(
      await screen.findByText('Cannot add readings for future dates'),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('uz "koristi trenutno vrijeme" polja za datum se ne prikazuju', () => {
    renderForm();
    expect(document.querySelector('input[type="date"]')).toBeNull();
    expect(document.querySelector('input[type="time"]')).toBeNull();
  });
});

describe('GasForm — slanje i greške', () => {
  it('uspješno slanje resetuje formu i zove onClose', async () => {
    const user = userEvent.setup();
    const { onSubmit, onClose } = renderForm();

    const input = screen.getByPlaceholderText('Enter meter reading (m³)');
    await user.type(input, '77.5');
    await user.click(screen.getByRole('button', { name: /add reading/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0].counterValue).toBe(77.5);
    // ISO string jer useCurrentDateTime je uključen.
    expect(typeof onSubmit.mock.calls[0][0].readingDate).toBe('string');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('kad onSubmit baci, prikazuje se API greška a onClose se NE zove', async () => {
    const user = userEvent.setup();
    const failing = vi.fn(async () => {
      throw new Error('Backend nedostupan');
    });
    const onClose = vi.fn();
    render(<GasForm open onClose={onClose} onSubmit={failing} />);

    await user.type(screen.getByPlaceholderText('Enter meter reading (m³)'), '10');
    await user.click(screen.getByRole('button', { name: /add reading/i }));

    expect(await screen.findByText('Backend nedostupan')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('API greška iz response.data.message ima prednost nad error.message', async () => {
    const user = userEvent.setup();
    const failing = vi.fn(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      throw { response: { data: { message: 'Duplikat očitanja' } }, message: 'Request failed' } as any;
    });
    render(<GasForm open onClose={vi.fn()} onSubmit={failing} />);

    await user.type(screen.getByPlaceholderText('Enter meter reading (m³)'), '10');
    await user.click(screen.getByRole('button', { name: /add reading/i }));

    expect(await screen.findByText('Duplikat očitanja')).toBeInTheDocument();
  });

  it('Cancel dugme resetuje i zatvara bez slanja', async () => {
    const user = userEvent.setup();
    const { onSubmit, onClose } = renderForm();

    await user.type(screen.getByPlaceholderText('Enter meter reading (m³)'), '42');
    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

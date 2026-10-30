import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import axe from 'axe-core';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../locales/config';
import { GasForm } from '../GasForm';
import { THEME_STORAGE_KEY } from '../../context/ThemeContext';
// `?raw` (vite/client) daje sadržaj fajla kao string bez Node API-ja, koji nije
// dostupan u tsconfig.app.json — test ostaje u istom type-check prolazu.
import indexHtml from '../../../index.html?raw';

/**
 * FE2-13 (FE-013/FE-021): pristupačnost dijaloga i dark-mode FOUC.
 *
 * Prije ovih testova GasForm je bio običan `<div className="fixed inset-0">` bez
 * ijednog `role`/`aria` atributa, bez Escape handlera i bez focus trapa —
 * keyboard-only korisnik ga nije mogao zatvoriti, a screen reader nije
 * oglašavao modalni kontekst.
 */

type SubmitPayload = {
  counterValue: number;
  readingDate: string;
  meterImageFile?: File;
};

function renderDialog() {
  const onClose = vi.fn();
  const onSubmit = vi.fn(async (_payload: SubmitPayload) => {});
  const view = render(
    <div>
      {/* Element IZVAN dijaloga — služi za provjeru vraćanja fokusa. */}
      <button type="button" data-testid="trigger">
        Otvori formu
      </button>
      <I18nextProvider i18n={i18n}>
        <GasForm open onClose={onClose} onSubmit={onSubmit} />
      </I18nextProvider>
    </div>
  );
  return { ...view, onClose, onSubmit };
}

describe('FE2-13: GasForm dijalog — ARIA semantika', () => {
  it('ima role="dialog" i aria-modal="true"', () => {
    renderDialog();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('aria-labelledby pokazuje na stvarni naslov (ne na nepostojeći id)', () => {
    renderDialog();
    const dialog = screen.getByRole('dialog');
    const labelledBy = dialog.getAttribute('aria-labelledby');

    expect(labelledBy).toBeTruthy();
    const title = document.getElementById(labelledBy as string);
    // Screen reader čita pristupačno ime dijaloga iz ovog elementa; da id ne
    // postoji, dijalog bi bio bez imena.
    expect(title).not.toBeNull();
    expect(title?.textContent).toContain('Add Reading');
  });

  it('pristupačno ime dijaloga je čitljivo (nije prazno)', () => {
    renderDialog();
    expect(screen.getByRole('dialog')).toHaveAccessibleName(/Add Reading/);
  });
});

describe('FE2-13: GasForm dijalog — tastatura', () => {
  it('Escape zatvara dijalog', () => {
    const { onClose } = renderDialog();
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Tab s posljednjeg elementa vraća fokus na prvi (focus trap)', () => {
    renderDialog();
    const dialog = screen.getByRole('dialog');
    const submit = screen.getByRole('button', { name: 'Add Reading' });

    submit.focus();
    expect(dialog.contains(document.activeElement)).toBe(true);

    fireEvent.keyDown(dialog, { key: 'Tab' });

    const counterInput = screen.getByLabelText(/Counter Value/);
    expect(document.activeElement).toBe(counterInput);
  });

  it('Shift+Tab s prvog elementa vraća fokus na posljednji', () => {
    renderDialog();
    const dialog = screen.getByRole('dialog');
    const counterInput = screen.getByLabelText(/Counter Value/);

    counterInput.focus();
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });

    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Add Reading' })
    );
  });
});

describe('FE2-13: GasForm dijalog — upravljanje fokusom', () => {
  it('pri otvaranju prebacuje fokus u dijalog', () => {
    const onClose = vi.fn();
    const onSubmit = vi.fn(async (_payload: SubmitPayload) => {});
    const { rerender } = render(
      <div>
        <button type="button" data-testid="trigger">
          Otvori formu
        </button>
        <I18nextProvider i18n={i18n}>
          <GasForm open={false} onClose={onClose} onSubmit={onSubmit} />
        </I18nextProvider>
      </div>
    );

    const trigger = screen.getByTestId('trigger');
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    rerender(
      <div>
        <button type="button" data-testid="trigger">
          Otvori formu
        </button>
        <I18nextProvider i18n={i18n}>
          <GasForm open onClose={onClose} onSubmit={onSubmit} />
        </I18nextProvider>
      </div>
    );

    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
  });

  it('pri zatvaranju vraća fokus na element koji ga je imao', () => {
    const onClose = vi.fn();
    const onSubmit = vi.fn(async (_payload: SubmitPayload) => {});
    const tree = (open: boolean) => (
      <div>
        <button type="button" data-testid="trigger">
          Otvori formu
        </button>
        <I18nextProvider i18n={i18n}>
          <GasForm open={open} onClose={onClose} onSubmit={onSubmit} />
        </I18nextProvider>
      </div>
    );

    const { rerender } = render(tree(false));
    const trigger = screen.getByTestId('trigger');
    trigger.focus();

    rerender(tree(true));
    // Fokus je u dijalogu, pa više NIJE na triggeru.
    expect(document.activeElement).not.toBe(trigger);

    rerender(tree(false));
    // Bez vraćanja fokusa korisnik bi ostao na <body> i morao bi tabati od
    // početka stranice.
    expect(document.activeElement).toBe(trigger);
  });
});

describe('FE2-13: axe sken', () => {
  it('GasForm nema serious/critical axe nalaza', async () => {
    const { container } = renderDialog();

    const results = await axe.run(container, {
      rules: {
        // jsdom nema layout engine, pa pravila koja ovise o stvarnoj
        // vidljivosti/kontrastu piksela ne mogu biti pouzdano izračunata.
        'color-contrast': { enabled: false },
      },
    });

    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical'
    );
    expect(serious).toEqual([]);
  });
});

describe('FE2-13: dark mode FOUC', () => {
  it('index.html ima inline skriptu koja postavlja klasu prije rendera', () => {
    // Skripta MORA biti u <head>, dakle prije <div id="root">, inače se izvrši
    // prekasno i FOUC ostaje.
    const headStart = indexHtml.indexOf('<head>');
    const rootDiv = indexHtml.indexOf('<div id="root">');
    const scriptAt = indexHtml.indexOf("classList.add('dark')");

    expect(headStart).toBeGreaterThan(-1);
    expect(rootDiv).toBeGreaterThan(-1);
    expect(scriptAt).toBeGreaterThan(headStart);
    expect(scriptAt).toBeLessThan(rootDiv);
  });

  it('inline skripta čita ISTI localStorage ključ kao ThemeContext', () => {
    // Ključ se uspoređuje sa STVARNOM izvezenom konstantom, ne regexom nad
    // tekstom izvora — ako se ključ promijeni, ovaj test pada.
    expect(THEME_STORAGE_KEY).toBe('boiler.theme');
    // Ako se ključ u ThemeContext-u promijeni a ovdje ne, dark mode bi se
    // resetovao pri svakom reloadu — upravo bug koji ova skripta rješava.
    expect(indexHtml).toContain(`localStorage.getItem('${THEME_STORAGE_KEY}')`);
  });
});

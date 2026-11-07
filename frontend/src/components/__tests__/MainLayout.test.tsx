import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import i18n from 'i18next';
import { MainLayout } from '../MainLayout';
import { SHELL_NAV_ITEMS } from '../shell-nav-items';
import '../../locales/config';

const logout = vi.fn();

vi.mock('../../features/auth/hooks/useAuth', () => ({
  useAuth: () => ({
    logout,
    user: {
      id: 1,
      email: 'a@b.c',
      name: 'Ana',
      role: 'ADMIN',
    },
  }),
}));

vi.mock('../../context/ThemeContext', () => ({
  useThemeMode: () => ({
    mode: 'light',
    toggleMode: vi.fn(),
  }),
}));

describe('MainLayout shell (I2)', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('en-US');
  });

  beforeEach(() => {
    logout.mockClear();
  });

  it('exposes main-content for the skip link and shows role', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <MainLayout>
          <p>child</p>
        </MainLayout>
      </MemoryRouter>,
    );

    const skip = screen.getByRole('link', { name: /skip to main content/i });
    expect(skip).toHaveAttribute('href', '#main-content');
    expect(document.getElementById('main-content')).not.toBeNull();
    expect(screen.getByText(/Role: ADMIN/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /open navigation/i }));
    const dialog = screen.getByRole('dialog', { name: /menu/i });
    const hrefs = within(dialog)
      .getAllByRole('link')
      .map((el) => el.getAttribute('href'));
    for (const item of SHELL_NAV_ITEMS) {
      expect(hrefs).toContain(item.href);
    }
  });

  it('closes the mobile drawer on Escape', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <MainLayout>
          <p>child</p>
        </MainLayout>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: /open navigation/i }));
    expect(screen.getByRole('dialog', { name: /menu/i })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: /menu/i })).not.toBeInTheDocument();
  });
});

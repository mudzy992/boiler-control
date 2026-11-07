import type { ReactElement } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { QueryClient } from '@tanstack/react-query';
import i18n from '../../../locales/config';
import { queryKeys } from '../../../lib/queryKeys';
import { invalidateQueriesAfterTempSet } from '../../lib/invalidate-after-temp-set';
import { ConfirmDialog } from '../confirm-dialog';
import { TempDialog } from '../temp-dialog';

const renderWithI18n = (ui: ReactElement) =>
  render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);

describe('I5 TempDialog + ConfirmDialog', () => {
  it('TempDialog accepts boundary 48 and rejects below', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const { rerender } = renderWithI18n(
      <TempDialog open initialValue={48} onOpenChange={vi.fn()} onSubmit={onSubmit} />,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: i18n.t('tempDialog.save') }));
    expect(onSubmit).toHaveBeenCalledWith(48);

    onSubmit.mockClear();
    rerender(
      <I18nextProvider i18n={i18n}>
        <TempDialog open initialValue={47.9} onOpenChange={vi.fn()} onSubmit={onSubmit} />
      </I18nextProvider>,
    );
    await user.click(screen.getByRole('button', { name: i18n.t('tempDialog.save') }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('TempDialog accepts boundary 55', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderWithI18n(
      <TempDialog open initialValue={55} onOpenChange={vi.fn()} onSubmit={onSubmit} />,
    );
    await user.click(screen.getByRole('button', { name: i18n.t('tempDialog.save') }));
    expect(onSubmit).toHaveBeenCalledWith(55);
  });

  it('ConfirmDialog confirms and closes on Escape', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    renderWithI18n(
      <ConfirmDialog
        open
        title="Delete reading?"
        description="This cannot be undone"
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
        variant="destructive"
      />,
    );
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Delete reading?');
    await user.click(screen.getByRole('button', { name: i18n.t('common.confirm') }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('invalidateQueriesAfterTempSet hits boiler + dashboard keys', async () => {
    const queryClient = new QueryClient();
    const spy = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);
    await invalidateQueriesAfterTempSet(queryClient);
    const keys = spy.mock.calls.map((call) => call[0]?.queryKey);
    expect(keys).toContainEqual(queryKeys.boilerEvents);
    expect(keys).toContainEqual(queryKeys.dashboard);
    expect(keys).toContainEqual(queryKeys.dashboardHealth);
  });
});

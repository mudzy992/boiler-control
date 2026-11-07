import type { ReactElement } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../locales/config';
import { PageHeader } from '../page-header';
import { QueryState } from '../query-state';
import { StatCard } from '../stat-card';
import { StatusBanner } from '../status-banner';

const renderWithI18n = (ui: ReactElement) =>
  render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);

describe('I4 shared states', () => {
  it('PageHeader renders a single h1 with optional action', () => {
    renderWithI18n(
      <PageHeader title="Dashboard" description="Overview" action={<button type="button">Add</button>} />,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
  });

  it('QueryState shows loading, error with retry, and empty', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const { rerender } = renderWithI18n(<QueryState status="loading" />);
    expect(screen.getByRole('status')).toBeInTheDocument();

    rerender(
      <I18nextProvider i18n={i18n}>
        <QueryState status="error" errorMessage="Boom" onRetry={onRetry} />
      </I18nextProvider>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Boom');
    await user.click(screen.getByRole('button', { name: i18n.t('common.retry') }));
    expect(onRetry).toHaveBeenCalledTimes(1);

    rerender(
      <I18nextProvider i18n={i18n}>
        <QueryState status="empty" emptyMessage="Nothing here" />
      </I18nextProvider>,
    );
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });

  it('QueryState success renders children', () => {
    renderWithI18n(
      <QueryState status="success">
        <p>Ready</p>
      </QueryState>,
    );
    expect(screen.getByText('Ready')).toBeInTheDocument();
  });

  it('StatCard shows title, value, and trend', () => {
    renderWithI18n(
      <StatCard title="Health" value={88} suffix="%" trend="up" trendValue="+2" />,
    );
    expect(screen.getByText('Health')).toBeInTheDocument();
    expect(screen.getByText('88')).toBeInTheDocument();
    expect(screen.getByText('%')).toBeInTheDocument();
    expect(screen.getByText('+2')).toBeInTheDocument();
  });

  it('StatusBanner uses alert for error and status for success', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    const { rerender } = renderWithI18n(
      <StatusBanner variant="success" message="Saved" onDismiss={onDismiss} dismissLabel="Close" />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Saved');
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);

    rerender(
      <I18nextProvider i18n={i18n}>
        <StatusBanner variant="error" message="Failed" />
      </I18nextProvider>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Failed');
  });
});

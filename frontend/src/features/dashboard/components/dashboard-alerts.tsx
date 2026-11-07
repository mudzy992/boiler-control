import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { StatusBanner } from '@/shared/components/status-banner';
import type { StatusBannerVariant } from '@/shared/components/status-banner';

interface HealthWarning {
  level: string;
  message: string;
}

interface DashboardAlertsProps {
  warnings: HealthWarning[];
}

const toVariant = (level: string): StatusBannerVariant => {
  if (level === 'error') return 'error';
  if (level === 'warning') return 'warning';
  if (level === 'success') return 'success';
  return 'info';
};

export const DashboardAlerts = ({
  warnings,
}: DashboardAlertsProps): JSX.Element | null => {
  const { t } = useTranslation();
  if (warnings.length === 0) return null;

  return (
    <section className="space-y-2" aria-label={t('dashboard.alertsTitle')}>
      <h2 className="text-sm font-semibold">{t('dashboard.alertsTitle')}</h2>
      {warnings.map((w, idx) => (
        <StatusBanner
          key={`${w.level}-${idx}`}
          variant={toVariant(w.level)}
          message={w.message}
        />
      ))}
    </section>
  );
};

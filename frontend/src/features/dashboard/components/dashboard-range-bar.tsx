import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Label } from '@/shared/components/ui/Label';

interface DashboardRangeBarProps {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
}

export const DashboardRangeBar = ({
  from,
  to,
  onFromChange,
  onToChange,
}: DashboardRangeBarProps): JSX.Element => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label htmlFor="dashboard-from">{t('dashboard.from')}</Label>
        <input
          id="dashboard-from"
          type="date"
          value={from}
          onChange={(e) => {
            if (e.target.value) onFromChange(e.target.value);
          }}
          className="block w-44 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="dashboard-to">{t('dashboard.to')}</Label>
        <input
          id="dashboard-to"
          type="date"
          value={to}
          onChange={(e) => {
            if (e.target.value) onToChange(e.target.value);
          }}
          className="block w-44 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
    </div>
  );
};

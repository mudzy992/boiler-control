import type { JSX } from 'react';
import { Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { QueryState } from '@/shared/components/query-state';
import { Label } from '@/shared/components/ui/Label';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/shared/components/ui/sheet';
import { Switch } from '@/shared/components/ui/switch';

interface PreferenceItem {
  type: string;
  enabled: boolean;
}

interface DashboardPrefsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  isError: boolean;
  onRetry: () => void;
  preferences: PreferenceItem[];
  onToggle: (type: string, enabled: boolean) => void;
}

const PREF_KEYS: Record<string, { label: string; desc: string }> = {
  DAILY_RECOMMENDATION: {
    label: 'notifications.daily',
    desc: 'dashboard.prefDailyDesc',
  },
  FLOW_TEMP_CHANGED: {
    label: 'dashboard.prefFlow',
    desc: 'dashboard.prefFlowDesc',
  },
  HEATING_STARTED: {
    label: 'dashboard.prefHeatStart',
    desc: 'dashboard.prefHeatStartDesc',
  },
  HEATING_ENDED: {
    label: 'dashboard.prefHeatEnd',
    desc: 'dashboard.prefHeatEndDesc',
  },
  SYSTEM_ALERT: {
    label: 'notifications.alerts',
    desc: 'dashboard.prefAlertDesc',
  },
  GAS_READING_REMINDER: {
    label: 'notifications.gasReminder',
    desc: 'dashboard.prefGasDesc',
  },
};

export const DashboardPrefsSheet = ({
  open,
  onOpenChange,
  loading,
  isError,
  onRetry,
  preferences,
  onToggle,
}: DashboardPrefsSheetProps): JSX.Element => {
  const { t } = useTranslation();
  const status = loading
    ? 'loading'
    : isError
      ? 'error'
      : preferences.length === 0
        ? 'empty'
        : 'success';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Settings className="h-4 w-4" aria-hidden />
            {t('notifications.preferences')}
          </SheetTitle>
        </SheetHeader>
        <div className="mt-4">
          <QueryState
            status={status}
            emptyMessage={t('dashboard.prefsEmpty')}
            onRetry={onRetry}
          >
            <ul className="space-y-3">
              {preferences.map((pref) => {
                const keys = PREF_KEYS[pref.type];
                return (
                  <li
                    key={pref.type}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                  >
                    <div className="min-w-0">
                      <Label htmlFor={`pref-${pref.type}`} className="font-semibold">
                        {keys ? t(keys.label) : pref.type}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {keys ? t(keys.desc) : t('dashboard.prefFallback')}
                      </p>
                    </div>
                    <Switch
                      id={`pref-${pref.type}`}
                      checked={pref.enabled}
                      onCheckedChange={(checked) =>
                        onToggle(pref.type, checked)
                      }
                    />
                  </li>
                );
              })}
            </ul>
          </QueryState>
        </div>
      </SheetContent>
    </Sheet>
  );
};

import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/components/ui/Button';
import { Card, CardContent } from '@/shared/components/ui/Card';
import { DateRangeFilter, type DateRange } from '@/shared/components/table-controls';

interface GasAnalyticsPeriodBarProps {
  periodDays: number;
  useDefaultReferenceRange: boolean;
  onSelectReference: () => void;
  onSelectDays: (days: number) => void;
  /** Ručni raspon „od–do" (`36`); prazan = koristi se brzi izbor ili referenca. */
  customRange: DateRange;
  onCustomRange: (next: DateRange) => void;
}

export const GasAnalyticsPeriodBar = ({
  periodDays,
  useDefaultReferenceRange,
  onSelectReference,
  onSelectDays,
  customRange,
  onCustomRange,
}: GasAnalyticsPeriodBarProps): JSX.Element => {
  const { t } = useTranslation();
  const options: Array<{ label: string; days: number | null }> = [
    { label: t('gas.periodReferenceCurrent'), days: null },
    { label: '7d', days: 7 },
    { label: '14d', days: 14 },
    { label: '30d', days: 30 },
    { label: '90d', days: 90 },
    { label: '1y', days: 365 },
  ];

  return (
    <Card>
      <CardContent className="space-y-3 pt-4 sm:pt-5">
        <p className="text-sm font-medium text-muted-foreground">{t('gas.analyzePeriod')}</p>
        <div className="flex flex-wrap gap-2">
          {options.map((option) => {
            const active =
              option.days === null
                ? useDefaultReferenceRange && !customRange.from && !customRange.to
                : !useDefaultReferenceRange &&
                  !customRange.from &&
                  !customRange.to &&
                  periodDays === option.days;
            return (
              <Button
                key={String(option.days)}
                type="button"
                size="sm"
                variant={active ? 'default' : 'ghost'}
                onClick={() => {
                  if (option.days === null) {
                    onSelectReference();
                    return;
                  }
                  onSelectDays(option.days);
                }}
              >
                {option.label}
              </Button>
            );
          })}
        </div>
        {/*
         * Brzi izbor (7d/30d/…) je neprecizan za pitanja tipa „koliko sam
         * potrošio između dva očitanja". Ručni raspon ih zamjenjuje; kad je
         * postavljen, nijedno dugme nije aktivno — šta se gleda piše u kartici
         * perioda ispod.
         */}
        <div className="border-t border-border pt-3">
          <DateRangeFilter
            idPrefix="gas-analytics-range"
            label={t('gas.periodCustom')}
            value={customRange}
            onChange={onCustomRange}
          />
        </div>
      </CardContent>
    </Card>
  );
};

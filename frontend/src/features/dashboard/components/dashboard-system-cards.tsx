import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MAX_CURRENT_FLOW_TEMP,
  MIN_CURRENT_FLOW_TEMP,
} from '@/constants/boilerLimits';
import { Button } from '@/shared/components/ui/Button';
import { Card, CardContent } from '@/shared/components/ui/Card';
import type { Boiler, WeatherDisplay } from '../types';

interface DashboardSystemCardsProps {
  weather: WeatherDisplay | null;
  boiler: Boiler;
  onSetTemp: () => void;
}

export const DashboardSystemCards = ({
  weather,
  boiler,
  onSetTemp,
}: DashboardSystemCardsProps): JSX.Element => {
  const { t } = useTranslation();
  const actual =
    typeof boiler.actualFlowTemp === 'number' ? boiler.actualFlowTemp : null;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card variant="elevated">
        <CardContent className="space-y-3 pt-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {t('dashboard.outsideTemp')}
          </p>
          <p className="font-mono text-3xl font-semibold tracking-tight text-foreground">
            {weather?.outsideTemp != null
              ? `${Number(weather.outsideTemp).toFixed(1)}`
              : '—'}
            <span className="ml-1 text-base text-muted-foreground">°C</span>
          </p>
          {weather ? (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t('dashboard.feelsLike')}</dt>
                <dd>
                  {weather.feelsLike != null
                    ? `${Number(weather.feelsLike).toFixed(1)}°C`
                    : '—'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t('dashboard.condition')}</dt>
                <dd>{weather.condition ?? '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t('dashboard.humidity')}</dt>
                <dd>{weather.humidity != null ? `${weather.humidity}%` : '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t('dashboard.wind')}</dt>
                <dd>
                  {weather.windSpeed != null ? `${weather.windSpeed} km/h` : '—'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t('dashboard.minMax')}</dt>
                <dd>
                  {weather.tempMin ?? '—'}°C / {weather.tempMax ?? '—'}°C
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">{t('dashboard.noWeather')}</p>
          )}
        </CardContent>
      </Card>

      <Card variant="elevated">
        <CardContent className="space-y-3 pt-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {t('dashboard.boilerStatus')}
          </p>
          <p className="font-mono text-3xl font-semibold tracking-tight text-brand">
            {actual != null ? actual.toFixed(1) : '—'}
            <span className="ml-1 text-base text-muted-foreground">°C</span>
          </p>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{t('dashboard.suggestedFlow')}</dt>
              <dd>{boiler.suggestedFlowTemp.toFixed(1)}°C</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{t('dashboard.actualFlow')}</dt>
              <dd>{actual != null ? `${actual.toFixed(1)}°C` : '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{t('dashboard.delta')}</dt>
              <dd>
                {actual != null
                  ? `${(actual - boiler.suggestedFlowTemp).toFixed(1)}°C`
                  : '—'}
              </dd>
            </div>
          </dl>
          <Button type="button" className="w-full" size="sm" onClick={onSetTemp}>
            {t('dashboard.setCurrentTemp')}
          </Button>
          <p className="text-xs text-muted-foreground">
            {t('tempDialog.range', {
              min: MIN_CURRENT_FLOW_TEMP,
              max: MAX_CURRENT_FLOW_TEMP,
            })}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

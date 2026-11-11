import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DEFAULT_FLOW_RANGE,
  type FlowRange,
} from '@/constants/boilerLimits';
import { Button } from '@/shared/components/ui/Button';
import { Card, CardContent } from '@/shared/components/ui/Card';
import { formatOneDecimal } from '../lib/weather-format';
import type { Boiler, WeatherDisplay } from '../types';

interface DashboardSystemCardsProps {
  weather: WeatherDisplay | null;
  boiler: Boiler;
  onSetTemp: () => void;
  /**
   * Raspon iz `GET /api/boiler/flow-range` (šesti krug).
   *
   * Prije je ovdje pisalo `MIN/MAX_CURRENT_FLOW_TEMP` — dvije konstante, pa je
   * kartica tvrdila „46–55" i kad server za taj kotao dozvoljava 30–55. Broj
   * koji se prikaže mora biti isti broj koji forma prihvata.
   */
  flowRange?: FlowRange;
}

export const DashboardSystemCards = ({
  weather,
  boiler,
  onSetTemp,
  flowRange = DEFAULT_FLOW_RANGE,
}: DashboardSystemCardsProps): JSX.Element => {
  const { t } = useTranslation();
  const actual =
    typeof boiler.actualFlowTemp === 'number' ? boiler.actualFlowTemp : null;
  const outside = formatOneDecimal(weather?.outsideTemp);
  const feelsLike = formatOneDecimal(weather?.feelsLike);
  const wind = formatOneDecimal(weather?.windSpeed);
  const tempMin = formatOneDecimal(weather?.tempMin);
  const tempMax = formatOneDecimal(weather?.tempMax);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card variant="elevated">
        <CardContent className="space-y-3 pt-4 sm:pt-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {t('dashboard.outsideTemp')}
          </p>
          <p className="font-mono text-3xl font-semibold tracking-tight text-foreground">
            {outside ?? '—'}
            <span className="ml-1 text-base text-muted-foreground">°C</span>
          </p>
          {weather ? (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t('dashboard.feelsLike')}</dt>
                <dd>{feelsLike != null ? `${feelsLike}°C` : '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t('dashboard.condition')}</dt>
                <dd>
                  {weather.condition
                    ? t(`weather.conditions.${weather.condition}`, {
                        defaultValue: weather.condition,
                      })
                    : '—'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t('dashboard.humidity')}</dt>
                <dd>{weather.humidity != null ? `${weather.humidity}%` : '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t('dashboard.wind')}</dt>
                <dd>{wind != null ? `${wind} km/h` : '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t('dashboard.minMax')}</dt>
                <dd>
                  {tempMin ?? '—'}°C / {tempMax ?? '—'}°C
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">{t('dashboard.noWeather')}</p>
          )}
        </CardContent>
      </Card>

      <Card variant="elevated">
        <CardContent className="space-y-3 pt-4 sm:pt-5">
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
          <Button type="button" variant="outline" className="w-full" onClick={onSetTemp}>
            {t('dashboard.setCurrentTemp')}
          </Button>
          <p className="text-xs text-muted-foreground">
            {t('tempDialog.range', {
              min: flowRange.min,
              max: flowRange.max,
            })}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

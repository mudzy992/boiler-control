import { StyleSheet, TextInput, View } from 'react-native';

import { useTranslation } from '../hooks/useTranslation';
import { useTokens } from '../ui/theme';
import { MonoLabel, MonoMeta, Panel, PanelRow, Readout, Text } from '../ui';
import type { TodayWeather } from '../types/Weather';

/**
 * `WeatherRow` — vrijeme kao jedan red, ne kao kartica sa ikonom od 96px.
 *
 * Prije (nalaz UX-08 / prototip §02): vrijeme je zauzimalo ~200px za podatak koji
 * na Početnoj nije odluka — velika ikona u punom krugu plus tri podkartice.
 * Sada: jedan red sa temperaturom, stanjem i dvije mjerne jedinice u mono meti.
 */

type WeatherRowProps = {
  weather?: TodayWeather | null;
  isFetching?: boolean;
};

/**
 * F8 (HOME-05): stanje vremena dolazi sa backenda na ENGLESKOM („Cloudy",
 * „Light rain", „Clear"), pa je u bosanskom UI-ju stajalo engleski — korisnik
 * je tražio „prevode adekvatne". Umjesto prevođenja proizvoljnog teksta
 * (što bi bilo pogađanje), prevode se POZNATA stanja po ključu; sve nepoznato
 * se prikazuje kako je stiglo, bez izmišljanja.
 *
 * Vrijednost se normalizuje (mala slova, bez razmaka) da bi „Partly cloudy",
 * „PARTLY_CLOUDY" i „partlyCloudy" pogodili isti ključ.
 */
const CONDITION_KEYS: Record<string, string> = {
  clear: 'weather.conditionClear',
  sunny: 'weather.conditionClear',
  clouds: 'weather.conditionCloudy',
  cloudy: 'weather.conditionCloudy',
  overcast: 'weather.conditionOvercast',
  partlycloudy: 'weather.conditionPartlyCloudy',
  fewclouds: 'weather.conditionPartlyCloudy',
  scatteredclouds: 'weather.conditionPartlyCloudy',
  brokenclouds: 'weather.conditionPartlyCloudy',
  rain: 'weather.conditionRain',
  lightrain: 'weather.conditionLightRain',
  moderaterain: 'weather.conditionRain',
  heavyintensityrain: 'weather.conditionHeavyRain',
  showerrain: 'weather.conditionShowers',
  drizzling: 'weather.conditionDrizzle',
  drizzle: 'weather.conditionDrizzle',
  thunderstorm: 'weather.conditionThunderstorm',
  snow: 'weather.conditionSnow',
  lightsnow: 'weather.conditionLightSnow',
  mist: 'weather.conditionMist',
  fog: 'weather.conditionFog',
  haze: 'weather.conditionHaze',
  smoky: 'weather.conditionHaze',
  windy: 'weather.conditionWindy',
};

function conditionKey(condition: string | undefined): string | null {
  if (!condition) return null;
  const normalized = condition.toLowerCase().replace(/[\s_-]+/g, '');
  return CONDITION_KEYS[normalized] ?? null;
}

export function WeatherRow({ weather, isFetching = false }: WeatherRowProps) {
  const { t } = useTranslation();

  const translatedConditionKey = conditionKey(weather?.condition);
  const translatedCondition = translatedConditionKey
    ? t(translatedConditionKey)
    : (weather?.condition ?? '');

  if (!weather) {
    return (
      <Panel variant="flush" padded={false}>
        <PanelRow divider={false}>
          <Text tone="muted" size="body">
            {t('dashboard.noData')}
          </Text>
        </PanelRow>
      </Panel>
    );
  }

  return (
    <Panel variant="flush" padded={false} testID="weather-row">
      <PanelRow divider={false}>
        <View style={styles.row}>
          <View style={styles.left}>
            <MonoLabel>{t('weather.current')}</MonoLabel>
            <Readout
              value={Number(weather.temp).toFixed(0)}
              unit="°C"
              size="md"
              tone="ink"
              accessibilityLabel={`${t('weather.current')}: ${weather.temp} °C`}
            />
          </View>
          <View style={styles.meta}>
            <Text size="body" weight="medium" numberOfLines={1}>
              {translatedCondition}
            </Text>
            {/* F8 (HOME-05): „osjećaj" uz trenutnu temperaturu — isti podatak
                koji je ranije stajao u KPI pločici „Vani". */}
            {weather.feelsLike != null ? (
              <MonoMeta>
                {t('weather.feelsLike', { value: Number(weather.feelsLike).toFixed(0) })}
              </MonoMeta>
            ) : null}
            <MonoMeta>
              {`${weather.humidity}% · ${Number(weather.windSpeed).toFixed(1)} ${t(
                'weather.windUnit',
              )} · ${Number(weather.pressure).toFixed(0)} ${t('weather.pressureUnit')}`}
            </MonoMeta>
          </View>
          {isFetching ? <MonoMeta>{t('common.loading')}</MonoMeta> : null}
        </View>
      </PanelRow>
    </Panel>
  );
}

/** Unos broja u bottom sheetu: jedna linija, mono, tabularna. */
export function TemperatureField({
  value,
  onChangeText,
  placeholder,
  editable = true,
  accessibilityLabel,
}: {
  value: string;
  onChangeText: (next: string) => void;
  placeholder?: string;
  editable?: boolean;
  accessibilityLabel?: string;
}) {
  const { t, fonts } = useTokens();

  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      keyboardType="decimal-pad"
      placeholder={placeholder}
      placeholderTextColor={t.inkDim}
      editable={editable}
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.input,
        {
          fontFamily: fonts.monoSemiBold,
          color: t.ink,
          backgroundColor: t.raised,
          borderColor: t.line,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  left: {
    gap: 2,
    minWidth: 84,
  },
  meta: {
    flex: 1,
    gap: 2,
  },
  input: {
    borderWidth: 1,
    borderRadius: 3,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 18,
  },
});

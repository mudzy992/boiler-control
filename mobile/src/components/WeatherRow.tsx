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

export function WeatherRow({ weather, isFetching = false }: WeatherRowProps) {
  const { t } = useTranslation();

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
              {weather.condition}
            </Text>
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

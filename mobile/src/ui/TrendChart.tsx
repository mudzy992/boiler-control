/**
 * `TrendChart` — jedan linijski graf na `react-native-svg` (F3, nalaz UX-18).
 *
 * Zašto:
 *  1. `react-native-chart-kit` je bio treća biblioteka za grafove, sa sopstvenim
 *     vizuelnim jezikom (plava linija koje nema nigdje drugdje) i širinom iz
 *     `Dimensions.get('window')`, pa se graf lomio pri rotaciji i na tabletu.
 * 2. `react-native-svg` je već instaliran (15.16.0) i već se koristi — nema
 *     nove zavisnosti, a `onLayout` daje stvarnu širinu kontejnera.
 *
 * Graf namjerno NEMA tooltip ni zumiranje: to je nova interakcija koja traži
 * svoj a11y obrazac, a vrijednosti su dostupne iznad grafa (min/max/prosjek).
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';

import { radius } from '../theme/tokens';
import { useTokens } from './theme';
import { MonoMeta, MonoLabel } from './Text';

export type TrendPoint = {
  label: string;
  value: number;
};

export type TrendChartProps = {
  points: readonly TrendPoint[];
  /** Cilj (npr. prosječna ciljna temperatura) — crta se kao isprekidana linija. */
  target?: number;
  height?: number;
  /** Labela za čitač ekrana; bez nje se graf preskače (dekorativan). */
  accessibilityLabel?: string;
  testID?: string;
};

const PADDING_X = 6;
const PADDING_TOP = 10;
const PADDING_BOTTOM = 16;

export function TrendChart({
  points,
  target,
  height = 140,
  accessibilityLabel,
  testID,
}: TrendChartProps) {
  const { t, fonts } = useTokens();
  const [width, setWidth] = React.useState(0);

  const values = points.map((point) => point.value).filter((value) => Number.isFinite(value));
  const hasData = points.length > 1 && values.length > 1;

  const min = hasData ? Math.min(...values) : 0;
  const max = hasData ? Math.max(...values) : 1;
  // Cilj ulazi u raspon, inače bi isprekidana linija izašla van grafa.
  const domainMin = target !== undefined ? Math.min(min, target) : min;
  const domainMax = target !== undefined ? Math.max(max, target) : max;
  const span = domainMax - domainMin || 1;

  const innerHeight = height - PADDING_TOP - PADDING_BOTTOM;
  const innerWidth = Math.max(0, width - PADDING_X * 2);

  const toXY = (value: number, index: number) => {
    const step = points.length > 1 ? innerWidth / (points.length - 1) : innerWidth;
    const x = PADDING_X + index * step;
    const y = PADDING_TOP + innerHeight - ((value - domainMin) / span) * innerHeight;
    return { x, y };
  };

  const polyline = hasData
    ? points
        .map((point, index) => {
          const { x, y } = toXY(point.value, index);
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(' ')
    : '';

  const targetY =
    target !== undefined
      ? PADDING_TOP + innerHeight - ((target - domainMin) / span) * innerHeight
      : undefined;

  return (
    <View
      testID={testID}
      accessible={Boolean(accessibilityLabel)}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={{ height }}
    >
      {hasData && width > 0 ? (
        <Svg width={width} height={height}>
          {/* Hairline osnovica — dubinu nosi linija, ne sjena. */}
          <Line
            x1={PADDING_X}
            y1={PADDING_TOP + innerHeight}
            x2={width - PADDING_X}
            y2={PADDING_TOP + innerHeight}
            stroke={t.line}
            strokeWidth={1}
          />
          {targetY !== undefined ? (
            <Line
              x1={PADDING_X}
              y1={targetY}
              x2={width - PADDING_X}
              y2={targetY}
              stroke={t.lineStrong}
              strokeWidth={1}
              strokeDasharray="4 4"
            />
          ) : null}
          <Polyline
            points={polyline}
            fill="none"
            stroke={t.signal}
            strokeWidth={1.6}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {/* Tačka na zadnjoj vrijednosti: gdje je korisnik SADA. */}
          {(() => {
            const last = toXY(points[points.length - 1].value, points.length - 1);
            return <Circle cx={last.x} cy={last.y} r={3} fill={t.signal} />;
          })()}
        </Svg>
      ) : null}

      {hasData ? (
        <View style={[styles.axis, { paddingHorizontal: PADDING_X }]}>
          <MonoMeta style={{ fontFamily: fonts.mono }}>
            {points[0].label}
          </MonoMeta>
          <MonoMeta style={{ fontFamily: fonts.mono }}>
            {points[points.length - 1].label}
          </MonoMeta>
        </View>
      ) : null}
    </View>
  );
}

/** Min / max / prosjek ispod grafa — brojevi, ne tooltip. */
export function TrendSummary({
  points,
  unit,
}: {
  points: readonly TrendPoint[];
  unit?: string;
}) {
  const values = points.map((point) => point.value).filter((value) => Number.isFinite(value));
  if (values.length === 0) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;

  return (
    <View style={styles.summary}>
      <MonoLabel>{`min ${min.toFixed(1)}${unit ? ` ${unit}` : ''}`}</MonoLabel>
      <MonoLabel>{`avg ${avg.toFixed(1)}${unit ? ` ${unit}` : ''}`}</MonoLabel>
      <MonoLabel>{`max ${max.toFixed(1)}${unit ? ` ${unit}` : ''}`}</MonoLabel>
    </View>
  );
}

const styles = StyleSheet.create({
  axis: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 6,
  },
  emptyBox: {
    flex: 1,
    borderRadius: radius.panel,
  },
});

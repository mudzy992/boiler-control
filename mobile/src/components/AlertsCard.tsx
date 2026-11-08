import React from 'react';
import { View } from 'react-native';

import { useTranslation } from '../hooks/useTranslation';
import {
  mapHealthWarningsToAlerts,
  type HealthAlertSeverity,
} from '../services/dashboard/healthAlerts';
import type { HealthWarning } from '../types/Dashboard';
import { MonoMeta, Panel, PanelRow, Text } from '../ui';
import { useTokens } from '../ui/theme';

interface AlertsCardProps {
  warnings?: HealthWarning[];
}

/**
 * Alerti sa Početne (F7, HOME-04).
 *
 * MO2-12 ostaje: prikazuje se samo `GET /api/dashboard/health`, klijent ne
 * računa pragove.
 *
 * Šta je bilo pogrešno: kartica je bila naslijeđena iz starog sloja — tri
 * „soft" nijanse (`red.100`, `orange.100`, `blue.100`) sa po tri boje u svakoj
 * (9 `useColorModeValue` poziva), `rounded="lg"` (12 px) i font 12 naspram 13
 * u ostatku aplikacije. Na dark temi `red.100`/`orange.100` su praktično bijele
 * ploče sa svijetlim tekstom, pa se alert jedva čitao.
 *
 * Sada: isti `Panel`/`PanelRow` obrazac kao svaki drugi blok — hairline ivica,
 * radijus 4, `Led` koji nosi boju ozbiljnosti, tekst koji nosi značenje. Boja
 * se troši samo na točku i na lijevu ivicu, pa alert ne izgleda kao druga
 * aplikacija unutar ekrana. Crvena/narandžasta/plava su sada semantički
 * `fault`/`warn`/`info` tokeni, dakle u obje teme imaju AA kontrast.
 */
const SEVERITY_LED: Record<HealthAlertSeverity, 'fault' | 'warn' | 'info'> = {
  critical: 'fault',
  warning: 'warn',
  info: 'info',
};

const SEVERITY_LABEL: Record<HealthAlertSeverity, string> = {
  critical: 'health.severityCritical',
  warning: 'health.severityWarning',
  info: 'health.severityInfo',
};

export const AlertsCard = React.memo(function AlertsCard({ warnings = [] }: AlertsCardProps) {
  const { t } = useTranslation();
  const { t: tokens } = useTokens();

  const alerts = mapHealthWarningsToAlerts(warnings);
  if (alerts.length === 0) return null;

  return (
    <Panel variant="flush" padded={false} testID="dashboard-alerts">
      {alerts.map((alert, index) => {
        const tone = SEVERITY_LED[alert.severity];
        const accent =
          tone === 'fault' ? tokens.fault : tone === 'warn' ? tokens.warn : tokens.info;
        return (
          <PanelRow
            key={alert.id}
            divider={index < alerts.length - 1}
            accessibilityLabel={`${t(SEVERITY_LABEL[alert.severity])}: ${t(alert.titleKey)}. ${
              alert.message
            }`}
          >
            <View style={{ flexDirection: 'row', gap: 10, flex: 1 }}>
              <View
                style={{
                  width: 2,
                  borderRadius: 1,
                  backgroundColor: accent,
                  alignSelf: 'stretch',
                }}
              />
              <View style={{ flex: 1, gap: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View
                    style={{ width: 6, height: 6, borderRadius: 999, backgroundColor: accent }}
                  />
                  <MonoMeta tone={tone === 'fault' ? 'fault' : tone === 'warn' ? 'warn' : 'info'}>
                    {t(SEVERITY_LABEL[alert.severity])}
                  </MonoMeta>
                </View>
                <Text size="bodyLg" weight="medium">
                  {t(alert.titleKey)}
                </Text>
                {alert.message ? (
                  <Text size="body" tone="muted">
                    {alert.message}
                  </Text>
                ) : null}
              </View>
            </View>
          </PanelRow>
        );
      })}
    </Panel>
  );
});

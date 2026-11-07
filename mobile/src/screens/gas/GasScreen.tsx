import React, { useState } from 'react';
import { useNavigation } from '@react-navigation/native';

import { GasReadingsScreen } from './GasReadingsScreen';
import { GasAnalysisScreen } from './GasAnalysisScreen';
import { Segmented } from '../../ui';
import { useTranslation } from '../../hooks/useTranslation';

type GasView = 'readings' | 'analysis';

/**
 * Plin — jedan ekran, dvije sekcije.
 *
 * F1 (nalaz UX-03): prije je ovdje bio `createBottomTabNavigator` sa rutama
 * `Readings` / `Analysis`, dakle DRUGI tab bar ugniježđen u glavni. Dvije trake
 * su trošile ~112px na 800px ekrana i tražile od korisnika da nauči koja šta
 * mijenja. Sada je to `Segmented` kontrola u zaglavlju ekrana — ista traka,
 * jedan nivo navigacije.
 *
 * Kompatibilnost (ne diramo `constants/routes.ts` ni instalirane verzije):
 *  - screen ostaje dostupan pod istim imenom iz glavnog tab navigatora (`Gas`);
 *  - `GAS_TAB_SCREENS.Readings` / `.Analysis` ostaju vrijednosti koje deep link
 *    i push notifikacija prosljeđuju kao `params.screen`, pa se ovdje prevode u
 *    početni `view`. Tako `myapp://gas/add-reading` i dalje otvara Očitanja.
 */

type GasScreenProps = {
  route?: { params?: { screen?: string } };
};

const GasScreenContent: React.FC<GasScreenProps> = ({ route }) => {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const requested = route?.params?.screen;

  const [view, setView] = useState<GasView>(requested === 'Analysis' ? 'analysis' : 'readings');

  // Duboki link može stići dok je ekran već montiran — tada `nav state` mijenja
  // parametre, a ne `mount`. Zato pratimo parametar, ne samo početno stanje.
  React.useEffect(() => {
    if (requested === 'Analysis') setView('analysis');
    if (requested === 'Readings') setView('readings');
  }, [requested]);

  const currentLabel =
    view === 'readings' ? t('navigation.readings') : t('navigation.analysis');

  // Ista traka u obje sekcije: kontrola koja nestane kad je aktivna druga
  // opcija ostavlja korisnika bez očiglednog puta nazad.
  const segmented = (
    <Segmented<GasView>
      options={[
        { value: 'readings', label: t('navigation.readings') },
        { value: 'analysis', label: t('navigation.analysis') },
      ]}
      value={view}
      onChange={(next) => {
        setView(next);
        (navigation as any)?.setParams?.({ screen: next === 'analysis' ? 'Analysis' : 'Readings' });
      }}
      accessibilityLabel={currentLabel}
      testID="gas-segmented"
    />
  );

  return view === 'readings' ? (
    <GasReadingsScreen
      headerSlot={segmented}
      onOpenAnalysis={() => {
        setView('analysis');
        // Zadržavamo i navigacione parametre u sinhronizaciji, da `back`
        // ili budući deep link ne vrate pogrešnu sekciju.
        (navigation as any)?.setParams?.({ screen: 'Analysis' });
      }}
    />
  ) : (
    <GasAnalysisScreen
      headerSlot={segmented}
      onBack={() => {
        setView('readings');
        (navigation as any)?.setParams?.({ screen: 'Readings' });
      }}
    />
  );
};

export const GasScreen = GasScreenContent;

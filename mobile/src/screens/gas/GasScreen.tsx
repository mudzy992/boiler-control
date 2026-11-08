import React, { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { GasReadingsScreen } from './GasReadingsScreen';
import { GasAnalysisScreen } from './GasAnalysisScreen';
import { Segmented } from '../../ui';
import { useTokens } from '../../ui/theme';
import { useTranslation } from '../../hooks/useTranslation';

type GasView = 'readings' | 'analysis';

/**
 * Plin — jedan ekran, dvije sekcije.
 *
 * F1 (nalaz UX-03): prije je ovdje bio `createBottomTabNavigator` sa rutama
 * `Readings` / `Analysis`, dakle DRUGI tab bar ugniježđen u glavni. Dvije trake
 * su trošile ~112px na 800px ekrana i tražile od korisnika da nauči koja šta
 * mijenja. Sada je `Segmented` kontrola u zaglavlju ekrana — ista traka,
 * jedan nivo navigacije.
 *
 * F10 (GAS-TRANSITION) — zašto tranzicija više nije „trzava".
 *
 * Prije: `view === 'readings' ? <GasReadingsScreen/> : <GasAnalysisScreen/>`.
 * Dvije posljedice, obje vidljive kao skok:
 *
 *  1. Cijelo stablo se ZAMJENJUJE u istom frame-u. `GasAnalysisScreen` u tom
 *     frame-u još učitava upite, pa se prvo vidi skeleton, a tek onda sadržaj —
 *     dakle dva skoka umjesto jednog.
 *  2. `Segmented` je bio DIO `headerSlot`-a svakog ekrana, pa se pri zamjeni
 *     dém ontirao i montirao iznova. Traka je treptala, gubila fokus i (na
 *     Androidu) nakratko mijenjala visinu.
 *
 * Sada:
 *  - traka se prosljeđuje u OBA panela i oba su stalno montirana, pa se
 *    nijedna instanca `Segmented` ne demontira pri prelasku (nema treptanja);
 *  - oba panela su montirana, a neaktivni je `display: 'none'` — pa upiti
 *    očitanja i analize počinju pri prvom otvaranju ekrana, a ne pri prelasku
 *    (nema drugog skoka kad podaci stignu);
 *  - prelazak je 180 ms `fade` + 8 px pomak u smjeru kretanja (lijevo↔desno),
 *    sa `useNativeDriver` — bez layout-a po frame-u;
 *  - `prefers-reduced-motion` (kroz `useTokens().mode` nije dovoljno, koristimo
 *    RN `AccessibilityInfo`) isključuje pomak; ostaje samo trenutna zamjena.
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

const TRANSITION_MS = 180;
const TRANSITION_SHIFT = 8;

const GasScreenContent: React.FC<GasScreenProps> = ({ route }) => {
  const { t } = useTranslation();
  const { t: tokens } = useTokens();
  const navigation = useNavigation();
  const requested = route?.params?.screen;

  const [view, setView] = useState<GasView>(requested === 'Analysis' ? 'analysis' : 'readings');

  // Duboki link može stići dok je ekran već montiran — tada `nav state` mijenja
  // parametre, a ne `mount`. Zato pratimo parametar, ne samo početno stanje.
  useEffect(() => {
    if (requested === 'Analysis') setView('analysis');
    if (requested === 'Readings') setView('readings');
  }, [requested]);

  const currentLabel = view === 'readings' ? t('navigation.readings') : t('navigation.analysis');

  /**
   * Prelazak: `Animated.Value` 0 → 1 za novi panel. Stari panel se ne animira
   * (nestaje ispod `display: 'none'`), pa nema dva paralelna layout-a.
   */
  // `useMemo`, ne `useRef`: vrijednost se čita i u renderu (interpolacija), a
  // čitanje `ref.current` u renderu je zabranjeno pravilom `react-hooks/refs`.
  const progress = useMemo(() => new Animated.Value(1), []);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    void import('react-native')
      .then(({ AccessibilityInfo }) => AccessibilityInfo.isReduceMotionEnabled?.())
      .then((enabled) => {
        if (mounted) setReduceMotion(Boolean(enabled));
      })
      .catch(() => {
        // Ako API nije dostupan (stariji RN / Jest), animacija ostaje uključena.
      });
    return () => {
      mounted = false;
    };
  }, []);

  const animateTo = (next: GasView) => {
    setView(next);
    if (reduceMotion) {
      progress.setValue(1);
      return;
    }
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: TRANSITION_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  const select = (next: GasView) => {
    if (next === view) return;
    animateTo(next);
    (navigation as any)?.setParams?.({ screen: next === 'analysis' ? 'Analysis' : 'Readings' });
  };

  // Skok u smjeru kretanja: Očitanja → Analiza ide ulijevo (novi sadržaj
  // dolazi s desna), Analiza → Očitanja obrnuto.
  const enteringAnalysis = view === 'analysis';
  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [enteringAnalysis ? TRANSITION_SHIFT : -TRANSITION_SHIFT, 0],
  });

  const segmented = (
    <Segmented<GasView>
      options={[
        { value: 'readings', label: t('navigation.readings') },
        { value: 'analysis', label: t('navigation.analysis') },
      ]}
      value={view}
      onChange={select}
      accessibilityLabel={currentLabel}
      testID="gas-segmented"
    />
  );

  /*
    Oba panela su stalno u stablu, a `display` bira koji je vidljiv — zato
    prelazak ne čeka upite (podaci su već učitani pri prvom otvaranju ekrana).
    Traku dobija SAMO vidljivi panel: da je dobiju oba, u stablu bi postojala
    dva elementa sa istim `testID`-om i istom a11y labelom, pa bi čitač ekrana
    dvaput pročitao istu kontrolu. Pošto se traka nalazi na identičnoj poziciji
    u oba panela i mijenja se u istom frame-u sa panelom, nema vizuelnog skoka.
  */
  return (
    <View style={[styles.root, { backgroundColor: tokens.canvas }]}>
      <Animated.View
        testID="gas-readings-panel"
        pointerEvents={view === 'readings' ? 'auto' : 'none'}
        accessibilityElementsHidden={view !== 'readings'}
        importantForAccessibility={view !== 'readings' ? 'no-hide-descendants' : 'auto'}
        style={[
          styles.panel,
          {
            display: view === 'readings' ? 'flex' : 'none',
            opacity: progress,
            transform: [{ translateX }],
          },
        ]}
      >
        <GasReadingsScreen
          headerSlot={view === 'readings' ? segmented : null}
          onOpenAnalysis={() => select('analysis')}
        />
      </Animated.View>

      <Animated.View
        testID="gas-analysis-panel"
        pointerEvents={view === 'analysis' ? 'auto' : 'none'}
        accessibilityElementsHidden={view !== 'analysis'}
        importantForAccessibility={view !== 'analysis' ? 'no-hide-descendants' : 'auto'}
        style={[
          styles.panel,
          {
            display: view === 'analysis' ? 'flex' : 'none',
            opacity: progress,
            transform: [{ translateX }],
          },
        ]}
      >
        <GasAnalysisScreen
          headerSlot={view === 'analysis' ? segmented : null}
          onBack={() => select('readings')}
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  panel: { flex: 1 },
});

export const GasScreen = GasScreenContent;

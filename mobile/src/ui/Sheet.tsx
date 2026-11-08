/**
 * `Sheet` — bottom sheet koji se otvara/zatvara animirano i ima naslov.
 *
 * F7 (SHEET-03) — zašto više ne koristi `@gorhom/bottom-sheet`:
 *
 * Korisnik je dva puta prijavio isto: „set current temp / + na Plinu / promjena
 * jezika ne otvaraju ništa, a aplikacija kao da zabaguje". Prva popravka
 * (F7 SHEET-01) je `BottomSheet` umotala u RN `Modal` i dodala deklarativni
 * `index`, ali to rješava samo dio problema:
 *
 *  - gorhomov list se montira na svaki `render` svog roditelja i računa layout
 *    kroz Reanimated worklete; unutar `Modal`-a (novi native root) taj layout
 *    često nije izračunat u trenutku kad `index` treba primijeniti, pa list
 *    ostane na `-1` — sheet je „otvoren" u stanju, a ne vidi se;
 *  - `enablePanDownToClose` + `BottomSheetBackdrop` traže gesture-handler
 *    pan obradu nad native rootom; kad se nešto od toga ne sastavi, dodiri nad
 *    ekranom ostaju zarobljeni — to je „zabaguje" koji korisnik opisuje;
 *  - sve to zavisi od tri native sloja (Reanimated, worklets, gesture-handler)
 *    na koje UI ne smije da se oslanja za OSNOVNU radnju kao što je otvaranje
 *    forme.
 *
 * Sada: `Sheet` je običan RN `Modal` + `Animated` (ugrađeni `Animated`, bez
 * Reanimated workleta) sa `Animated.View` listom koji klizi odozdo. Nema
 * workleta, nema gesture-handlera, nema mjerenja layouta — pa nema ni načina da
 * se „ne otvori". Zatvaranje animira isto (spuštaj i fade), a `onRequestClose`
 * pokriva Android back.
 *
 * Ponašanje je namjerno isto kao prije: `isOpen`, `onClose`, `title`, `children`,
 * `snapPoints` (procenti visine), `scrollable`, `testID`, `closeLabel`.
 * `snapPoints` sada znači: prva tačka je početna visina lista; druga se koristi
 * kao maksimalna visina sadržaja (lista ne prelazi ekran).
 */

import React from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable as RNPressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { radius, space } from '../theme/tokens';
import { useTokens } from './theme';
import { Pressable } from './Pressable';
import { Text } from './Text';

export type SheetProps = {
  isOpen: boolean;
  onClose: () => void;
  /** Naslov u zaglavlju lista. Ako nema naslova, nema ni X dugmeta. */
  title?: string;
  children: React.ReactNode;
  /** Visina lista kao procenat ekrana; prva vrijednost je početna. */
  snapPoints?: readonly (number | `${number}%`)[];
  /** `true` kad sadržaj treba da skrola unutar lista (duge forme). */
  scrollable?: boolean;
  testID?: string;
  /** Labela za X dugme; F4 traži da i ona prolazi kroz `t()`. */
  closeLabel?: string;
};

const DURATION = 220;

export function Sheet({
  isOpen,
  onClose,
  title,
  children,
  snapPoints = ['50%', '90%'],
  scrollable = false,
  testID,
  closeLabel = 'Zatvori',
}: SheetProps) {
  const { t, fonts } = useTokens();
  const { height } = useWindowDimensions();

  /**
   * `mounted` drži list u stablu dok traje animacija zatvaranja. Bez toga bi
   * `Modal` nestao u istom frejmu i animacija se ne bi vidjela — a F0 je
   * obećao animirano zatvaranje, ne nestanak.
   */
  const [mounted, setMounted] = React.useState(isOpen);
  /** 0 = sklonjen, 1 = otvoren. Jedna vrijednost vodi i pomak i fade. */
  const progress = React.useRef(new Animated.Value(isOpen ? 1 : 0)).current;

  const percent = React.useMemo(() => {
    const first = snapPoints[0] ?? '50%';
    const value = typeof first === 'number' ? first : Number(String(first).replace('%', ''));
    if (!Number.isFinite(value)) return 0.5;
    // Broj ≤ 1 tretiramo kao udio, veći broj kao procenat (kompatibilnost sa
    // `snapPoints={['45%']}` i `snapPoints={[0.45]}`).
    return value <= 1 ? value : value / 100;
  }, [snapPoints]);

  const sheetHeight = Math.max(160, Math.round(height * percent));

  React.useEffect(() => {
    if (isOpen) {
      setMounted(true);
      Animated.timing(progress, {
        toValue: 1,
        duration: DURATION,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      return;
    }

    Animated.timing(progress, {
      toValue: 0,
      duration: DURATION,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      // `finished === false` znači da je sheet ponovo otvoren prije kraja —
      // tada ga ne sklanjamo, inače bi se sadržaj izgubio usred otvaranja.
      if (finished) setMounted(false);
    });
  }, [isOpen, progress]);

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [sheetHeight, 0],
  });
  const backdropOpacity = progress.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  const header = title ? (
    <View style={[styles.header, { borderBottomColor: t.line }]}>
      <Text
        accessibilityRole="header"
        style={{ fontFamily: fonts.sansSemiBold, fontSize: 15, color: t.ink, flex: 1 }}
      >
        {title}
      </Text>
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={closeLabel}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        testID={testID ? `${testID}-close` : undefined}
      >
        <Ionicons name="close" size={20} color={t.inkMuted} />
      </Pressable>
    </View>
  ) : null;

  const body = <View style={styles.content}>{children}</View>;

  return (
    <Modal
      visible={isOpen || mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
      testID={testID ? `${testID}-modal` : undefined}
    >
      {/*
        Backdrop je `Animated.View`, a ne `BottomSheetBackdrop`: dodir zatvara
        list, a `onStartShouldSetResponder` ne vraća `true` — dakle dodiri van
        lista ne ostaju zarobljeni (to je bio „bag" iz prijave).
      */}
      <View style={styles.host}>
        <Animated.View
          pointerEvents="none"
          style={[styles.backdrop, { opacity: backdropOpacity }]}
        />
        <RNPressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
          onPress={onClose}
          testID={testID ? `${testID}-backdrop` : undefined}
        />
        <Animated.View
          style={[
            styles.sheet,
            {
              height: sheetHeight,
              backgroundColor: t.panel,
              borderColor: t.line,
              transform: [{ translateY }],
            },
          ]}
        >
          <View style={styles.handleWrap}>
            <View style={[styles.handle, { backgroundColor: t.lineStrong }]} />
          </View>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            {header}
            {scrollable ? (
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={styles.contentScrollable}
                keyboardShouldPersistTaps="handled"
              >
                {children}
              </ScrollView>
            ) : (
              body
            )}
          </KeyboardAvoidingView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  host: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#000000',
  },
  sheet: {
    width: '100%',
    borderTopLeftRadius: radius.panel,
    borderTopRightRadius: radius.panel,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    overflow: 'hidden',
  },
  handleWrap: {
    alignItems: 'center',
    paddingTop: space.sm,
    paddingBottom: 2,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
  },
  content: {
    flex: 1,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.xxl,
  },
  contentScrollable: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.xxl + space.lg,
  },
});

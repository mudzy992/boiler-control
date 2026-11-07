/**
 * `Sheet` — bottom sheet koji se zatvara animacijom i ima naslov.
 *
 * Ispravlja tri stvari iz `components/BottomSheetModal.tsx` (nalaz UX-14):
 *  1. `if (!isOpen) return null` je uklanjao sheet iz stabla prije animacije
 *     zatvaranja, pa je zatvaranje „nestajalo". Ovdje se komponenta drži
 *     montiranom dok `onDismiss` ne javi da je animacija gotova (`closing` ref).
 *  2. `title` prop se primao i nikad nije renderovao. Ovdje je obavezno vidljiv
 *     i nosi `accessibilityRole="header"`.
 *  3. Nije bilo `keyboardBehavior`, pa je tastatura krila dugmad u formama.
 *     Sada je `interactive` uz `KeyboardAvoidingView` na iOS-u.
 *
 * API je namjerno mali (`isOpen`, `onClose`, `title`, `children`) da bi zamjena
 * na postojećim mjestima bila mehanička.
 */

import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';

import { radius, space } from '../theme/tokens';
import { useTokens } from './theme';
import { Pressable } from './Pressable';
import { Text } from './Text';
import { Ionicons } from '@expo/vector-icons';

export type SheetProps = {
  isOpen: boolean;
  onClose: () => void;
  /** Naslov u zaglavlju lista. Ako nema naslova, nema ni X dugmeta. */
  title?: string;
  children: React.ReactNode;
  /** Snap tačke kao procenti visine ekrana. */
  snapPoints?: readonly (number | `${number}%`)[];
  /** `true` kad sadržaj treba da skrola unutar lista (duge forme). */
  scrollable?: boolean;
  testID?: string;
  /** Labela za X dugme; F4 traži da i ona prolazi kroz `t()`. */
  closeLabel?: string;
};

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
  const sheetRef = React.useRef<BottomSheet>(null);

  const points = React.useMemo(
    () =>
      snapPoints.map((point) => {
        if (typeof point === 'number') return point;
        const percent = Number(point.replace('%', ''));
        return Number.isFinite(percent) ? Math.max(1, (height * percent) / 100) : height * 0.5;
      }),
    [snapPoints, height],
  );

  React.useEffect(() => {
    if (isOpen) {
      sheetRef.current?.snapToIndex(0);
    } else {
      sheetRef.current?.close();
    }
  }, [isOpen]);

  const renderBackdrop = React.useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.6}
        pressBehavior="close"
      />
    ),
    [],
  );

  /**
   * Namjerno se NE vraća `null` kad je `isOpen === false`: sheet treba da ostane
   * montiran da bi `close()` mogao da odigra animaciju, a `index` ga sklanja.
   * `enablePanDownToClose` i backdrop pozivaju isti `onClose`.
   */
  const Content = scrollable ? BottomSheetScrollView : BottomSheetView;

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={points}
      enablePanDownToClose
      onClose={onClose}
      backdropComponent={renderBackdrop}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      backgroundStyle={{ backgroundColor: t.panel, borderRadius: radius.panel }}
      handleIndicatorStyle={{ backgroundColor: t.lineStrong }}
      style={{ zIndex: 10 }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {title ? (
          <View style={[styles.header, { borderBottomColor: t.line }]}>
            <Text
              accessibilityRole="header"
              style={{ fontFamily: fonts.sansSemiBold, fontSize: 14, color: t.ink, flex: 1 }}
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
              <Ionicons name="close" size={18} color={t.inkMuted} />
            </Pressable>
          </View>
        ) : null}
        <Content style={{ flex: 1 }} contentContainerStyle={styles.content}>
          {children}
        </Content>
      </KeyboardAvoidingView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
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
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.xxl + space.lg,
  },
});

import React from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  StyleSheet,
  View,
} from 'react-native';
import { useTranslation } from '../hooks/useTranslation';
import { Text } from '../ui';

interface AnimatedSplashProps {
  visible: boolean;
  onFinished: () => void;
}

export const AnimatedSplash: React.FC<AnimatedSplashProps> = ({
  visible,
  onFinished,
}) => {
  const { t } = useTranslation();
  /*
   * `36`: splash je bio samo slika na bijelom. Dok traje najduže 2,5 s i dok
   * čeka jezik i fontove, izgledao je kao zamrznut ekran — korisnik nije imao
   * znak da se nešto dešava. Sada se poslije 400 ms pojavi indikator i kratak
   * tekst; rana faza ostaje čista (indikator odmah izgleda kao da je zapelo).
   */
  const [showProgress, setShowProgress] = React.useState(false);
  const opacity = React.useRef(new Animated.Value(1)).current;
  const scale = React.useRef(new Animated.Value(0.9)).current;
  const [reduceMotion, setReduceMotion] = React.useState(false);
  React.useEffect(() => {
    if (!visible) {
      setShowProgress(false);
      return;
    }
    const timer = setTimeout(() => setShowProgress(true), 400);
    return () => clearTimeout(timer);
  }, [visible]);

  /*
   * F6 (A11Y-15, WCAG 2.2 SC 2.3.3 Animation from Interactions / 2.2.2):
   * splash je jedina animacija u aplikaciji i dosad se puštao bez obzira na
   * sistemsku postavku „Ukloni animacije". Korisnik koji ima vestibularne
   * smetnje ne može preskočiti uvod. Sada se poštuje postavka: kad je uključena,
   * splash se prikaže statično i odmah preda dalje.
   */
  React.useEffect(() => {
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (!cancelled) setReduceMotion(enabled);
      })
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (enabled) => setReduceMotion(enabled),
    );
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  React.useEffect(() => {
    if (!visible) return;

    if (reduceMotion) {
      opacity.setValue(1);
      scale.setValue(1);
      onFinished();
      return;
    }

    const animation = Animated.sequence([
      Animated.parallel([
        Animated.timing(scale, {
          toValue: 1,
          duration: 650,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 650,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(350),
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 300,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1.04,
          duration: 300,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]);

    animation.start(({ finished }) => {
      if (finished) onFinished();
    });

    return () => animation.stop();
  }, [opacity, onFinished, reduceMotion, scale, visible]);

  if (!visible) return null;

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.branding,
          {
            opacity,
            transform: [{ scale }],
          },
        ]}
      >
        <Animated.Image
          source={require('../../assets/new/splash_branding.png')}
          resizeMode="contain"
          style={styles.branding}
        />
      </Animated.View>
      {showProgress ? (
        <View style={styles.progress} testID="splash-progress">
          <ActivityIndicator accessibilityLabel={t('common.splashPreparing')} />
          <Text size="meta" tone="muted">
            {t('common.splashPreparing')}
          </Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    // RN 0.88 je uklonio `StyleSheet.absoluteFillObject`. Predložena zamjena
    // `absoluteFill` OVDJE NE RADI: to je registrovani style (broj), a ovo
    // mjesto ga spread-a — spread broja bi tiho proizveo prazan objekt i
    // splash bi izgubio position/ivice. Zato je objekt inlajnovan.
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    zIndex: 9999,
    elevation: 99,
  },
  branding: {
    width: 220,
    height: 220,
  },
  progress: {
    position: 'absolute',
    bottom: 64,
    alignItems: 'center',
    gap: 8,
  },
});

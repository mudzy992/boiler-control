import React from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

interface AnimatedSplashProps {
  visible: boolean;
  onFinished: () => void;
}

export const AnimatedSplash: React.FC<AnimatedSplashProps> = ({
  visible,
  onFinished,
}) => {
  const opacity = React.useRef(new Animated.Value(1)).current;
  const scale = React.useRef(new Animated.Value(0.9)).current;

  React.useEffect(() => {
    if (!visible) return;

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
  }, [opacity, onFinished, scale, visible]);

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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
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
});

module.exports = ({ config }) => {
  // Default API URL for local development
  // Will be overridden by EAS build env vars for preview/production
  const extra = {
    EXPO_PUBLIC_API_URL: 'https://boiler-control.hopto.org/backend/api',
    eas: {
      projectId: "c875e85d-ad10-4eb6-bdae-fa5038133ee7",
    },
  };

  return {
    ...config,
    name: config.name || 'Boiler Control',
    slug: config.slug || 'boiler-control',
    version: config.version || '1.0.0',
    orientation: config.orientation || 'portrait',
    icon: config.icon || './assets/new/boiler-control-icon-master.png',
    userInterfaceStyle: config.userInterfaceStyle || 'light',
    assetBundlePatterns: config.assetBundlePatterns || ['**/*'],
    splash: config.splash || {
      image: './assets/new/splash_branding.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    notification: {
      ...(config.notification || {}),
      icon: config.notification?.icon || './assets/new/ic_notification.png',
      color: config.notification?.color || '#ffffff',
    },
    scheme: config.scheme || 'myapp',
    plugins: config.plugins || [
      'expo-font',
      '@react-native-community/datetimepicker',
      "expo-localization",
      [
        'expo-notifications',
        {
          icon: "./assets/new/ic_notification.png",
          color: "#ffffff",
          defaultChannel: 'default',
          enableBackgroundRemoteNotifications: false,
        },
      ],
    ],
    ios: {
      ...(config.ios || {}),
      bundleIdentifier: config.ios?.bundleIdentifier || 'com.boilercontrol.app',
      supportsTablet: config.ios?.supportsTablet ?? true,
      config: {
        ...(config.ios?.config || {}),
        usesNonExemptEncryption: config.ios?.config?.usesNonExemptEncryption ?? false,
      },
      infoPlist: {
        ...(config.ios?.infoPlist || {}),
        UIBackgroundModes: config.ios?.infoPlist?.UIBackgroundModes || ['remote-notification'],
      },
    },
    android: {
      ...(config.android || {}),
      package: config.android?.package || 'com.boilercontrol.app',
      versionCode: config.android?.versionCode || 1,
      adaptiveIcon: {
        ...(config.android?.adaptiveIcon || {}),
        foregroundImage:
          config.android?.adaptiveIcon?.foregroundImage ||
          './assets/new/ic_launcher_foreground.png',
        backgroundImage:
          config.android?.adaptiveIcon?.backgroundImage ||
          './assets/new/ic_launcher_background.png',
        monochromeImage:
          config.android?.adaptiveIcon?.monochromeImage ||
          './assets/new/ic_launcher_monochrome.png',
        backgroundColor:
          config.android?.adaptiveIcon?.backgroundColor || '#ffffff',
      },
      edgeToEdgeEnabled: config.android?.edgeToEdgeEnabled ?? true,
      predictiveBackGestureEnabled: config.android?.predictiveBackGestureEnabled ?? false,
      googleServicesFile: config.android?.googleServicesFile || './assets/google-services.json',
    },
    extra: {
      ...(config.extra || {}),
      ...extra,
    },
  };
};

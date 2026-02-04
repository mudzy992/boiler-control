module.exports = ({ config }) => {
  // Default API URL for local development
  // Will be overridden by EAS build env vars for preview/production
  const extra = {
    EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL || 'https://boiler-control.hopto.org/backend/api',
    eas: {
      projectId:
        process.env.EXPO_PUBLIC_EAS_PROJECT_ID ||
        process.env.EAS_PROJECT_ID ||
        config.extra?.eas?.projectId,
    },
  };

  return {
    ...config,
    name: config.name || 'Boiler Control',
    slug: config.slug || 'boiler-control',
    version: config.version || '1.0.0',
    orientation: config.orientation || 'portrait',
    userInterfaceStyle: config.userInterfaceStyle || 'light',
    assetBundlePatterns: config.assetBundlePatterns || ['**/*'],
    scheme: config.scheme || ['myapp', 'exp'],
    plugins: config.plugins || [
      'expo-font',
      '@react-native-community/datetimepicker',
      [
        'expo-notifications',
        {
          defaultChannel: 'default',
          enableBackgroundRemoteNotifications: false,
        },
      ],
    ],
    ios: {
      ...(config.ios || {}),
      bundleIdentifier: config.ios?.bundleIdentifier || 'com.mudzy.BoilerControlMobile',
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
      package: config.android?.package || 'com.mudzy.BoilerControlMobileV1b1',
      versionCode: config.android?.versionCode || 1,
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

import { registerRootComponent } from 'expo';

// Mora prije `App`-a: `Intl.PluralRules` mora postojati prije prvog i18n
// poziva, a LogBox filter mora biti postavljen prije prvog JSX render-a
// (NativeWind uvozi `runtime/components` tek pri prvom render-u).
import './src/polyfills';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);

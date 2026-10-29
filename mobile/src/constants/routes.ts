/**
 * MO2-3: jedinstveni izvor istine za imena ruta.
 *
 * Prije ove datoteke imena ruta su bila hardkodovana kao string literalima na
 * tri mjesta (navigatori, `linking` konfiguracija i `handleDeepLink`), pa su se
 * mogla neprimjetno razilaziti. To se i desilo:
 *
 *   - `linking.config` je deklarirao `GasReadings` / `GasAnalysis` / `add-reading`
 *   - `handleDeepLink` je navigirao na `screen: 'GasReadings'`
 *   - `GasScreen.tsx` stvarno registruje rute `Readings` i `Analysis`
 *
 * Niti jedan od ta tri cilja nije bio registrovana ruta, pa deep link iz push
 * notifikacije nije mogao otvoriti unos očitanja.
 *
 * Vrijednosti ispod SU registrovana imena ruta — provjereno u:
 *   RootNavigator.tsx        -> Main, Login, Register
 *   MainTabNavigator.tsx     -> Dashboard, Heating, Gas, Settings
 *   DashboardStackNavigator  -> DashboardMain, Analytics
 *   GasScreen.tsx            -> Readings, Analysis
 *   SettingsStackNavigator   -> SettingsMain, Profile, HomeManagement,
 *                               ScheduleManagement, Notifications,
 *                               NotificationPreferences
 */

export const ROOT_SCREENS = {
  Main: 'Main',
  Login: 'Login',
  Register: 'Register',
} as const;

export const MAIN_TAB_SCREENS = {
  Dashboard: 'Dashboard',
  Heating: 'Heating',
  Gas: 'Gas',
  Settings: 'Settings',
} as const;

/**
 * Rute unutar `Gas` tab-a (`GasScreen.tsx` je bottom-tab navigator).
 * Imena su `Readings` / `Analysis`, NE `GasReadings` / `GasAnalysis`.
 */
export const GAS_TAB_SCREENS = {
  Readings: 'Readings',
  Analysis: 'Analysis',
} as const;

export const DASHBOARD_STACK_SCREENS = {
  DashboardMain: 'DashboardMain',
  Analytics: 'Analytics',
} as const;

export const SETTINGS_STACK_SCREENS = {
  SettingsMain: 'SettingsMain',
  Profile: 'Profile',
  HomeManagement: 'HomeManagement',
  ScheduleManagement: 'ScheduleManagement',
  Notifications: 'Notifications',
  NotificationPreferences: 'NotificationPreferences',
} as const;

/**
 * Deep link prefiksi. NEMOJ mijenjati bez MO2-2 version gate-a: instalirane
 * verzije aplikacije očekuju `myapp://`.
 */
export const DEEP_LINK_PREFIXES = ['myapp://', 'exp://'] as const;

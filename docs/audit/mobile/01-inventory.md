# Mobile inventar — Faza 3

Opseg: `mobile/` (Expo 54 / React Native 0.81.5 / React 19.1.0). Datum stvarnog izvođenja komandi: **2026-10-29**.
Aktivna grana: `arena/1bfee051-boiler-control` (`git branch --show-current`).

## Sažetak: pet ključnih činjenica

1. **VERIFIKOVANO (pokrenuto):** `npm ci --ignore-scripts` uspijeva (977 paketa, 474 MB), **`npm run type-check` prolazi s 0 grešaka** — za razliku od frontenda, `mobile/tsconfig.json` stvarno uključuje `src`, `App.tsx`, `index.js`. Ali **`npm run lint` pada (exit 2)** jer `eslint-config-expo` nije instaliran, a **`npm test` pada (exit 127, `jest: not found`)** — nema nijednog testa (MO-012).
2. **VERIFIKOVANO:** `AnalyticsScreen.tsx` koristi legacy `expo-file-system` API koji u instaliranoj verziji **19.0.22** ne postoji / baca grešku — CSV export analitike **ne može uspjeti** (MO-001, dokaz: `scripts/audit/mobile-probe`).
3. **VERIFIKOVANO:** backend šalje push s `deepLink: 'myapp://gas/add-reading'`, a mobilna navigacija cilja ekran `GasReadings` koji **ne postoji** (postoje `Readings`/`Analysis`) — deep link iz notifikacije ne radi, a cold-start tap se uopšte ne obrađuje (MO-002).
4. **VERIFIKOVANO:** tri ekrana nemaju nijedan `t()` poziv (`HomeManagementScreen`, `ProfileScreen`, `ScheduleManagementScreen`), a `SettingsScreen` ima prekidače koji **ništa ne rade** (lokalni `useState`, bez perzistencije i bez backend poziva) (MO-008, MO-021).
5. **VERIFIKOVANO:** `error.handler.ts` — jedini centralni mehanizam za prikaz grešaka — **samo loguje u `console.error`**; korisnik nikad ne vidi poruku (MO-018).

## Otvorena pitanja za vlasnika

- Koji je stvarni produkcijski API host: `api.boiler-control.ba101.top/api` (EAS + `app.config.js`) ili `boiler.ba101.top/backend/api` (dev fallback u `api.config.ts` i host iz frontend audita FE-009)? (MO-005)
- Da li je iOS build ikad rađen? `scheme` je placeholder `myapp`, `ios` sekcija nema `scheme`, a `eas.json` ima samo `development` i `production` profil bez `submit` konfiguracije (MO-004, MO-005, MO-024).
- Koja je minimalna podržana verzija aplikacije u produkciji i postoji li mehanizam prisilnog ažuriranja? U kodu ga nema (MO-004).
- Da li je `RECORD_AUDIO` permisija na Androidu namjerna? Aplikacija ne snima zvuk (MO-025).
- Je li prihvatljivo da se fakture i slike brojila trajno čuvaju u nešifriranom app cacheu (MO-020)?
- Da li `expo-sharing` i `react-native-worklets-core` trebaju ostati u zavisnostima (ne koriste se)?

## Struktura: 78 fajlova u `mobile/`

<!-- mob:screens:14 -->
<!-- mob:components:12 -->
<!-- mob:navigators:4 -->
<!-- mob:services:8 -->

### Ekrani (14/14)

| # | Fajl | Linija | Navigator / ruta | `t()` | Primjećeno |
|---|------|--------|------------------|-------|------------|
| 1 | `src/screens/auth/LoginScreen.tsx` | 135 | Root → `Login` | 13 | `identifier` + `password`; backend `LoginDto` prima `identifier ?? email` (usklađeno) |
| 2 | `src/screens/auth/RegisterScreen.tsx` | 196 | Root → `Register` | 21 | — |
| 3 | `src/screens/dashboard/DashboardScreen.tsx` | 447 | Dashboard stack → `DashboardMain` | 17 | health score izračun u klijentu (MO-015); granice 48–55 °C |
| 4 | `src/screens/analytics/AnalyticsScreen.tsx` | 754 | Dashboard stack → `Analytics` | 67 | **export CSV slomljen** (MO-001); fiktivne komparacije „12 % / 18 %" (MO-016) |
| 5 | `src/screens/heating/HeatingScreen.tsx` | 508 | Main tab → `Heating` | 28 | `refetchInterval` 60 s bez `AppState` pauze (MO-027); dupli ključ za `/dashboard` |
| 6 | `src/screens/gas/GasScreen.tsx` | 61 | Main tab → `Gas` (ugniježdeni tab navigator) | 2 | ekrani se zovu `Readings`/`Analysis` — deep link cilja nepostojeći `GasReadings` (MO-002); `useColorModeValue` pozvan unutar `screenOptions` objekta (linija 31) |
| 7 | `src/screens/gas/GasReadingsScreen.tsx` | 1059 | Gas → `Readings` | 54 | najveći ekran; 6 mutacija; download zaštićenih fajlova (MO-020) |
| 8 | `src/screens/gas/GasAnalysisScreen.tsx` | 694 | Gas → `Analysis` | 54 | `react-native-chart-kit` učitan preko `try/catch require` (linije 20-24) |
| 9 | `src/screens/home/HomeManagementScreen.tsx` | 1079 | Settings stack → `HomeManagement` | **0** | cijeli ekran hardcoded EN (MO-021); optimistic update za sve 4 mutacije |
| 10 | `src/screens/schedule/ScheduleManagementScreen.tsx` | 485 | Settings stack → `ScheduleManagement` | **0** | read-only prikaz Tuya programa; hardcoded EN; `new Date().getHours()` bez TZ (MO-026) |
| 11 | `src/screens/settings/SettingsScreen.tsx` | 509 | Settings stack → `SettingsMain` | 52 | **prekidači bez efekta** (MO-008); `SettingItem` definisan unutar rendera; 4 akcije = `console.log` (MO-019) |
| 12 | `src/screens/profile/ProfileScreen.tsx` | 262 | Settings stack → `Profile` | **0** | hardcoded EN, bez React Query, VAT 17% hardcoded (MO-009) |
| 13 | `src/screens/notifications/NotificationsScreen.tsx` | 260 | Settings stack → `Notifications` | 12 | jedini ekran s `SectionList` (virtualizovano) |
| 14 | `src/screens/notifications/NotificationPreferencesScreen.tsx` | 132 | Settings stack → `NotificationPreferences` | 5 | bez optimistic update; `type` se šalje kao `string` |

### Navigatori (4/4)

| Fajl | Linija | Sadržaj | Bilješka |
|---|---|---|---|
| `src/navigation/RootNavigator.tsx` | 98 | `NavigationContainer` + auth stack (`Login`/`Register` ili `Main`), `linking` konfiguracija | modul-level `BackHandler.removeEventListener` polyfill (18-20); `linking` cilja nepostojeće ekrane (MO-002) |
| `src/navigation/MainTabNavigator.tsx` | 83 | 4 taba: `Dashboard`, `Heating`, `Gas`, `Settings` | drugi isti polyfill (13-15); `PHASE_3_GUIDE.md` tvrdi 5 tabova (MO-007) |
| `src/navigation/DashboardStackNavigator.tsx` | 33 | `DashboardMain`, `Analytics` | — |
| `src/navigation/SettingsStackNavigator.tsx` | 69 | `SettingsMain`, `Profile`, `HomeManagement`, `ScheduleManagement`, `Notifications`, `NotificationPreferences` | naslovi ekrana hardcoded EN (`'Manage Homes'`, …) |

### Komponente (12/12)

| Fajl | Linija | Namjena | Bilješka |
|---|---|---|---|
| `components/AlertsCard.tsx` | 196 | generiše alerte iz dashboard podataka | **poslovna logika u klijentu**: pragovi 5/2 °C, 24/1 h, 0.3 (MO-015) |
| `components/AnimatedSplash.tsx` | 94 | animirani splash, fiksni tajmer 2500 ms (`App.tsx:69-75`) | — |
| `components/BoilerStatusCard.tsx` | 303 | status kotla + „postavi temperaturu" | `isOptimal` prag 2 °C (linija 88) |
| `components/BottomSheetModal.tsx` | 113 | omotač oko `@gorhom/bottom-sheet` | vraća `null` kad je zatvoren (linija 67) pa animacija zatvaranja nema efekta |
| `components/FormInput.tsx` | 40 | `TextInput` + NativeBase `Box` | bez `accessibilityLabel`/`accessibilityHint` (MO-017) |
| `components/HealthScoreCard.tsx` | 132 | prikaz health scorea | prima izračun iz `DashboardScreen` |
| `components/RecentHeatingEvents.tsx` | 151 | lista nedavnih događaja | `ScrollView` + `map`, nije virtualizovano |
| `components/ThermostatCard.tsx` | 142 | kartica termostata | `targetTemp` = prvi interval programa (linija 49) |
| `components/WeatherCard.tsx` | 133 | vremenska kartica | ikona iz string matchinga nad `condition` (20-29); `useColorModeValue` pozvan unutar JSX-a (82, 99, 116) |
| `components/analytics/GasAnalyticsCard.tsx` | 217 | gas analitika kartica | — |
| `components/gas/GasForm.tsx` | 415 | unos očitanja + slika | klijentska provjera duplog dana (`toDateString`) duplicira backend B-018 |
| `components/gas/GasReadingCard.tsx` | 339 | kartica očitanja + akcije | — |

### Servisi, storage, notifikacije (8/8)

| Fajl | Linija | Namjena | Bilješka |
|---|---|---|---|
| `services/api/client.ts` | 341 | `ApiClientService` klasa (axios instanca), 41 metoda | 6 metoda niko ne poziva (MO-013); `homeProfile.api.ts` i `thermostat.api.ts` prave **svoje** axios instance mimo ovog klijenta |
| `services/api/error.handler.ts` | 144 | `ApiError`, `parseApiError`, `showError` | **`showError` samo `console.error`** — ništa se ne prikazuje (MO-018) |
| `services/api/analytics.api.ts` | 81 | 4 wrapper metode nad `apiClient` | — |
| `services/api/homeProfile.api.ts` | 131 | 7 metoda nad `/home-profiles` | vlastita axios instanca po pozivu (78-88) |
| `services/api/thermostat.api.ts` | 85 | 4 metode nad `/devices` | isto; `updateDevice` deklarisan ali nikad pozvan |
| `services/notifications/notificationService.ts` | 202 | push registracija, kanali, deep link obrada | cilja nepostojeći ekran; nema `getLastNotificationResponseAsync` (MO-002); 2 deprecated no-op funkcije (181-202) |
| `services/storage/SecureStorage.ts` | 61 | token u `expo-secure-store` | na web pada na **nešifrirani AsyncStorage** (13, 21); `Platform` je jedini kriterij, ne stvarna dostupnost |
| `services/storage/AppStorage.ts` | 63 | AsyncStorage wrapper | koristi se samo za `app.language` |

### Ostali `src` fajlovi (7)

| Fajl | Linija | Bilješka |
|---|---|---|
| `src/api/dashboard.api.ts` | 64 | **druga lokacija API sloja** mimo `services/api` (MO-014); `DashboardScreen` importira samo `getDashboard`, ostale 3 funkcije su mrtve |
| `src/config/api.config.ts` | 45 | 3 različita URL izvora; dev fallback je **produkcijski host** (MO-005); `RETRY_ATTEMPTS: 2` nikad korišten |
| `src/constants/homeProfileEnums.ts` | 56 | `SEASON_MODE_OPTIONS` ima 2 vrijednosti, enum 3 (`AUTO` nedostaje); labele opcija hardcoded EN |
| `src/context/AuthContext.tsx` | 165 | login/register/logout/restore; push registracija na promjenu tokena | 401 → `logout()` na svaku grešku dohvata profila, bez razlikovanja mrežnog pada |
| `src/hooks/useAuth.ts` / `useTranslation.ts` | 12 / 10 | getter hookovi | dva ekrana importiraju `useTranslation` direktno iz `react-i18next` |
| `src/locales/config.ts` | 1236 | inline `en-US` + `bs-BS`, 550 / 525 ključeva | 25 ključeva u `enUS` su **bosanski tekst unutar `gas.*`** (MO-022) |
| `src/providers/BottomSheetProvider.tsx` | 14 | dupli `GestureHandlerRootView` | **niko ga ne importira** — mrtav kod (MO-013) |
| `src/theme/theme.ts` / `colors.ts` / `colorModeManager.ts` | 52 / 43 / 24 | NativeBase tema + paleta + perzistencija | `colors.ts` **niko ne importira**; `useSystemColorMode: false` |
| `src/types/Dashboard.ts` / `Weather.ts` | 106 / 12 | ručno pisani tipovi | `SystemDashboard.weather: any`; nisu generisani iz OpenAPI |

### Konfiguracija i korijenski fajlovi

| Fajl | Ključno |
|---|---|
| `package.json` | `expo ~54.0.34`, `react-native 0.81.5`, `react 19.1.0`, `native-base ^3.4.28`, `nativewind ^4.0.0`, `react-native-reanimated ~4.1.1` + `react-native-worklets 0.5.1` **i** `react-native-worklets-core ^1.6.2`; skripte `start/android/ios/web/test/lint/type-check`; **nema `build` skripte** iako `README.md` tvrdi `npm run build` |
| `tsconfig.json` | `extends: expo/tsconfig.base`, `strict`, `noUnusedLocals/Parameters`, `include: [src, App.tsx, index.js]` — type-check stvarno radi |
| `.eslintrc.js` | `extends: ['expo', 'prettier']` — **oba preset paketa nedostaju** u `devDependencies` (MO-012) |
| `babel.config.js` | `babel-preset-expo` s `jsxImportSource: 'nativewind'` + `nativewind/babel` + reanimated plugin |
| `app.json` / `app.config.js` | dva izvora konfiguracije; `app.config.js` dodaje `scheme: 'myapp'`, 5 pluginova, `eas.projectId`, `ios.config.usesNonExemptEncryption` (MO-024) |
| `eas.json` | profili `development` i `production` (oba isti `EXPO_PUBLIC_API_URL`); `submit.production` je prazan objekt; `appVersionSource: remote` |
| `.env.example` | `EXPO_PUBLIC_API_URL=http://192.168.31.247:3020/api` (LAN IP) |
| `assets/google-services.json` | sadrži `project_info`, `client[0].client_info.mobilesdk_app_id`, `api_key`, `oauth_client: []` — FCM konfiguracija prisutna; vrijednosti nisu prepisane u audit |
| `README.md` / `PHASE_3_GUIDE.md` / `docs/API_CONFIG.md` | tri dokumenta s tvrdnjama koje kod ne potvrđuje (MO-007) |
| `assets/new/*` | 11 slika; 4 (`ic_notification_colored`, `ic_notify_heating`, `ic_notify_temperature`, `ic_notify_warning`) nisu referencirane ni u `app.json` ni u `app.config.js` |

## Mapa „ekran → API poziv → backend ruta"

<!-- mob:apimethods:40 -->
<!-- mob:apitable:55 -->
<!-- mob:endpoints:28 -->

### Sve API metode (55) — inventar s potrošačem

<!-- mob:apitable:55 -->

**`services/api/client.ts` (40 metoda):**

| Metoda | HTTP | Backend ruta | Potrošač |
|---|---|---|---|
| `login` | POST | `/api/auth/login` | `LoginScreen` |
| `register` | POST | `/api/auth/register` | `RegisterScreen` |
| `getMe` | GET | `/api/auth/me` | `AuthContext` |
| `changePassword` | POST | `/api/auth/change-password` | `SettingsScreen` |
| `getDashboard` | GET | `/api/dashboard` | `DashboardScreen`, `HeatingScreen` |
| `getDashboardHeatingEvents` | GET | `/api/dashboard/heating-events` | `analytics.api` → `AnalyticsScreen` |
| `getDashboardHeatingSummary` | GET | `/api/dashboard/heating-summary` | `analytics.api` → `AnalyticsScreen` |
| `getDashboardHeatingStats` | GET | `/api/dashboard/heating-stats` | `analytics.api` → `AnalyticsScreen` |
| `getDashboardLearningTrends` | GET | `/api/dashboard/learning-trends` | `analytics.api` → `AnalyticsScreen` |
| `getDashboardExport` | GET | `/api/dashboard/export` | `analytics.api` → `AnalyticsScreen` |
| `getDashboardHeatingStatus` | GET | `/api/dashboard/heating-status` | **niko** (MO-013) |
| `getGasReadings` | GET | `/api/gas/readings` | `GasReadingsScreen`, `GasAnalysisScreen`, `AnalyticsScreen` |
| `getLatestGasReading` | GET | `/api/gas/latest` | **niko** (MO-013) |
| `addGasReading` | POST | `/api/gas/reading` | **niko** (MO-013) |
| `addGasReadingPayload` | POST | `/api/gas/reading` | **niko** (MO-013) |
| `addGasReadingWithUpload` | POST | `/api/gas/reading` (multipart) | `GasReadingsScreen` |
| `updateGasReference` | PATCH | `/api/gas/reading/:id/reference` | `GasReadingsScreen` |
| `uploadGasMeterImage` | POST | `/api/gas/reading/:id/meter-image` | `GasReadingsScreen` |
| `uploadGasInvoice` | POST | `/api/gas/reading/:id/invoice` | `GasReadingsScreen` |
| `deleteGasInvoice` | DELETE | `/api/gas/reading/:id/invoice` | `GasReadingsScreen` |
| `getGasMeterImageEndpoint` | — (gradi URL) | `/api/gas/reading/:id/meter-image` | `GasReadingsScreen` (download) |
| `getGasInvoiceEndpoint` | — (gradi URL) | `/api/gas/reading/:id/invoice` | `GasReadingsScreen` (download) |
| `deleteGasReading` | DELETE | `/api/gas/reading/:id` | `GasReadingsScreen` |
| `getGasAnalysis` | GET | `/api/gas/analysis` | `GasAnalysisScreen` |
| `getBoilerHistory` | GET | `/api/boiler/history` | **niko** (MO-013) |
| `setBoilerCurrentTemp` | PATCH | `/api/boiler/current-temp` | `DashboardScreen` |
| `getNotifications` | GET | `/api/notifications` | `NotificationsScreen` |
| `markNotificationAsRead` | POST | `/api/notifications/:id/read` | `NotificationsScreen` |
| `markAllNotificationsRead` | POST | `/api/notifications/mark-all-read` | `NotificationsScreen` |
| `getNotificationPreferences` | GET | `/api/notifications/preferences` | `NotificationPreferencesScreen` |
| `updateNotificationPreference` | PATCH | `/api/notifications/preferences` | `NotificationPreferencesScreen` |
| `registerPushToken` | POST | `/api/notifications/register-token` | `AuthContext` |
| `getUserProfile` | GET | `/api/user` | `ProfileScreen` |
| `updateUserProfile` | PUT | `/api/user` | `ProfileScreen` |
| `getHomeProfile` | GET | `/api/home-profile` | **niko** (mobile koristi `/home-profiles`) |
| `updateHomeProfile` | PATCH | `/api/home-profile/:id` | **niko** (isto) |
| `getRecommendations` | GET | `/api/recommendations` | **niko** (MO-013; plan 4.2) |
| `getHeatingEvents` | GET | `/api/heating-events` | `HeatingScreen` |
| `setToken` | — (lokalno) | — | `AuthContext` |
| `clearToken` | — (lokalno) | — | `AuthContext` |

**`services/api/homeProfile.api.ts` (7 metoda, vlastita axios instanca — MO-014):**

| Metoda | HTTP | Backend ruta | Potrošač |
|---|---|---|---|
| `getAllHomeProfiles` | GET | `/api/home-profiles` | `HomeManagementScreen` |
| `getHomeProfileById` | GET | `/api/home-profiles/:id` | **niko** (MO-013) |
| `getActiveHomeProfile` | GET | `/api/home-profiles/active` | `AnalyticsScreen` |
| `createHomeProfile` | POST | `/api/home-profiles` | `HomeManagementScreen` |
| `updateHomeProfile` | PATCH | `/api/home-profiles/:id` | `HomeManagementScreen` |
| `deleteHomeProfile` | DELETE | `/api/home-profiles/:id` | `HomeManagementScreen` |
| `switchActiveHome` | PATCH | `/api/home-profiles/:id/activate` | `HomeManagementScreen` |

**`services/api/thermostat.api.ts` (4 metode, vlastita axios instanca — MO-014):**

| Metoda | HTTP | Backend ruta | Potrošač |
|---|---|---|---|
| `getAllDevices` | GET | `/api/devices` | `ScheduleManagementScreen` |
| `getDeviceById` | GET | `/api/devices/:id` | **niko** (MO-013) |
| `getDevicePrograms` | GET | `/api/devices/:id/programs` | `ScheduleManagementScreen` |
| `updateDevice` | PATCH | `/api/devices/:id` | **niko** (MO-013) |

**`src/api/dashboard.api.ts` (4 funkcije, drugi API direktorij — MO-014):**

| Funkcija | Prosljeđuje na | Potrošač |
|---|---|---|
| `getDashboard` | `apiClient.getDashboard` | `DashboardScreen` |
| `getHeatingEvents` | `apiClient.getDashboardHeatingEvents` | **niko** (MO-013) |
| `getHeatingStats` | `apiClient.getDashboardHeatingStats` | **niko** (MO-013) |
| `getLearningTrends` | `apiClient.getDashboardLearningTrends` | **niko** (MO-013) |


Backend rute i njihovi guardovi/owner filteri su u `docs/audit/backend/02-api-catalog.md` (Faza 1). Kolona „potrošač: mobile" ovim je potvrđena.

| Ekran | Poziv | Backend ruta | Bilješka |
|---|---|---|---|
| `LoginScreen` | `apiClient.login` | `POST /api/auth/login` | token u `expo-secure-store` |
| `RegisterScreen` | `apiClient.register` | `POST /api/auth/register` | — |
| `AuthContext` (restore) | `apiClient.getMe` | `GET /api/auth/me` | neuspjeh → `logout()` |
| `SettingsScreen` | `apiClient.changePassword` | `POST /api/auth/change-password` | traži staru lozinku (za razliku od web S-003) |
| `DashboardScreen`, `HeatingScreen` | `getDashboard` / `apiClient.getDashboard` | `GET /api/dashboard` | **dva različita query ključa** za isti endpoint (MO-027) |
| `DashboardScreen` | `apiClient.setBoilerCurrentTemp` | `PATCH /api/boiler/current-temp` | granice 48–55 u klijentu |
| `HeatingScreen` | `apiClient.getHeatingEvents({limit:20})` | `GET /api/heating-events` | defanzivno čita i niz i `{events}` |
| `AnalyticsScreen` | `homeProfileApi.getActiveHomeProfile` | `GET /api/home-profiles/active` | — |
| `AnalyticsScreen` | `analyticsApi.getHeatingSummary/Stats/LearningTrends` | `GET /api/dashboard/heating-summary`, `/heating-stats`, `/learning-trends` | — |
| `AnalyticsScreen` | `analyticsApi.exportAnalytics` | `GET /api/dashboard/export` | backend vraća CSV; **klijent ne može zapisati fajl** (MO-001) |
| `AnalyticsScreen`, `GasAnalysisScreen`, `GasReadingsScreen` | `apiClient.getGasReadings` | `GET /api/gas/readings` | isti query ključ `['gas-readings']` na 3 mjesta (ispravno dijeljenje) |
| `GasReadingsScreen` | `addGasReadingWithUpload` | `POST /api/gas/reading` (multipart) | — |
| `GasReadingsScreen` | `deleteGasReading` | `DELETE /api/gas/reading/:id` | — |
| `GasReadingsScreen` | `updateGasReference` | `PATCH /api/gas/reading/:id/reference` | — |
| `GasReadingsScreen` | `uploadGasMeterImage` / `uploadGasInvoice` / `deleteGasInvoice` | `POST /api/gas/reading/:id/meter-image`, `POST …/invoice`, `DELETE …/invoice` | — |
| `GasReadingsScreen` | `getGasMeterImageEndpoint` / `getGasInvoiceEndpoint` | `GET /api/gas/reading/:id/meter-image`, `GET …/invoice` | download s `Authorization` headerom preko `expo-file-system/legacy` (ispravno) |
| `GasAnalysisScreen` | `apiClient.getGasAnalysis` | `GET /api/gas/analysis` | — |
| `NotificationsScreen` | `getNotifications` / `markNotificationAsRead` / `markAllNotificationsRead` | `GET /api/notifications`, `POST /api/notifications/:id/read`, `POST /api/notifications/mark-all-read` | invalidira nepostojeći ključ `notifications-unread-count` (MO-013) |
| `NotificationPreferencesScreen` | `getNotificationPreferences` / `updateNotificationPreference` | `GET /api/notifications/preferences`, `PATCH /api/notifications/preferences` | — |
| `AuthContext` | `registerPushToken` | `POST /api/notifications/register-token` | nema odjave tokena pri logoutu |
| `ProfileScreen` | `getUserProfile` / `updateUserProfile` | `GET /api/user`, `PUT /api/user` | ručni `useEffect`, bez React Query |
| `HomeManagementScreen` | `homeProfileApi.getAllHomeProfiles` / `switchActiveHome` / `create` / `update` / `delete` | `GET /api/home-profiles`, `PATCH /api/home-profiles/:id/activate`, `POST /api/home-profiles`, `PATCH /api/home-profiles/:id`, `DELETE /api/home-profiles/:id` | backend `findAll` vraća polja „Mobile app expected fields" (MO-026) |
| `ScheduleManagementScreen` | `thermostatApi.getAllDevices` / `getDevicePrograms` | `GET /api/devices`, `GET /api/devices/:id/programs` | read-only |

**Definisano, ali niko ne poziva (mobile):** `apiClient.getLatestGasReading`, `apiClient.addGasReading`, `apiClient.addGasReadingPayload`, `apiClient.getBoilerHistory`, `apiClient.getRecommendations`, `apiClient.getDashboardHeatingStatus`, `homeProfileApi.getHomeProfileById`, `thermostatApi.getDeviceById`, `thermostatApi.updateDevice`, `src/api/dashboard.api.ts` → `getHeatingEvents`/`getHeatingStats`/`getLearningTrends`, `notificationService.setNavigationRef`, `scheduleDailyGasReadingReminder`/`cancelDailyGasReadingReminder` (no-op), `BottomSheetProvider`, `theme/colors.ts`.

**Backend rute koje mobile uopšte ne koristi:** `GET /api/weather`, `GET /api/weather/current/:homeProfileId`, `GET /api/recommendations`, `GET /api/recommendations/today`, `GET /api/boiler/history`, `GET /api/dashboard/heating-status`, `GET /api/anomalies`, `GET /api/notifications/types`, `POST /api/notifications/manual`, `POST /api/boiler/sync`, `POST/DELETE /api/devices…`.

## Testovi i izvođenje — stvarno stanje (2026-10-29)

<!-- mob:commands -->

| Komanda | Rezultat | Dokaz / napomena |
|---|---|---|
| `npm ci --ignore-scripts --no-audit --no-fund` | **exit 0**, 977 paketa, 474 MB | npm upozorenje: „Conflicting peer dependency: react@17.0.2 … peer react@"^16.8.0 \|\| ^17.0.0-rc.1" from @react-types/tabs@3.0.0-alpha.2" (NativeBase lanac) vs instalirani React 19.1.0 (MO-011) |
| `npm run type-check` (`tsc --noEmit`) | **exit 0**, 0 grešaka | `tsconfig.json` uključuje `src`, `App.tsx`, `index.js`; `strict` + `noUnusedLocals` uključeni |
| `npm run lint` (`eslint .`) | **exit 2** | „ESLint couldn't find the config "expo" to extend from" — `eslint-config-expo` nije u `devDependencies` (MO-012) |
| `npm test` (`jest`) | **exit 127** | „sh: 1: jest: not found"; `jest` nije zavisnost, nema `jest.config.*`, nema nijednog test fajla (MO-012) |
| `npx expo config --type public --json` | **exit 0** | `scheme: "myapp"`, `platforms: ["ios","android","web"]`, `version: "1.0.0"`, `android.versionCode: 1`, `extra.EXPO_PUBLIC_API_URL: "https://api.boiler-control.ba101.top/api"`, `eas.projectId` postavljen |
| `npx expo config --type introspect --json` | **exit 0** | `ios.config.usesNonExemptEncryption: false`; `android.permissions: [RECORD_AUDIO, READ_EXTERNAL_STORAGE, WRITE_EXTERNAL_STORAGE, INTERNET]` (MO-025) |
| `npx tsc --noEmit -p ../scripts/audit/mobile-probe/tsconfig.json` | **exit 0** | tri `@ts-expect-error` direktive su iskorištene → `documentDirectory`/`cacheDirectory`/`temporaryDirectory` ne postoje u `expo-file-system` 19.0.22 top-level API-ju (MO-001) |
| `npm run build` | **ne postoji** | `package.json` nema `build` skriptu; `README.md` je dokumentuje (MO-007) |
| `npm run web` | **nije pokrenuto** | `platforms` uključuje `web`, ali `react-native-web` nije u zavisnostima — HIPOTEZA da ne radi |
| EAS build / `eas submit` | **nije pokrenuto** | zahtijeva EAS nalog i mrežu; nije dio ovog audita |
| Testovi na uređaju / emulatoru | **nisu pokrenuti** | nema emulatora ni uređaja u sandboxu; nijedno runtime ponašanje (push, kamera, deep link) nije izvršno potvrđeno |

## Paritet web ↔ mobile (pravilo iz `GEMINI.md`)

| Funkcionalnost | Web (Faza 2) | Mobile | Paritet |
|---|---|---|---|
| Login / register / logout | ✅ (`localStorage`) | ✅ (`expo-secure-store`) | ✅ mehanizam različit, funkcija ista |
| Promjena lozinke | ✅ | ✅ (traži staru lozinku) | ✅ |
| Dashboard | ✅ | ✅ | ✅ |
| Postavljanje polazne temperature | ✅ 48–55 (`BoilerPage` 48–55, `DashboardPage` 46–55) | ✅ 48–55 (`DashboardScreen.tsx:32-33`) | ⚠️ web ima dvije različite granice (FE-010) |
| Health score / alerti | ✅ klijentski | ✅ klijentski, **drugačiji pragovi** | ❌ tri implementacije (MO-015) |
| Weather | ✅ zaseban poziv `GET /api/weather/current/:id` + `system.weather` | ✅ samo `system.weather` iz dashboarda | ❌ mobile nema izbor lokacije ni satnu prognozu |
| Preporuke / „zašto ova temperatura" | ✅ `GET /api/recommendations` | ❌ `getRecommendations` definisan, nikad pozvan | ❌ |
| Gas očitanja + slike + fakture | ✅ | ✅ + kamera/galerija/PDF picker | ✅ mobile širi |
| Gas analitika | ✅ | ✅ + dnevna statistika | ⚠️ različiti izračuni |
| Analitika grijanja + export | ✅ | ✅ export **slomljen** | ❌ (MO-001) |
| Upravljanje domovima | ⚠️ forma bez `location`/`seasonMode` (FE-017) | ✅ puna forma (17 polja) | ❌ obrnuto: web zaostaje |
| Raspored grijanja | ❌ | ✅ read-only prikaz | ❌ |
| Notifikacije + preferencije | ✅ | ✅ | ✅ |
| Profil / cijena plina | ✅ | ✅ | ✅ |
| i18n | 5/14 fajlova (FE-005) | 23/26 ekrana+komponenti, **3 ekrana bez `t()`** | ⚠️ |
| Testovi | 0 (FE-014) | 0 (MO-012) | ❌ |

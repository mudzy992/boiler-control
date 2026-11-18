/** TV app configuration and lightweight shared translation catalog. */
export const APP_VERSION: string =
  require('expo-constants').default?.expoConfig?.version ?? '';

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'https://api.boiler-control.ba101.top/api';

let currentLocale: 'bs' | 'en' = 'bs';
export function setTvLocale(locale: unknown) {
  currentLocale = typeof locale === 'string' && locale.toLowerCase().startsWith('en') ? 'en' : 'bs';
}
export function tvLocaleTag() { return currentLocale === 'en' ? 'en-US' : 'bs-BA'; }

const LABELS: Record<string, string> = {
  'weather.currentShort': 'Vanjska temperatura',
  'thermostat.title': 'Termostat',
  'boiler.flowTemp': 'Polazna voda',
  'gas.metricTotalConsumption': 'Ukupna potrošnja',
  'gas.metricCostIncVat': 'Ukupni trošak',
  'gas.metricHeatingHours': 'Vrijeme grijanja',
  'gas.metricAvgFlowTemp': 'Polazni vod',
  'gas.metricUsagePerHour': 'Potrošnja po satu',
};
const EN_LABELS: Record<string, string> = {
  'weather.currentShort': 'Outdoor temperature',
  'thermostat.title': 'Thermostat',
  'boiler.flowTemp': 'Flow temperature',
  'gas.metricTotalConsumption': 'Total consumption',
  'gas.metricCostIncVat': 'Total cost',
  'gas.metricHeatingHours': 'Heating time',
  'gas.metricAvgFlowTemp': 'Average flow temperature',
  'gas.metricUsagePerHour': 'Usage per hour',
};

const EN_TEXT: Record<string, string> = {
  'Početna': 'Home', 'Grijanje': 'Heating', 'Plin': 'Gas', 'Postavke': 'Settings',
  'Vanjska temperatura': 'Outdoor temperature', 'PODACI ZASTARJELI': 'DATA STALE',
  'PODACI UČITANI': 'DATA LOADED', 'GRIJANJE AKTIVNO': 'HEATING ACTIVE',
  'STATUS SISTEMA': 'SYSTEM STATUS', 'STATUS UČITAN': 'STATUS LOADED',
  'AKTIVNO': 'ACTIVE', 'UPOZORENJA': 'WARNINGS', 'TRENUTNO': 'CURRENT', 'CILJ': 'TARGET',
  'SISTEM ONLINE': 'SYSTEM ONLINE', 'POVEZIVANJE': 'CONNECTING', 'AŽURIRANO': 'UPDATED',
  'ČEKA PODATKE': 'WAITING FOR DATA', 'Kontrolni centar': 'Control center',
  'KONTROLNI CENTAR': 'CONTROL CENTER', 'Pregled': 'Overview', 'Analitika': 'Analytics',
  'Zdravlje': 'Health', 'Zdravlje sistema': 'System health', 'Dobro došli': 'Welcome',
  'Temperatura sobe': 'Room temperature', 'Polazna voda': 'Flow temperature',
  'Trošak plina': 'Gas cost', 'Temperatura doma': 'Home temperature',
  'Grijanje aktivno': 'Heating active', 'Sistem online': 'System online',
  'Stvarno očitanje': 'Live reading', 'Trenutno očitanje': 'Current reading',
  'Cilj': 'Target', 'Očitanje termostata': 'Thermostat reading',
  'Temperatura sistema grijanja': 'Heating system temperature',
  'Iznos vraćen analizom plina': 'Amount from gas analysis', 'Učitavanje stvarnih podataka…': 'Loading live data…',
  'Neki podaci nisu osvježeni': 'Some data is stale', 'Nema dostupnih podataka': 'No data available',
  'Upari TV': 'Pair TV', 'Upari TV sa telefonom': 'Pair TV with your phone',
  'TV je uparen': 'TV paired', 'Učitavam analitiku…': 'Loading analytics…',
  'Kod je istekao': 'Code expired', 'Greška': 'Error', 'Novi kod': 'New code',
  'Pokušaj ponovo': 'Try again',
  'Za prikaz analitike potrebno je upariti ovaj TV sa telefonom.': 'Pair this TV with your phone to view analytics.',
  'Kod vrijedi 5 minuta. Zatraži novi i upari TV ponovo.': 'The code is valid for 5 minutes. Request a new one and pair the TV again.',
  'Na telefonu otvori Postavke → Uređaji → Poveži TV. Skeniraj QR kod kamerom ili ručno unesi kod iznad. Kod vrijedi 5 minuta.': 'On your phone, open Settings → Devices → Connect TV. Scan the QR code or enter the code above. The code is valid for 5 minutes.',
  'ažurno': 'up to date', 'podaci nisu osvježeni': 'data is stale', 'vrijeme nepoznato': 'time unknown',
  'Analitika nije dostupna': 'Analytics unavailable',
  'Dostupna je nova verzija TV aplikacije: v': 'A new TV app version is available: v',
  'Slaba kiša': 'Light rain', 'Jaka kiša': 'Heavy rain', 'Pljuskovi': 'Showers',
  'Jaki pljuskovi': 'Heavy showers', 'Slab snijeg': 'Light snow', 'Jak snijeg': 'Heavy snow',
  'Rosulja': 'Drizzle', 'Sumaglica': 'Haze', 'Grmljavina': 'Thunderstorm', 'Vjetrovito': 'Windy',
  'Oblačno': 'Cloudy', 'Sunčano': 'Sunny', 'Kiša': 'Rain', 'Snijeg': 'Snow',
  'Vedro': 'Clear', 'Djelimično oblačno': 'Partly cloudy', 'Magla': 'Fog',
  'Kontrolna ploča': 'Dashboard', 'Vaš dom': 'Your home', 'Dobro došli,': 'Welcome,',
  'Analiza': 'Analysis', 'Ukupna potrošnja': 'Total consumption',
  'Ukupni trošak': 'Total cost', 'Vrijeme grijanja': 'Heating time', 'Potrošnja': 'Consumption',
  'Potrošnja plina': 'Gas consumption', 'Trošak s PDV-om': 'Cost incl. VAT', 'Trošak ukupno': 'Total cost',
  'Potrošnja ukupno': 'Total consumption', 'Prosjek po danu': 'Daily average',
  'Prosječna mjesečna potrošnja': 'Average monthly consumption', 'Prosječna sobna temperatura': 'Average room temperature',
  'Prosječno trajanje ciklusa': 'Average cycle duration', 'Raspon analize': 'Analysis period',
  'Nedavni ciklusi': 'Recent cycles', 'Ciklusi grijanja': 'Heating cycles', 'Ciklusi u periodu': 'Cycles in period',
  'Broj ciklusa': 'Number of cycles', 'Broj trenutno učitanih zapisa': 'Number of loaded records',
  'Trenutna temperatura': 'Current temperature', 'Ciljna temperatura': 'Target temperature',
  'Trenutna i ciljna temperatura sobe': 'Current and target room temperature',
  'Stanje zdravlja': 'Health status', 'Stanje podataka': 'Data status', 'Status grijanja': 'Heating status',
  'Status TV uređaja': 'TV device status', 'Status sistema': 'System status', 'Zadnji kontakt': 'Last contact',
  'Povezan': 'Connected', 'Nije naveden': 'Not specified', 'Upozorenja': 'Warnings',
  'BEZ UPOZORENJA': 'NO WARNINGS', 'NEMA STATUSA': 'NO STATUS', 'STATUS NEPOZNAT': 'STATUS UNKNOWN',
  'PROVJERITE UPOZORENJA': 'CHECK WARNINGS', 'Potrebna je pažnja': 'Attention required',
  'Nema podataka': 'No data',
  'Nema dovoljno evidentiranih očitanja za grafikon.': 'Not enough recorded readings for a chart.',
  'Nema dovoljno stvarnih temperaturnih očitanja za grafikon.': 'Not enough actual temperature readings for a chart.',
  'Nema komponenti uključenih u ocjenu zdravlja.': 'No components are included in the health score.',
  'Nema nedavnih ciklusa u odgovoru pregleda doma.': 'No recent cycles were returned for the home overview.',
  'Nema obavijesti vraćenih iz API-ja.': 'No notifications were returned by the API.',
  'Nema očitanja vraćenih iz API-ja.': 'No readings were returned by the API.',
  'Nema rasporeda dostupnog iz API-ja.': 'No schedule is available from the API.',
  'Nema rasporeda vraćenog iz API-ja.': 'No schedule was returned by the API.',
  'Događaji iz evidencije grijanja': 'Events from the heating log', 'Iz evidencije ciklusa': 'From cycle history',
  'Izvor preporuke': 'Recommendation source', 'Preporuka sistema': 'System recommendation',
  'Preporučena polazna temperatura': 'Recommended flow temperature', 'Učinkovitost grijanja': 'Heating efficiency',
  'Historija očitanja': 'Reading history', 'Zabilježena stanja plinomjera': 'Recorded gas meter readings',
  'Očitanja evidentirana': 'Recorded readings', 'Učitana očitanja': 'Loaded readings',
  'Prikaz evidentiranih podataka · na TV-u nema dodavanja ni uređivanja': 'Recorded data only · adding and editing are not available on TV',
  'Izmjene profila i uređaja ostaju dostupne u mobilnoj aplikaciji': 'Profile and device changes are available in the mobile app',
  'Obavještenja primljena iz naloga · bez označavanja kao pročitano': 'Account notifications · read-only',
  'Program sinhronizovan s termostatom · nije moguće uređivati na TV-u': 'Schedule synced with thermostat · editing is unavailable on TV',
  'Trenutno sinhronizovani programi · read-only': 'Currently synced schedules · read-only',
  'Status i očitanja uređaja · upravljanje ostaje u mobilnoj aplikaciji': 'Device status and readings · controls remain in the mobile app',
  'Stvarna očitanja iz zadnjih 30 dana': 'Actual readings from the last 30 days',
  'Metrike za aktivni period · bez izmišljenih poređenja': 'Metrics for the active period · no inferred comparisons',
  'Automatske provjere iz API-ja': 'Automatic checks from the API',
  'Ažurirano isključivo iz postojećih GET API-ja': 'Updated only from existing GET APIs',
  'Vrijednosti koje vraća dashboard API': 'Values returned by the dashboard API',
  'Samo stvarni događaji grijanja': 'Actual heating events only',
  'Samo ako je dostupno u API-ju': 'Only when available from the API',
  'Poređenje s prethodnim periodom': 'Comparison with the previous period',
  'PREGLED PODATAKA / ZDRAVLJE DOMA': 'DATA OVERVIEW / HOME HEALTH',
  'ANALITIKA / STATUS UREĐAJA': 'ANALYTICS / DEVICE STATUS',
  'POSTAVKE · SAMO PREGLED': 'SETTINGS · READ ONLY', 'SAMO PREGLED': 'READ ONLY',
  'Profil i postavke': 'Profile and settings', 'Korisnički profil i aktivni dom': 'User profile and active home',
  'Osnovni podaci': 'Basic information', 'Prikazno ime profila': 'Profile display name',
  'Aktivni profil domaćinstva': 'Active household profile', 'Lokacija': 'Location', 'Dom': 'Home',
  'Ime': 'Name', 'E-mail': 'Email', 'Uređaji u nalogu': 'Devices on account', 'Povezani uređaj': 'Connected device',
  'Raspored grijanja': 'Heating schedule', 'Ukupno grijanje': 'Total heating', 'Ukupno trajanje': 'Total duration',
  'U periodu sažetka': 'In summary period', 'Način rada': 'Operating mode', 'Izračunato': 'Calculated',
  'Metrike dostupne kroz gas analysis API': 'Metrics available through the gas analysis API',
  'Podaci direktno iz evidencije': 'Data directly from the log', 'Podaci nisu osvježeni': 'Data not refreshed',
};
const ENUM_BS: Record<string, string> = {
  HEAT: 'Grijanje', AUTO: 'Automatski', OFF: 'Isključeno', COOL: 'Hlađenje',
  MANUAL: 'Ručno', ON: 'Uključeno', ONLINE: 'Povezan', OFFLINE: 'Nije povezan',
  MONDAY: 'Ponedjeljak', TUESDAY: 'Utorak', WEDNESDAY: 'Srijeda', THURSDAY: 'Četvrtak',
  FRIDAY: 'Petak', SATURDAY: 'Subota', SUNDAY: 'Nedjelja',
  DAILY_RECOMMENDATION: 'Dnevna preporuka', FLOW_TEMP_CHANGED: 'Promjena temperature polaza',
  HEATING_STARTED: 'Grijanje je počelo', HEATING_ENDED: 'Grijanje je završeno',
  SYSTEM_ALERT: 'Sistemsko upozorenje', GAS_READING_REMINDER: 'Podsjetnik za očitanje plina',
  WARNING: 'Upozorenje', ERROR: 'Greška', INFO: 'Informacija', SUCCESS: 'Uspješno',
};
const ENUM_EN: Record<string, string> = {
  HEAT: 'Heating', AUTO: 'Automatic', OFF: 'Off', COOL: 'Cooling', MANUAL: 'Manual', ON: 'On',
  ONLINE: 'Connected', OFFLINE: 'Disconnected', MONDAY: 'Monday', TUESDAY: 'Tuesday', WEDNESDAY: 'Wednesday',
  THURSDAY: 'Thursday', FRIDAY: 'Friday', SATURDAY: 'Saturday', SUNDAY: 'Sunday',
  DAILY_RECOMMENDATION: 'Daily recommendation', FLOW_TEMP_CHANGED: 'Flow temperature changed',
  HEATING_STARTED: 'Heating started', HEATING_ENDED: 'Heating ended', SYSTEM_ALERT: 'System alert',
  GAS_READING_REMINDER: 'Gas reading reminder', WARNING: 'Warning', ERROR: 'Error', INFO: 'Info', SUCCESS: 'Success',
};
const WEATHER: Record<string, string> = {
  clear: 'Vedro', sunny: 'Sunčano', 'clear sky': 'Vedro', clouds: 'Oblačno', cloudy: 'Oblačno', overcast: 'Oblačno',
  fewclouds: 'Djelimično oblačno', scatteredclouds: 'Djelimično oblačno', brokenclouds: 'Oblačno',
  partlycloudy: 'Djelimično oblačno', partly_cloudy: 'Djelimično oblačno', rain: 'Kiša', rainy: 'Kiša',
  lightrain: 'Slaba kiša', moderaterain: 'Kiša', heavyintensityrain: 'Jaka kiša', showerrain: 'Pljuskovi',
  drizzle: 'Rosulja', drizzling: 'Rosulja', snow: 'Snijeg', lightsnow: 'Slab snijeg',
  fog: 'Magla', mist: 'Magla', haze: 'Sumaglica', thunderstorm: 'Grmljavina', windy: 'Vjetrovito',
  'wmo_0': 'Vedro', 'wmo_1': 'Vedro', 'wmo_2': 'Djelimično oblačno', 'wmo_3': 'Oblačno',
  'wmo_45': 'Magla', 'wmo_48': 'Magla', 'wmo_51': 'Rosulja', 'wmo_53': 'Rosulja', 'wmo_55': 'Rosulja',
  'wmo_61': 'Kiša', 'wmo_63': 'Kiša', 'wmo_65': 'Jaka kiša', 'wmo_71': 'Snijeg', 'wmo_73': 'Snijeg',
  'wmo_75': 'Jak snijeg', 'wmo_80': 'Pljuskovi', 'wmo_81': 'Pljuskovi', 'wmo_82': 'Jaki pljuskovi',
  'wmo_95': 'Grmljavina', 'wmo_96': 'Grmljavina', 'wmo_99': 'Grmljavina',
};

export function translateText(text: string): string {
  const raw = text.trim();
  const enumKey = raw.toUpperCase();
  const normalizedWeather = WEATHER[raw.toLowerCase().replace(/[\s-]/g, '')]
    ?? WEATHER[raw.toLowerCase()];
  const bosnian = normalizedWeather ?? ENUM_BS[enumKey] ?? text;
  if (currentLocale === 'bs') return bosnian;
  if (ENUM_EN[enumKey]) return ENUM_EN[enumKey];
  if (EN_TEXT[bosnian] || EN_TEXT[text]) return EN_TEXT[bosnian] ?? EN_TEXT[text] ?? text;
  const dynamicPrefixes: Array<[string, string]> = [
    ['Cilj ', 'Target '], ['AŽURIRANO ', 'UPDATED '],
    ['Dostupna je nova verzija TV aplikacije: v', 'A new TV app version is available: v'],
    ['Dobro došli, ', 'Welcome, '], ['Greška pri učitavanju', 'Error loading'],
    ['Neki podaci nisu osvježeni: ', 'Some data is stale: '],
    ['API je odgovorio greškom HTTP ', 'API returned HTTP error '],
    ['Samo pregled · vrijednosti se prikazuju isključivo kada ih postojeći API vrati', 'Read-only · values are shown only when returned by the existing API'],
    ['Samo pregled · ', 'Read-only · '],
  ];
  for (const [prefix, translated] of dynamicPrefixes) if (bosnian.startsWith(prefix)) return translated + bosnian.slice(prefix.length);
  return text;
}

export function translate(key: string): string {
  const catalog = currentLocale === 'en' ? EN_LABELS : LABELS;
  return catalog[key] ?? key;
}

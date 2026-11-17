/**
 * Konfiguracija TV aplikacije.
 *
 * Base URL dolazi iz okoline jer TV nema `localhost`: u razvoju je to adresa
 * računara u lokalnoj mreži, u produkciji javni API. Ugraditi URL u kod
 * značilo bi da se razvojna verzija ne može pokrenuti na TV-u.
 */

/**
 * Verzija instalirane TV aplikacije.
 *
 * Dolazi iz `expo-constants`, tj. iz `app.config.js`, a on iz `package.json` —
 * pa je isti broj koji build upiše u APK. Ručno upisana verzija ovdje bila bi
 * treći izvor i prvi bi se razišao: TV bi tvrdio da je ažuran iako nije.
 */
export const APP_VERSION: string =
  require('expo-constants').default?.expoConfig?.version ?? '';

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'https://api.boiler-control.ba';

/**
 * Prevod za natpise metrika.
 *
 * **Zašto ne `i18next` kao na mobilnom.** TV ima **jedan** ekran i desetak
 * natpisa; puni i18n sloj bi donio bundle i inicijalizaciju zbog kojih bi se
 * prvi ekran sporije prikazao. Natpisi su ovdje, na jednom mjestu, i lako se
 * zamijene kad zatreba drugi jezik.
 */
const LABELS: Record<string, string> = {
  'gas.metricTotalConsumption': 'Ukupna potrošnja',
  'gas.metricCostIncVat': 'Trošak',
  'gas.metricHeatingHours': 'Vrijeme grijanja',
  'gas.metricAvgFlowTemp': 'Polazni vod',
  'gas.metricUsagePerHour': 'Potrošnja po satu',
};

export function translate(key: string): string {
  // Nepoznat ključ vraća sam ključ: bolje vidljiv `gas.metricX` na ekranu
  // nego prazna kartica bez objašnjenja.
  return LABELS[key] ?? key;
}

/**
 * WMO kod → i18n ključ (`F13`, treći krug).
 *
 * Zašto postoji: Početna je za stanje vremena prikazivala **sirov `WMO_80`**, i
 * to na kartici koja koristi stari red (`WeatherRow`). Taj red je imao svoju
 * tabelu naziva („Cloudy", „Light rain"…), ali ona nije znala za WMO prefiks —
 * `WMO_80` se normalizovalo u `wmo80`, nije nađeno u tabeli i otišlo na ekran
 * kako je stiglo.
 *
 * Backend (`src/modules/Weather/wmo.ts`) već ima istu tabelu i šalje
 * `conditionI18nKey` u v2 odgovoru. Ova kopija je za stari put, koji prima samo
 * `condition: "WMO_80"`. Tabela nije prepisana napamet: test
 * `locales/__tests__/weatherConditionKeys.test.ts` poredi **oba** skupa sa
 * backendovim `wmo.ts`, pa se razilaženje ne može tiho dogoditi.
 */
export const WMO_CONDITION_KEYS: Readonly<Record<number, string>> = {
  0: 'clear',
  1: 'mainly_clear',
  2: 'partly_cloudy',
  3: 'overcast',
  45: 'fog',
  48: 'depositing_rime_fog',
  51: 'light_drizzle',
  53: 'moderate_drizzle',
  55: 'dense_drizzle',
  56: 'light_freezing_drizzle',
  57: 'dense_freezing_drizzle',
  61: 'slight_rain',
  63: 'moderate_rain',
  65: 'heavy_rain',
  66: 'light_freezing_rain',
  67: 'heavy_freezing_rain',
  71: 'slight_snowfall',
  73: 'moderate_snowfall',
  75: 'heavy_snowfall',
  77: 'snow_grains',
  80: 'slight_rain_showers',
  81: 'moderate_rain_showers',
  82: 'violent_rain_showers',
  85: 'slight_snow_showers',
  86: 'heavy_snow_showers',
  95: 'thunderstorm',
  96: 'thunderstorm_with_slight_hail',
  99: 'thunderstorm_with_heavy_hail',
};

/**
 * Pretvara `WMO_80` u `slight_rain_showers`.
 *
 * Vraća `null` za sve što nije WMO prefiks — tada se koristi stara tabela
 * naziva („Partly cloudy"), jer taj put i dalje postoji u instaliranim
 * verzijama.
 */
export function wmoConditionKey(condition: string | null | undefined): string | null {
  if (!condition) return null;
  const match = /^wmo[_-]?(\d+)$/i.exec(condition.trim());
  if (!match) return null;
  const code = Number(match[1]);
  if (!Number.isInteger(code)) return null;
  return WMO_CONDITION_KEYS[code] ?? 'unknown';
}

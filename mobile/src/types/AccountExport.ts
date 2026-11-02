export const ACCOUNT_EXPORT_FORMAT = 'boiler-control.account-export' as const;

export const ACCOUNT_EXPORT_COLLECTIONS = [
  'homeProfiles',
  'heatingIntervalLearnings',
  'thermostatDevices',
  'thermostatPrograms',
  'heatingEvents',
  'recommendations',
  'boilerHistories',
  'gasReadings',
  'gasPriceHistory',
  'notifications',
  'notificationPreferences',
  'devices',
  'sessions',
] as const;

export type AccountExportCollectionName = (typeof ACCOUNT_EXPORT_COLLECTIONS)[number];

export interface AccountExportResponse {
  format: typeof ACCOUNT_EXPORT_FORMAT;
  version: 1;
  generatedAt: string;
  account: Record<string, unknown>;
  collections: Record<AccountExportCollectionName, unknown[]>;
}

/**
 * FE2-3: shared React Query keys.
 *
 * Dashboard drawer and NotificationsPage must observe the same notifications
 * cache entry. GasReadingsPage and GasAnalyticsPage must observe the same gas
 * readings cache entry instead of issuing duplicate requests.
 */
export const queryKeys = {
  dashboard: ['dashboard'] as const,
  dashboardHealth: ['dashboard-health'] as const,
  dashboardHeatingRange: (from: string, to: string, bucket: 'hour' | 'day') =>
    ['dashboard-heating-range', from, to, bucket] as const,
  homeProfile: ['home-profile'] as const,
  shadowReport: (homeProfileId: number, from: string, to: string) =>
    ['shadow-report', homeProfileId, from, to] as const,
  dailyHistory: (homeProfileId: number, from: string, to: string, limit: number) =>
    ['daily-history', homeProfileId, from, to, limit] as const,
  weatherCurrent: (homeProfileId: number | undefined) =>
    ['weather-current', homeProfileId] as const,
  notifications: ['notifications'] as const,
  notificationsUnreadCount: ['notifications-unread-count'] as const,
  notificationPreferences: ['notification-preferences'] as const,
  gasReadings: ['gas-readings'] as const,
  gasAnalysisRoot: ['gas-analysis'] as const,
  gasAnalysis: (rangeKey: string) => ['gas-analysis', rangeKey] as const,
  heatingEvents: ['heating-events'] as const,
  boilerEvents: ['boiler-events'] as const,
  reports: ['reports'] as const,
};

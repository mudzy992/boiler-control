/**
 * FE2-3: shared React Query keys.
 *
 * Dashboard drawer and NotificationsPage must observe the same notifications
 * cache entry. GasReadingsPage and GasAnalyticsPage must observe the same gas
 * readings cache entry instead of issuing duplicate requests.
 */
export const queryKeys = {
  dashboard: ["dashboard"] as const,
  dashboardHealth: ["dashboard-health"] as const,
  dashboardHeatingRange: (from: string, to: string, bucket: "hour" | "day") =>
    ["dashboard-heating-range", from, to, bucket] as const,
  homeProfile: ["home-profile"] as const,
  shadowReport: (homeProfileId: number, from: string, to: string) =>
    ["shadow-report", homeProfileId, from, to] as const,
  dailyHistory: (
    homeProfileId: number,
    from: string,
    to: string,
    limit: number,
    offset = 0,
  ) => ["daily-history", homeProfileId, from, to, limit, offset] as const,
  weatherCurrent: (homeProfileId: number | undefined) =>
    ["weather-current", homeProfileId] as const,
  notifications: ["notifications"] as const,
  notificationsUnreadCount: ["notifications-unread-count"] as const,
  notificationPreferences: ["notification-preferences"] as const,
  gasReadings: ["gas-readings"] as const,
  /**
   * `F13`: granica polazne je po domu, pa se kešira zasebno — promjena profila
   * doma mora oboriti samo ovaj upit, ne cijeli dashboard.
   */
  boilerFlowRange: ["boiler-flow-range"] as const,
  gasAnalysisRoot: ["gas-analysis"] as const,
  gasAnalysis: (rangeKey: string) => ["gas-analysis", rangeKey] as const,
  heatingEvents: ["heating-events"] as const,
  /** Straničena tabela događaja grijanja (`36`) — parametri su dio ključa. */
  heatingEventsPage: (
    from: string,
    to: string,
    offset: number,
    limit: number,
  ) => ["heating-events", "page", from, to, offset, limit] as const,
  gasReadingsPage: (from: string, to: string, offset: number, limit: number) =>
    ["gas-readings", "page", from, to, offset, limit] as const,
  boilerEvents: ["boiler-events"] as const,
  reports: ["reports"] as const,
  reportsPage: (limit: number) => ["reports", "page", limit] as const,
  reportsPageFiltered: (
    from: string,
    to: string,
    offset: number,
    limit: number,
  ) => ["reports", "page", from, to, offset, limit] as const,
};

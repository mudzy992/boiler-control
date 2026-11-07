import { apiClient } from './client';

export type TimeBucket = 'hour' | 'day';

export interface HeatingSummaryBucket {
  label: string;
  totalDurationMin: number;
  cycles: number;
  avgTargetTemp: number;
  avgCurrentTemp: number;
}

export interface HeatingSummaryResponse {
  summary: {
    totalCycles: number;
    totalDurationMin: number;
    avgDurationMin: number;
    avgIndoorTemp: number;
  };
  buckets: HeatingSummaryBucket[];
}

export interface HeatingStatsBucket {
  label: string;
  avgTargetTemp: number;
  avgCurrentTemp: number;
  totalDurationMin: number;
  cycles: number;
}

export interface HeatingStatsResponse {
  buckets: HeatingStatsBucket[];
}

export interface LearningTrendPoint {
  date: string;
  avgConfidence: number;
  samples: number;
}

export interface LearningTrendsResponse {
  points: LearningTrendPoint[];
}

export interface ExportAnalyticsResponse {
  summary: HeatingSummaryResponse;
  stats: HeatingStatsResponse;
  learning: LearningTrendsResponse;
  export: {
    format: 'csv';
    contentType: string;
    filename: string;
    content: string;
  };
}

export interface DateRangeParams {
  from: string;
  to: string;
  homeProfileId: number;
  bucket?: TimeBucket;
  deviceId?: number;
}

/**
 * F3 (nalaz UX-13): poređenje s prethodnim periodom.
 *
 * Prije: kartice su ispisivale „u odnosu na prošlu sedmicu" uz hardkodiranu
 * strelicu, a dohvatan je SAMO tekući raspon — poređenje koje tekst tvrdi
 * nikad se nije izvršilo. Sada se prethodni raspon dohvata istim pozivom
 * (isti endpoint, isti ugovor), sa identičnom dužinom perioda.
 */
export type PreviousPeriodParams = DateRangeParams;

export const analyticsApi = {
  getHeatingSummary: async (params: DateRangeParams): Promise<HeatingSummaryResponse> => {
    return await apiClient.getDashboardHeatingSummary(params);
  },

  getHeatingStats: async (params: DateRangeParams): Promise<HeatingStatsResponse> => {
    return await apiClient.getDashboardHeatingStats(params);
  },

  getLearningTrends: async (params: DateRangeParams): Promise<LearningTrendsResponse> => {
    return await apiClient.getDashboardLearningTrends(params);
  },

  exportAnalytics: async (params: DateRangeParams): Promise<ExportAnalyticsResponse> => {
    return await apiClient.getDashboardExport(params);
  },

  /** Isti endpoint i isti ugovor kao `getHeatingSummary`, za prethodni raspon. */
  getPreviousSummary: async (params: PreviousPeriodParams): Promise<HeatingSummaryResponse> => {
    return await apiClient.getDashboardHeatingSummary(params);
  },
};

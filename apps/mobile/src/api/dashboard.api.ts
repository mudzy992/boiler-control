import { apiClient } from '../services/api/client';
import type { DashboardResponse, HeatingEventRow, HeatingStatsBucket } from '../types/Dashboard';

export interface HeatingEventsParams {
  homeProfileId: number;
  from: string;
  to: string;
}

export interface HeatingStatsParams {
  homeProfileId: number;
  from: string;
  to: string;
  bucket: 'hour' | 'day';
}

export interface LearningTrendsParams {
  homeProfileId: number;
  from: string;
  to: string;
}

/**
 * Fetch main dashboard data including system info, homes, thermostats, and recent events
 */
export const getDashboard = async (): Promise<DashboardResponse> => {
  return await apiClient.getDashboard();
};

/**
 * Fetch heating events for a specific home within a date range
 */
export const getHeatingEvents = async (params: HeatingEventsParams): Promise<HeatingEventRow[]> => {
  return await apiClient.getDashboardHeatingEvents({
    homeProfileId: params.homeProfileId,
    from: params.from,
    to: params.to,
  });
};

/**
 * Fetch heating statistics (temperature, cycles) for a home
 */
export const getHeatingStats = async (
  params: HeatingStatsParams
): Promise<HeatingStatsBucket[]> => {
  return await apiClient.getDashboardHeatingStats({
    homeProfileId: params.homeProfileId,
    from: params.from,
    to: params.to,
    bucket: params.bucket,
  });
};

/**
 * Fetch learning model trends and predictions
 */
export const getLearningTrends = async (_params: LearningTrendsParams): Promise<any> => {
  return await apiClient.getDashboardLearningTrends({
    homeProfileId: _params.homeProfileId,
    from: _params.from,
    to: _params.to,
  });
};

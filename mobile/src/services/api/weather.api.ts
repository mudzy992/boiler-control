import { apiClient } from './client';
import type {
  ConfirmWeatherLocationResponse,
  WeatherLocationCandidatesResponse,
  WeatherV2Response,
} from '../../types/WeatherV2';

export const weatherV2Keys = {
  all: ['weather-v2'] as const,
  current: (homeProfileId: number) => ['weather-v2', homeProfileId] as const,
};

export const weatherApi = {
  getCurrent: async (homeProfileId: number): Promise<WeatherV2Response> => {
    return await apiClient.getWeatherV2(homeProfileId);
  },

  getLocationCandidates: async (
    homeProfileId: number,
    query: string,
  ): Promise<WeatherLocationCandidatesResponse> => {
    return await apiClient.getWeatherLocationCandidates(homeProfileId, query);
  },

  confirmLocation: async (
    homeProfileId: number,
    query: string,
    candidateId: string,
  ): Promise<ConfirmWeatherLocationResponse> => {
    return await apiClient.confirmWeatherLocation(homeProfileId, query, candidateId);
  },
};

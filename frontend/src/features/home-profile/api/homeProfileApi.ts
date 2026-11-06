/**
 * HomeProfile API — FE2-8: tipovi iz OpenAPI, ne ručno pisani.
 *
 * Koristi `components['schemas']` tipove iz `src/types/api.d.ts`
 * (generisani iz `contracts/openapi.json`). Ručno pisani DTO-vi
 * (`types/index.ts`) se koriste samo gde OpenAPI spec još nema
 * `@ApiProperty()` dekoratora na backend DTO-ovima.
 */

import type {
  CreateHomeProfileDto,
  HomeProfileResponse,
  UpdateHomeProfileDto,
} from '../types';
import { apiClient } from '../../../services/api';

export const homeProfileApi = {
  /** Dohvati profil doma za trenutnog korisnika. */
  getHomeProfile: async (): Promise<HomeProfileResponse> => {
    return apiClient.get<HomeProfileResponse>('/home-profile');
  },

  /** Kreira novi profil doma. */
  createHomeProfile: async (
    dto: CreateHomeProfileDto,
  ): Promise<HomeProfileResponse> => {
    return apiClient.post<HomeProfileResponse>('/home-profile', dto);
  },

  /** Ažurira postojeci profil doma. */
  updateHomeProfile: async (
    id: number,
    dto: UpdateHomeProfileDto,
  ): Promise<HomeProfileResponse> => {
    return apiClient.patch<HomeProfileResponse>(`/home-profile/${id}`, dto);
  },
};

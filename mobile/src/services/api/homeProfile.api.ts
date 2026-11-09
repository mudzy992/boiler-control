import axios from 'axios';
import { API_CONFIG } from '../../config/api.config';
import { SecureStorage } from '../storage/SecureStorage';
import {
  InsulationType,
  WindowType,
  HeatingType,
  SeasonMode,
} from '../../constants/homeProfileEnums';

import type { BoilerCatalog } from '../../screens/home/boilerCatalog';

export interface HomeProfile {
  id: number;
  userId: number;
  name?: string;
  isActive: boolean;
  thermostats: number;
  createdAt: string;
  homeName: string;
  location?: string;
  floorArea: number;
  ceilingHeight: number;
  insulationType: InsulationType;
  insulationThickness: number;
  windowType: WindowType;
  heatingType: HeatingType;
  constructionYear: number;
  numberOfResidents: number;
  /** Zastarjelo: slobodan tekst. Zadržan samo za prikaz ranijeg unosa. */
  boilerModel: string | null;
  /** Model iz kataloga (`25`); `null` = nije odabran, pa nema savjeta. */
  boilerCatalogId?: string | null;
  /** Snaga izvedbe iz kataloga; traži se kad porodica navodi snage. */
  boilerOutputKw?: number | null;
  /** Najviša polazna koju sistem dozvoljava (30–55); `null` = granica kotla. */
  maxHeatingFlowC?: number | null;
  hasFloorHeating: boolean;
  targetMorningTemp: number;
  targetDayTemp: number;
  targetNightTemp: number;
  preferredScheduleNotes?: string;
  learningOffset?: number;
  learningConfidence?: number;
  seasonMode: SeasonMode;
  updatedAt: string;
}

export interface CreateHomeProfileDto {
  homeName: string;
  location?: string;
  floorArea: number;
  ceilingHeight: number;
  insulationType: InsulationType;
  insulationThickness: number;
  windowType: WindowType;
  heatingType: HeatingType;
  constructionYear: number;
  hasFloorHeating: boolean;
  targetMorningTemp: number;
  targetDayTemp: number;
  targetNightTemp: number;
  numberOfResidents?: number;
  boilerModel?: string;
  boilerCatalogId?: string | null;
  boilerOutputKw?: number | null;
  maxHeatingFlowC?: number | null;
  seasonMode?: SeasonMode;
}

export interface UpdateHomeProfileDto {
  homeName?: string;
  location?: string;
  floorArea?: number;
  ceilingHeight?: number;
  insulationType?: InsulationType;
  insulationThickness?: number;
  windowType?: WindowType;
  heatingType?: HeatingType;
  constructionYear?: number;
  hasFloorHeating?: boolean;
  targetMorningTemp?: number;
  targetDayTemp?: number;
  targetNightTemp?: number;
  numberOfResidents?: number;
  boilerModel?: string;
  boilerCatalogId?: string | null;
  boilerOutputKw?: number | null;
  maxHeatingFlowC?: number | null;
  seasonMode?: SeasonMode;
}

const getClient = async () => {
  const token = await SecureStorage.getToken();
  return axios.create({
    baseURL: API_CONFIG.BASE_URL,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    timeout: API_CONFIG.TIMEOUT,
  });
};

export const homeProfileApi = {
  /**
   * Katalog bojlera (`25` §5.1) — izbor je trostepen: marka → porodica → snaga.
   *
   * Plural ruta: katalog izlaže `HomeProfilesController`; singularni
   * `/home-profile` ga nema.
   */
  getBoilerCatalog: async (): Promise<BoilerCatalog> => {
    const client = await getClient();
    const response = await client.get('/home-profiles/boiler-catalog');
    return response.data;
  },

  getAllHomeProfiles: async (): Promise<HomeProfile[]> => {
    const client = await getClient();
    const response = await client.get('/home-profiles');
    return response.data;
  },

  getHomeProfileById: async (id: number): Promise<HomeProfile> => {
    const client = await getClient();
    const response = await client.get(`/home-profiles/${id}`);
    return response.data;
  },

  getActiveHomeProfile: async (): Promise<HomeProfile> => {
    const client = await getClient();
    const response = await client.get('/home-profiles/active');
    return response.data;
  },

  createHomeProfile: async (data: CreateHomeProfileDto): Promise<HomeProfile> => {
    const client = await getClient();
    const response = await client.post('/home-profiles', data);
    return response.data;
  },

  updateHomeProfile: async (id: number, data: UpdateHomeProfileDto): Promise<HomeProfile> => {
    const client = await getClient();
    const response = await client.patch(`/home-profiles/${id}`, data);
    return response.data;
  },

  deleteHomeProfile: async (id: number): Promise<void> => {
    const client = await getClient();
    await client.delete(`/home-profiles/${id}`);
  },

  switchActiveHome: async (id: number): Promise<HomeProfile> => {
    const client = await getClient();
    const response = await client.patch(`/home-profiles/${id}/activate`);
    return response.data;
  },
};

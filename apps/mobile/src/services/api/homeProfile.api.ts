import axios from 'axios';
import { API_CONFIG } from '../../config/api.config';
import { SecureStorage } from '../storage/SecureStorage';
import {
  InsulationType,
  WindowType,
  HeatingType,
  SeasonMode,
} from '../../constants/homeProfileEnums';

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
  boilerModel: string;
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

// TypeScript interfaces for HomeProfile API
import {
  InsulationType,
  WindowType,
  HeatingType,
  SeasonMode,
} from '../constants/homeProfileEnums';

export interface CreateHomeProfileDto {
  homeName?: string;
  floorArea: number;
  ceilingHeight: number;
  insulationType: InsulationType;
  insulationThickness: number;
  windowType: WindowType;
  heatingType: HeatingType;
  constructionYear: number;
  numberOfResidents?: number;
  boilerModel?: string;
  hasFloorHeating?: boolean;
  targetMorningTemp?: number;
  targetDayTemp?: number;
  targetNightTemp?: number;
  preferredScheduleNotes?: string;
  seasonMode?: SeasonMode;
}

export interface UpdateHomeProfileDto {
  homeName?: string;
  floorArea?: number;
  ceilingHeight?: number;
  insulationType?: InsulationType;
  insulationThickness?: number;
  windowType?: WindowType;
  heatingType?: HeatingType;
  constructionYear?: number;
  numberOfResidents?: number;
  boilerModel?: string;
  hasFloorHeating?: boolean;
  targetMorningTemp?: number;
  targetDayTemp?: number;
  targetNightTemp?: number;
  preferredScheduleNotes?: string;
  seasonMode?: SeasonMode;
}

export interface HomeProfileResponse {
  id: number;
  userId: number;
  homeName?: string;
  floorArea: number;
  ceilingHeight: number;
  insulationType: InsulationType;
  insulationThickness: number;
  windowType: WindowType;
  heatingType: HeatingType;
  constructionYear: number;
  numberOfResidents?: number;
  boilerModel?: string;
  hasFloorHeating: boolean;
  targetMorningTemp?: number;
  targetDayTemp?: number;
  targetNightTemp?: number;
  preferredScheduleNotes?: string;
  learningOffset: number;
  learningConfidence: number;
  seasonMode: SeasonMode;
  createdAt: string;
  updatedAt: string;
}

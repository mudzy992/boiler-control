// heating/engine/types.ts

export type FlowCalcMode = 'FULL' | 'PROFILE_ONLY' | 'ANONYMOUS';

export interface WeatherInput {
  tempMin: number;
  tempMax: number;
}

// heating/engine/types.ts

export interface HomeProfileInput {
  floorArea: number;
  ceilingHeight?: number; // visina plafona u cm, default 230
  insulationType?: 'STANDARD' | 'EPS' | 'MINERAL_WOOL' | 'ADVANCED'; // tip izolacije
  insulationThickness?: number; // debljina izolacije u cm
  windowType?: 'SINGLE_GLAZED' | 'DOUBLE_GLAZED' | 'TRIPLE_GLAZED'; // tip prozora
  heatingType?: 'RADIATOR' | 'UNDERFLOOR' | 'MIXED'; // tip grijanja
  learningOffset?: number; // ± korekcija krivulje
  confidence?: number; // 0–1, koliko vjerujemo offset-u
  insulationFactor?: number; // interno, može ostati opcionalno
}

export interface IntervalLearningInput {
  offset: number;
  confidence: number;
  avgOvershoot?: number;
  avgReachTimeMin?: number;
  samples?: number;
}

export interface HeatingEventInput {
  delta: number; // targetTemp - currentTemp
  active: boolean;
}

export interface FlowTempInput {
  mode: FlowCalcMode;
  weather: WeatherInput;
  homeProfile: HomeProfileInput;
  intervalKey?: string;
  intervalLearning?: IntervalLearningInput;
  recentEvents?: HeatingEventInput[];
}

export interface FlowTempResult {
  baseCurveTemp: number;
  weightedExternalTemp: number;
  appliedOffsets: {
    home: number;
    interval: number;
    events: number;
  };
  finalTemp: number;
  confidence: number;
}

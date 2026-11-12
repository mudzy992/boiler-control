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
  /**
   * Granice koje **ovaj dom** dozvoljava (`F13`). Motor ih ne smije prekoračiti
   * ni u jednu stranu — inače vraća broj koji korisnik ne može upisati na kotao.
   * `null`/`undefined` = važi sistemski raspon iz `BaseHeatingStrategy`.
   */
  minFlowC?: number | null;
  maxFlowC?: number | null;
}

export interface IntervalLearningInput {
  offset: number;
  confidence: number;
  /**
   * @deprecated F5.4: premašivanje je ulazilo **dvaput** (`offset` i ovo, sa
   * težinama 1 i 0,5). Polje ostaje jer ga čita API ugovor i dashboard, ali
   * **strategija ga više ne koristi** — koristi `p90OvershootC`.
   */
  avgOvershoot?: number;
  /**
   * F5.4: 90. percentil premašivanja (K). Zamjenjuje `avgOvershoot` u
   * strategiji: prosjek je nosio dva dana od 5 K kao da su tipični dani.
   * `null`/`undefined` = nema mjerenja (red prije F5.4) ⇒ korekcija se ne
   * primjenjuje, a stara vrijednost se **ne** vraća kao zamjena.
   */
  p90OvershootC?: number | null;
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

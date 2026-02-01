// CreateHomeProfileDto
export interface HomeProfile {
  floorArea: number;
  ceilingHeight: number;
  insulationType: string;
  insulationThickness: number;
  windowType: string;
  heatingType: string;
  constructionYear: number;
  seasonMode: 'WINTER' | 'SUMMER' | 'AUTO';
}

// UpdateHomeProfileDto
export type UpdateHomeProfile = Partial<HomeProfile>;

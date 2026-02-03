// Enum constants for HomeProfile - matches backend Prisma enums

export enum InsulationType {
  STANDARD = 'STANDARD',
  EPS = 'EPS',
  MINERAL_WOOL = 'MINERAL_WOOL',
  ADVANCED = 'ADVANCED',
}

export enum WindowType {
  SINGLE_GLAZED = 'SINGLE_GLAZED',
  DOUBLE_GLAZED = 'DOUBLE_GLAZED',
  TRIPLE_GLAZED = 'TRIPLE_GLAZED',
}

export enum HeatingType {
  RADIATOR = 'RADIATOR',
  UNDERFLOOR = 'UNDERFLOOR',
  MIXED = 'MIXED',
}

export enum SeasonMode {
  WINTER = 'WINTER',
  SUMMER = 'SUMMER',
  AUTO = 'AUTO',
}

// Select options for Ant Design Select components
export const INSULATION_TYPE_OPTIONS = [
  { label: 'Standard (5-8cm foam)', value: InsulationType.STANDARD },
  { label: 'EPS Styrofoam (8-12cm)', value: InsulationType.EPS },
  { label: 'Mineral Wool (8-12cm)', value: InsulationType.MINERAL_WOOL },
  { label: 'Advanced PIR/PUR (6-8cm)', value: InsulationType.ADVANCED },
];

export const WINDOW_TYPE_OPTIONS = [
  { label: 'Single Glazed', value: WindowType.SINGLE_GLAZED },
  { label: 'Double Glazed (PVC)', value: WindowType.DOUBLE_GLAZED },
  { label: 'Triple Glazed', value: WindowType.TRIPLE_GLAZED },
];

export const HEATING_TYPE_OPTIONS = [
  { label: 'Radiators', value: HeatingType.RADIATOR },
  { label: 'Underfloor Heating', value: HeatingType.UNDERFLOOR },
  { label: 'Mixed (Both)', value: HeatingType.MIXED },
];

export const SEASON_MODE_OPTIONS = [
  { label: 'Winter', value: SeasonMode.WINTER },
  { label: 'Summer', value: SeasonMode.SUMMER },
  { label: 'Auto', value: SeasonMode.AUTO },
];

import {
  HeatingType,
  InsulationType,
  SeasonMode,
  WindowType,
} from '../../constants/homeProfileEnums';

/**
 * MO2-20: edit form must preserve falsy backend values (`0`, `false`, `''`).
 * Defaults are only for null/undefined, not for every falsy value.
 */
export interface HomeProfileFormSource {
  homeName?: string | null;
  name?: string | null;
  location?: string | null;
  floorArea?: number | null;
  ceilingHeight?: number | null;
  insulationType?: InsulationType | null;
  insulationThickness?: number | null;
  windowType?: WindowType | null;
  heatingType?: HeatingType | null;
  constructionYear?: number | null;
  hasFloorHeating?: boolean | null;
  targetMorningTemp?: number | null;
  targetDayTemp?: number | null;
  targetNightTemp?: number | null;
  numberOfResidents?: number | null;
  boilerModel?: string | null;
  boilerCatalogId?: string | null;
  boilerOutputKw?: number | null;
  maxHeatingFlowC?: number | null;
  seasonMode?: SeasonMode | null;
}

export interface HomeProfileFormValues {
  homeName: string;
  location: string;
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
  numberOfResidents: number;
  /** Zastarjelo: samo prikaz ranije unesenog teksta (`19` §1). */
  boilerModel: string;
  /** Model iz kataloga; `''` = nije odabran. */
  boilerCatalogId: string;
  /** Snaga izvedbe; `null` = nije odabrana (ili je porodica ne navodi). */
  boilerOutputKw: number | null;
  /** Najviša polazna; `null` = granica kotla, polje nije postavljeno. */
  maxHeatingFlowC: number | null;
  seasonMode: SeasonMode;
}

export function homeProfileToForm(home: HomeProfileFormSource): HomeProfileFormValues {
  return {
    homeName: home.homeName ?? home.name ?? '',
    location: home.location ?? '',
    floorArea: home.floorArea ?? 100,
    ceilingHeight: home.ceilingHeight ?? 2.6,
    insulationType: home.insulationType ?? InsulationType.STANDARD,
    insulationThickness: home.insulationThickness ?? 12,
    windowType: home.windowType ?? WindowType.DOUBLE_GLAZED,
    heatingType: home.heatingType ?? HeatingType.RADIATOR,
    constructionYear: home.constructionYear ?? new Date().getFullYear(),
    hasFloorHeating: home.hasFloorHeating ?? false,
    targetMorningTemp: home.targetMorningTemp ?? 22,
    targetDayTemp: home.targetDayTemp ?? 20,
    targetNightTemp: home.targetNightTemp ?? 18,
    numberOfResidents: home.numberOfResidents ?? 2,
    boilerModel: home.boilerModel ?? '',
    boilerCatalogId: home.boilerCatalogId ?? '',
    boilerOutputKw: home.boilerOutputKw ?? null,
    maxHeatingFlowC: home.maxHeatingFlowC ?? null,
    seasonMode: home.seasonMode ?? SeasonMode.WINTER,
  };
}

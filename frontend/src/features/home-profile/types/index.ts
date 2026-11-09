/**
 * HomeProfile tipovi — FE2-8 (single source of truth iz OpenAPI).
 *
 * `CreateHomeProfileDto` i `UpdateHomeProfileDto` u generisanim OpenAPI
 * tipovima su `Record<string, never>` (backend ih još nije označio
 * `@ApiProperty()` dekoratorima), pa se za njih koristi ručno pisani
 * interfejs sa JSDoc bilješkom. `HomeProfileHeatingType`,
 * `HomeProfileInsulationType`, `HomeProfileWindowType` se preuzimaju iz
 * generisanog `components['schemas']`.
 *
 * Kada backend doda `@ApiProperty()` na Create/Update DTO-ve i
 * regeneriše se `contracts/openapi.json`, ovaj fajl se skraćuje na
 * samo re-export iz `api.d.ts`.
 */

import { InsulationType, WindowType, HeatingType } from '../../../constants/homeProfileEnums';

/** HomeProfile enumovi — preuzeti iz backend-konzistentnih konstanti (isti su kao OpenAPI unioni). */
export type HomeProfileHeatingType = HeatingType;
export type HomeProfileInsulationType = InsulationType;
export type HomeProfileWindowType = WindowType;

/** Privremeni ručno pisani DTO-vi dok OpenAPI spec ne pokrije puna polja. */
export interface CreateHomeProfileDto {
  homeName?: string;
  floorArea: number;
  ceilingHeight: number;
  insulationType: HomeProfileInsulationType;
  insulationThickness: number;
  windowType: HomeProfileWindowType;
  heatingType: HomeProfileHeatingType;
  constructionYear: number;
  numberOfResidents?: number;
  /** @deprecated Zamijenjeno katalogom (`25`); šalje se samo radi starih zapisa. */
  boilerModel?: string;
  boilerCatalogId?: string | null;
  /** Snaga izvedbe iz kataloga (`outputsKw`); traži se kad porodica navodi snage. */
  boilerOutputKw?: number | null;
  /** Najviša polazna koju sistem dozvoljava (30–55). `null` = granica kotla. */
  maxHeatingFlowC?: number | null;
  hasFloorHeating?: boolean;
  targetMorningTemp?: number;
  targetDayTemp?: number;
  targetNightTemp?: number;
  preferredScheduleNotes?: string;
}

/** Privremeni ručno pisani DTO-vi za ažuriranje (svi opcioni). */
export interface UpdateHomeProfileDto extends Partial<CreateHomeProfileDto> {}

/** Odgovor sa backenda — mapa se na generisane tipove gde postoji. */
export interface HomeProfileResponse {
  id: number;
  userId: number;
  homeName?: string;
  floorArea: number;
  ceilingHeight: number;
  insulationType: HomeProfileInsulationType;
  insulationThickness: number;
  windowType: HomeProfileWindowType;
  heatingType: HomeProfileHeatingType;
  constructionYear: number;
  numberOfResidents?: number;
  boilerModel?: string;
  boilerCatalogId?: string | null;
  boilerOutputKw?: number | null;
  maxHeatingFlowC?: number | null;
  hasFloorHeating: boolean;
  targetMorningTemp?: number;
  targetDayTemp?: number;
  targetNightTemp?: number;
  preferredScheduleNotes?: string;
  learningOffset: number;
  learningConfidence: number;
  seasonMode?: string;
  createdAt: string;
  updatedAt: string;
}

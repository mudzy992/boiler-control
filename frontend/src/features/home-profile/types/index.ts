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

import type { components } from '../../../types/api';

/** Generisano iz OpenAPI — unija stringova, bez `any`. */
export type HomeProfileHeatingType = components['schemas']['HomeProfileHeatingType'];
export type HomeProfileInsulationType = components['schemas']['HomeProfileInsulationType'];
export type HomeProfileWindowType = components['schemas']['HomeProfileWindowType'];

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
  boilerModel?: string;
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

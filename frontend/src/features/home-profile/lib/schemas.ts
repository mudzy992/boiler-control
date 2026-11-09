/**
 * Zod sheme za runtime validaciju HomeProfile DTO-ova.
 *
 * Backend može vratiti podatke koji ne odgovaraju TypeScript interfejsu
 * (npr. stari deployment, ručna izmjena baze). Zod shema graniči podatke
 * na ulazu iz API-ja i na ulazu iz forme pre slanja, sprječavajući
 * `any` propadanje u tipovani kod.
 *
 * Ove sheme su izvor istine za *runtime* strukturu; TypeScript interfejsi
 * iz `types/index.ts` su izvor istine za *compile-time* strukturu.
 */

import { z } from 'zod';

export const HomeProfileHeatingTypeSchema = z.enum(['RADIATOR', 'UNDERFLOOR', 'MIXED']);
export const HomeProfileInsulationTypeSchema = z.enum([
  'STANDARD',
  'EPS',
  'MINERAL_WOOL',
  'ADVANCED',
]);
export const HomeProfileWindowTypeSchema = z.enum([
  'SINGLE_GLAZED',
  'DOUBLE_GLAZED',
  'TRIPLE_GLAZED',
]);

export const CreateHomeProfileSchema = z.object({
  homeName: z.string().min(1).max(100).optional(),
  floorArea: z.number().positive().max(10000),
  ceilingHeight: z.number().positive().max(50),
  insulationType: HomeProfileInsulationTypeSchema,
  insulationThickness: z.number().nonnegative().max(1000),
  windowType: HomeProfileWindowTypeSchema,
  heatingType: HomeProfileHeatingTypeSchema,
  constructionYear: z.number().int().min(1800).max(new Date().getFullYear()),
  numberOfResidents: z.number().int().min(1).max(50).optional(),
  // Zastarjelo: prima se da stari podaci ne puknu, odluke ne zavise od njega.
  boilerModel: z.string().max(100).optional(),
  boilerCatalogId: z.string().min(1).max(100).optional(),
  hasFloorHeating: z.boolean().optional(),
  targetMorningTemp: z.number().min(10).max(35).optional(),
  targetDayTemp: z.number().min(10).max(35).optional(),
  targetNightTemp: z.number().min(10).max(35).optional(),
  preferredScheduleNotes: z.string().max(500).optional(),
});

export const UpdateHomeProfileSchema = CreateHomeProfileSchema.partial();

export const HomeProfileResponseSchema = z.object({
  id: z.number(),
  userId: z.number(),
  homeName: z.string().optional(),
  floorArea: z.number().positive(),
  ceilingHeight: z.number().positive(),
  insulationType: HomeProfileInsulationTypeSchema,
  insulationThickness: z.number().nonnegative(),
  windowType: HomeProfileWindowTypeSchema,
  heatingType: HomeProfileHeatingTypeSchema,
  constructionYear: z.number().int(),
  numberOfResidents: z.number().int().optional(),
  boilerModel: z.string().optional(),
  boilerCatalogId: z.string().nullable().optional(),
  hasFloorHeating: z.boolean(),
  targetMorningTemp: z.number().optional(),
  targetDayTemp: z.number().optional(),
  targetNightTemp: z.number().optional(),
  preferredScheduleNotes: z.string().optional(),
  learningOffset: z.number(),
  learningConfidence: z.number(),
  seasonMode: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

/** Tipovi izvođeni iz Zod shema (runtime <-> compile-time sinkronizacija). */
export type CreateHomeProfileInput = z.infer<typeof CreateHomeProfileSchema>;
export type UpdateHomeProfileInput = z.infer<typeof UpdateHomeProfileSchema>;
export type HomeProfileResponseOutput = z.infer<typeof HomeProfileResponseSchema>;

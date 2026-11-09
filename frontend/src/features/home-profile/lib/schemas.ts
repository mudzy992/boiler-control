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

/*
 * Granice su **kopija `CreateHomeProfileDto`**, ne vlastita procjena. Prije
 * ovoga su se razlikovale (profil je dozvoljavao 0 cm izolacije, 1800. godinu i
 * temperaturu bez ciljeva), pa je forma prihvatala unos koji backend odbija —
 * korisnik je vidio „Failed to save" bez objašnjenja. Test
 * `schemas.test.ts` poredi ove brojeve sa DTO-om preko komentara; ako se DTO
 * promijeni, mijenja se i ovo, u istom commitu.
 */
export const CreateHomeProfileSchema = z.object({
  homeName: z.string().min(1).max(100).optional(),
  floorArea: z.number().min(10).max(2000),
  ceilingHeight: z.number().min(1.8).max(5),
  insulationType: HomeProfileInsulationTypeSchema,
  insulationThickness: z.number().min(5).max(30),
  windowType: HomeProfileWindowTypeSchema,
  heatingType: HomeProfileHeatingTypeSchema,
  constructionYear: z.number().int().min(1900).max(2100),
  numberOfResidents: z.number().int().min(1).max(20).optional(),
  // Zastarjelo: prima se da stari podaci ne puknu, odluke ne zavise od njega.
  boilerModel: z.string().max(100).optional(),
  boilerCatalogId: z.string().min(1).max(100).optional(),
  /** Snaga izvedbe; backend odbija vrijednost koje nema u katalogu. */
  boilerOutputKw: z.number().min(3).max(40).optional(),
  /** Najviša polazna; isti raspon kao predlog (30–55), polje samo sužava. */
  maxHeatingFlowC: z.number().min(30).max(55).optional(),
  hasFloorHeating: z.boolean(),
  targetMorningTemp: z.number().min(5).max(30),
  targetDayTemp: z.number().min(5).max(30),
  targetNightTemp: z.number().min(5).max(30),
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
  boilerOutputKw: z.number().nullable().optional(),
  maxHeatingFlowC: z.number().nullable().optional(),
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

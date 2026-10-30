import { ApiProperty } from '@nestjs/swagger';

/**
 * ODGOVOR ŠEME za Dashboard.
 *
 * Svaki tip i nullable-ost dolazi iz `dashboard.service.ts` i
 * `prisma/schema.prisma`. NIJEDNO polje nije izmišljeno.
 *
 * VAŽNO — `getDashboard()` IMA DVIJE RAZLIČITE GRANE (verificirano):
 *   anonimna (l.37)        -> `system` NEMA ključ `boiler`, a `recommendation`
 *                             je `{date:number, recommendedFlowTemp, source}`
 *   autentificirana (l.161) -> `system` IMA `boiler`, a `recommendation` je
 *                             zapis iz modela `Recommendation` ili `null`
 * `boiler` je zato opcionalan, a `recommendation` je unija oba oblika.
 */

const DATE_TIME = { type: String, format: 'date-time' } as const;

/**
 * `transformWeather()` (dashboard.service.ts:583).
 *
 * Svako polje je `data.<x> ?? null`, pa su SVA nullable. Metoda vraća `null`
 * ako nema ni podataka ni keša.
 */
export class DashboardWeatherDto {
  @ApiProperty({ nullable: true })
  temp!: number | null;

  @ApiProperty({ nullable: true })
  feelsLike!: number | null;

  @ApiProperty({ nullable: true })
  condition!: string | null;

  @ApiProperty({ nullable: true })
  humidity!: number | null;

  @ApiProperty({ nullable: true })
  windSpeed!: number | null;

  @ApiProperty({ nullable: true })
  pressure!: number | null;

  @ApiProperty({ nullable: true })
  uvIndex!: number | null;

  @ApiProperty({ nullable: true })
  sunrise!: string | null;

  @ApiProperty({ nullable: true })
  sunset!: string | null;
}

/**
 * `capabilities` iz obje grane (l.38 i l.162).
 *
 * Anonimno su sve tri `false`; kod prijavljenog se računaju iz broja profila,
 * termostata i intervala učenja (l.61-67).
 */
export class DashboardCapabilitiesDto {
  @ApiProperty()
  hasProfile!: boolean;

  @ApiProperty()
  hasThermostat!: boolean;

  @ApiProperty()
  hasLearning!: boolean;
}

/**
 * `system.recommendation` u ANONIMNOJ grani (l.45-49).
 *
 * `date` je `Date.now()` — broj (epoch ms), a NE `Date`.
 * `source` je doslovno `'LIVE_CALCULATION'`.
 */
export class DashboardLiveRecommendationDto {
  @ApiProperty({
    description: 'Date.now() — epoch milisekunde, nije ISO datum.',
  })
  date!: number;

  @ApiProperty({
    description:
      '`boilerService.calculateFlowTemp().flowTemp` (boiler.service.ts:14) — `number`.',
  })
  recommendedFlowTemp!: number;

  @ApiProperty({
    enum: ['LIVE_CALCULATION'],
    enumName: 'LiveRecommendationSource',
  })
  source!: 'LIVE_CALCULATION';
}

/**
 * `system.recommendation` u AUTENTIFICIRANOJ grani:
 * `recommendations[0] ?? null` (l.167), gdje `getRecentRecommendations()`
 * (l.560) vraća pune zapise modela `Recommendation`.
 */
export class DashboardStoredRecommendationDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  userId!: number;

  @ApiProperty()
  recommendedFlowTemp!: number;

  @ApiProperty()
  expectedHeatTimeMin!: number;

  @ApiProperty()
  confidenceScore!: number;

  @ApiProperty(DATE_TIME)
  createdAt!: Date;

  @ApiProperty(DATE_TIME)
  date!: Date;
}

/**
 * `system.boiler` u AUTENTIFICIRANOJ grani (l.166):
 * `getLatestBoilerHistory()` -> `boilerHistory.findFirst()` ili `null`.
 * Sirovi zapis modela `BoilerHistory`.
 *
 * U anonimnoj grani ovog ključa NEMA.
 */
export class DashboardBoilerHistoryDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  userId!: number;

  @ApiProperty()
  externalTemp!: number;

  @ApiProperty({ description: 'DB kolona `suggestedTemp`.' })
  suggestedFlowTemp!: number;

  @ApiProperty({ nullable: true, description: 'DB kolona `actualTemp`.' })
  actualFlowTemp!: number | null;

  @ApiProperty({ ...DATE_TIME, nullable: true })
  heatingStart!: Date | null;

  @ApiProperty({ ...DATE_TIME, nullable: true })
  heatingEnd!: Date | null;

  @ApiProperty(DATE_TIME)
  createdAt!: Date;
}

/** `system` — unija obje grane. */
export class DashboardSystemDto {
  @ApiProperty({
    nullable: true,
    description: 'Nula ako nema ni podataka ni keša.',
    type: () => DashboardWeatherDto,
  })
  weather!: DashboardWeatherDto | null;

  @ApiProperty({
    required: false,
    nullable: true,
    type: () => DashboardBoilerHistoryDto,
    description:
      'Samo za prijavljene s termostatom; u anonimnoj grani ključ ne postoji.',
  })
  boiler?: DashboardBoilerHistoryDto | null;

  @ApiProperty({
    nullable: true,
    description:
      'Anonimno: DashboardLiveRecommendationDto. Prijavljen: DashboardStoredRecommendationDto ili null.',
    oneOf: [
      { $ref: '#/components/schemas/DashboardLiveRecommendationDto' },
      { $ref: '#/components/schemas/DashboardStoredRecommendationDto' },
    ],
  })
  recommendation!:
    DashboardLiveRecommendationDto | DashboardStoredRecommendationDto | null;
}

/** `homes[].profile` (l.93-100) — 6 polja iz modela `HomeProfile`. */
export class DashboardProfileDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  floorArea!: number;

  @ApiProperty()
  ceilingHeight!: number;

  @ApiProperty({
    enum: ['STANDARD', 'EPS', 'MINERAL_WOOL', 'ADVANCED'],
    enumName: 'HomeProfileInsulationType',
  })
  insulationType!: 'STANDARD' | 'EPS' | 'MINERAL_WOOL' | 'ADVANCED';

  @ApiProperty({
    enum: ['SINGLE_GLAZED', 'DOUBLE_GLAZED', 'TRIPLE_GLAZED'],
    enumName: 'HomeProfileWindowType',
  })
  windowType!: 'SINGLE_GLAZED' | 'DOUBLE_GLAZED' | 'TRIPLE_GLAZED';

  @ApiProperty({
    enum: ['RADIATOR', 'UNDERFLOOR', 'MIXED'],
    enumName: 'HomeProfileHeatingType',
  })
  heatingType!: 'RADIATOR' | 'UNDERFLOOR' | 'MIXED';
}

/** `thermostats[].program[]` (l.114-119) — model `ThermostatProgram`. */
export class DashboardThermostatProgramDto {
  @ApiProperty({ enum: ['WORKDAY', 'SATURDAY', 'SUNDAY'], enumName: 'DayType' })
  dayType!: 'WORKDAY' | 'SATURDAY' | 'SUNDAY';

  @ApiProperty()
  startMinute!: number;

  @ApiProperty()
  targetTemp!: number;

  @ApiProperty()
  orderIndex!: number;
}

/** `homes[].thermostats[]` (l.102-121) — model `ThermostatDevice`. */
export class DashboardThermostatDto {
  @ApiProperty()
  id!: number;

  @ApiProperty({ nullable: true })
  alias!: string | null;

  @ApiProperty()
  vendor!: string;

  @ApiProperty({
    description: 'Vanjski id uređaja (string), nije interni `id`.',
  })
  deviceId!: string;

  @ApiProperty({
    enum: ['MANUAL', 'PROGRAM', 'OFF'],
    enumName: 'ThermostatMode',
  })
  mode!: 'MANUAL' | 'PROGRAM' | 'OFF';

  @ApiProperty({ ...DATE_TIME, nullable: true })
  lastSeen!: Date | null;

  @ApiProperty({ nullable: true, description: 'Iz `roomCurrentTemp`.' })
  currentTemp!: number | null;

  @ApiProperty({ nullable: true, description: 'Iz `roomTargetTemp`.' })
  targetTemp!: number | null;

  @ApiProperty({
    description: '`heatingStatus.find(...)?.isHeatingNow ?? false` (l.110).',
  })
  isHeatingNow!: boolean;

  @ApiProperty({ type: () => [DashboardThermostatProgramDto] })
  program!: DashboardThermostatProgramDto[];
}

/** `homes[].learningIntervals[]` (l.123-131) — model `HeatingIntervalLearning`. */
export class DashboardLearningIntervalDto {
  @ApiProperty()
  intervalKey!: string;

  @ApiProperty()
  avgReachTimeMin!: number;

  @ApiProperty()
  avgOvershoot!: number;

  @ApiProperty()
  offset!: number;

  @ApiProperty()
  confidence!: number;

  @ApiProperty()
  samples!: number;

  @ApiProperty(DATE_TIME)
  lastUpdated!: Date;
}

/** `homes[].recentHeatingEvents[]` (l.133-153) — model `HeatingEvent`. */
export class DashboardRecentHeatingEventDto {
  @ApiProperty()
  deviceId!: number;

  @ApiProperty(DATE_TIME)
  startedAt!: Date;

  @ApiProperty({ ...DATE_TIME, nullable: true })
  endedAt!: Date | null;

  @ApiProperty({ description: 'Iz `roomTargetTemp` (događaj).' })
  targetTemp!: number;

  @ApiProperty({
    nullable: true,
    description:
      'Ciljna temperatura s termostata u trenutku čitanja, ili null.',
  })
  targetTempThermostat!: number | null;

  @ApiProperty({ description: 'Iz `roomCurrentTemp` (događaj).' })
  currentTemp!: number;

  @ApiProperty({
    nullable: true,
    description:
      'NAMJERNO zadržan typo `curret` iz izvornog koda — preimenovanje bi slomilo FE.',
  })
  curretTempThermostat!: number | null;

  @ApiProperty({ description: 'Slobodan string iz kolone `hvacAction`.' })
  hvacAction!: string;

  @ApiProperty({ description: 'Slobodan string iz kolone `source`.' })
  source!: string;

  @ApiProperty({
    description: '0 ako `timestampEnd` ne postoji (l.148-152).',
  })
  durationMinutes!: number;

  @ApiProperty()
  isAnomaly!: boolean;

  @ApiProperty({ ...DATE_TIME, nullable: true })
  proposedEndTime!: Date | null;
}

/** `homes[]` element (l.92). */
export class DashboardHomeDto {
  @ApiProperty({ type: () => DashboardProfileDto })
  profile!: DashboardProfileDto;

  @ApiProperty({ type: () => [DashboardThermostatDto] })
  thermostats!: DashboardThermostatDto[];

  @ApiProperty({ type: () => [DashboardLearningIntervalDto] })
  learningIntervals!: DashboardLearningIntervalDto[];

  @ApiProperty({ type: () => [DashboardRecentHeatingEventDto] })
  recentHeatingEvents!: DashboardRecentHeatingEventDto[];
}

/** `GET /api/dashboard` — `getDashboard()`. */
export class DashboardResponseDto {
  @ApiProperty({ type: () => DashboardCapabilitiesDto })
  capabilities!: DashboardCapabilitiesDto;

  @ApiProperty({ type: () => DashboardSystemDto })
  system!: DashboardSystemDto;

  @ApiProperty({
    type: () => [DashboardHomeDto],
    description: 'Prazan niz za anonimne pozive.',
  })
  homes!: DashboardHomeDto[];
}

/** `GET /api/dashboard/heating-events` — `data[]` element (l.253-270). */
export class DashboardHeatingEventDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  deviceId!: number;

  @ApiProperty(DATE_TIME)
  startedAt!: Date;

  @ApiProperty({ ...DATE_TIME, nullable: true })
  endedAt!: Date | null;

  @ApiProperty({ description: 'Iz `roomCurrentTemp` (događaj, NOT NULL).' })
  currentTemp!: number;

  @ApiProperty({ description: 'Iz `roomTargetTemp` (događaj, NOT NULL).' })
  targetTemp!: number;

  @ApiProperty({
    nullable: true,
    description:
      'Vrijednost s termostata, `null` ako termostat nema `roomCurrentTemp`. Typo je iz izvornog koda.',
  })
  curretTempThermostat!: number | null;

  @ApiProperty({ nullable: true, description: 'Vrijednost s termostata.' })
  targetTempThermostat!: number | null;

  @ApiProperty()
  hvacAction!: string;

  @ApiProperty()
  source!: string;

  @ApiProperty({ description: '0 ako `timestampEnd` ne postoji.' })
  durationMinutes!: number;
}

/** `meta` (l.271-275). */
export class DashboardHeatingEventsMetaDto {
  @ApiProperty()
  page!: number;

  @ApiProperty({
    description: '`take ?? total` — bez paginacije jednako `total`.',
  })
  limit!: number;

  @ApiProperty()
  total!: number;
}

export class DashboardHeatingEventsResponseDto {
  @ApiProperty({ type: () => [DashboardHeatingEventDto] })
  data!: DashboardHeatingEventDto[];

  @ApiProperty({ type: () => DashboardHeatingEventsMetaDto })
  meta!: DashboardHeatingEventsMetaDto;
}

/** `GET /api/dashboard/heating-status` — element niza (l.400-403). */
export class DashboardHeatingStatusDto {
  @ApiProperty()
  deviceId!: number;

  @ApiProperty({
    description: '`lastEvent?.timestampEnd === null` (l.401).',
  })
  isHeatingNow!: boolean;
}

/** `GET /api/dashboard/heating-summary` — `summary` (l.361-366). */
export class DashboardHeatingSummaryDto {
  @ApiProperty({ description: '`events.length` (l.299).' })
  totalCycles!: number;

  @ApiProperty({ description: '`Math.round(...)` (l.363).' })
  totalDurationMin!: number;

  @ApiProperty({
    description: '`Number((...).toFixed(2))`, 0 ako nema ciklusa (l.307).',
  })
  avgDurationMin!: number;

  @ApiProperty({
    description: '`Number((...).toFixed(2))`, 0 ako nema ciklusa (l.311).',
  })
  avgIndoorTemp!: number;
}

/** `buckets[]` (l.367-377). */
export class DashboardHeatingBucketDto {
  @ApiProperty({
    description: '`YYYY-MM-DD` za `day`, `HH:00` za `hour` (l.336-340).',
  })
  label!: string;

  @ApiProperty()
  totalDurationMin!: number;

  @ApiProperty()
  cycles!: number;

  @ApiProperty({ description: 'Zaokruženo na 2 decimale, 0 ako `cycles` = 0.' })
  avgTargetTemp!: number;

  @ApiProperty({ description: 'Zaokruženo na 2 decimale, 0 ako `cycles` = 0.' })
  avgCurrentTemp!: number;
}

export class DashboardHeatingSummaryResponseDto {
  @ApiProperty({ type: () => DashboardHeatingSummaryDto })
  summary!: DashboardHeatingSummaryDto;

  @ApiProperty({ type: () => [DashboardHeatingBucketDto] })
  buckets!: DashboardHeatingBucketDto[];
}

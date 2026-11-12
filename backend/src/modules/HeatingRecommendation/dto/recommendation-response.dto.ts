import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const DATE_TIME = { type: String, format: 'date-time' } as const;

/** FE2-10: offsets already applied by the heating engine, in °C. */
export class RecommendationAppliedOffsetsDto {
  @ApiProperty({ description: 'Home-profile learning offset, in °C.' })
  home!: number;

  @ApiProperty({ description: 'Interval learning offset, in °C.' })
  interval!: number;

  @ApiProperty({ description: 'Recent heating-event offset, in °C.' })
  events!: number;
}

/**
 * FE2-10: structured explanation snapshot persisted with new recommendations.
 * Old rows may have `breakdown: null`; clients must not reconstruct the formula.
 */
/**
 * F4.3 — članovi ravnotežnog izraza, kad je motor `model`.
 *
 * Namjerno odvojen objekat, a ne polja razbacana po breakdown-u: klijent tada
 * može prikazati model **ako postoji** (`model !== null`), bez provjere šest
 * pojedinačnih polja na `null`.
 */
export class RecommendationModelBreakdownDto {
  @ApiProperty({ type: Number, nullable: true, description: 'House slope s.' })
  slopeS!: number | null;

  @ApiProperty({
    type: String,
    nullable: true,
    enum: ['CI_HIGH', 'POINT'],
    description: 'Which slope was used — CI high bound while the model is young.',
  })
  slopeSource!: 'CI_HIGH' | 'POINT' | null;

  @ApiProperty({ description: 'Internal gains c, in °C equivalent.' })
  internalGainC!: number;

  @ApiProperty({
    description: 'Daily gain u_day actually applied, in °C (0 when disabled).',
  })
  dayGainC!: number;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Reference outdoor temperature, in °C.',
  })
  outdoorRefC!: number | null;

  @ApiProperty({
    type: String,
    nullable: true,
    enum: ['NIGHT', 'NIGHT_DAY_BLEND'],
    description: 'Whether the reference is night only or night+day blend.',
  })
  outdoorRefSource!: 'NIGHT' | 'NIGHT_DAY_BLEND' | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Equilibrium flow before the controller, in °C.',
  })
  equilibriumFlowC!: number | null;

  @ApiProperty({
    type: [String],
    description: 'Why the equilibrium flow is null or bounded (NO_NIGHT, NO_SLOPE, …).',
  })
  reasons!: string[];
}

export class RecommendationBreakdownDto {
  @ApiProperty({ description: 'Snapshot schema version (2 since F4.3).', example: 2 })
  version!: number;

  @ApiProperty({
    type: String,
    nullable: true,
    enum: ['curve', 'model'],
    description:
      'F4.3: which engine produced finalTemp. null for rows written before F4.3 — ' +
      'an old row does not claim an engine it never recorded.',
  })
  engine!: 'curve' | 'model' | null;

  @ApiProperty({
    type: () => RecommendationModelBreakdownDto,
    nullable: true,
    description:
      'F4.3: equilibrium terms, present only when engine is "model".',
  })
  model!: RecommendationModelBreakdownDto | null;

  @ApiProperty({
    description: 'Engine mode used for the recommendation.',
    enum: ['FULL', 'PROFILE_ONLY', 'ANONYMOUS'],
  })
  mode!: 'FULL' | 'PROFILE_ONLY' | 'ANONYMOUS';

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Interval key used by the engine, if available.',
  })
  intervalKey!: string | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Base heating-curve temperature, in °C. null when engine is "model" — ' +
      'there is no curve in that path. A number would be invented; 0 would ' +
      'render as "0.00 °C" on clients.',
  })
  baseCurveTemp!: number | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Weighted external temperature used by the curve, in °C. null for engine "model".',
  })
  weightedExternalTemp!: number | null;

  @ApiProperty({ type: () => RecommendationAppliedOffsetsDto, nullable: true })
  appliedOffsets!: RecommendationAppliedOffsetsDto | null;

  @ApiProperty({ description: 'Final recommended flow temperature, in °C.' })
  finalTemp!: number;

  @ApiProperty({ description: 'Engine confidence, 0..1.' })
  confidence!: number;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Learning sample count, if available.',
  })
  samples!: number | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Expected heat time in minutes, if available.',
  })
  expectedHeatTimeMin!: number | null;
}

/** FE2-10: public shape of GET /api/recommendations rows. */
export class RecommendationResponseDto {
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

  @ApiPropertyOptional({
    type: () => RecommendationBreakdownDto,
    nullable: true,
    description:
      'Additive FE2-10 explanation snapshot. Null for recommendations created before the snapshot column existed.',
  })
  breakdown?: RecommendationBreakdownDto | null;
}

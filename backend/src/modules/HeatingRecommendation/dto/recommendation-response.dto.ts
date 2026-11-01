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
export class RecommendationBreakdownDto {
  @ApiProperty({ description: 'Snapshot schema version.', example: 1 })
  version!: number;

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

  @ApiProperty({ description: 'Base heating-curve temperature, in °C.' })
  baseCurveTemp!: number;

  @ApiProperty({
    description: 'Weighted external temperature used by the curve, in °C.',
  })
  weightedExternalTemp!: number;

  @ApiProperty({ type: () => RecommendationAppliedOffsetsDto })
  appliedOffsets!: RecommendationAppliedOffsetsDto;

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

import { ApiProperty } from '@nestjs/swagger';

const OBJECT_ARRAY = {
  type: 'array',
  items: { type: 'object', additionalProperties: true },
} as const;

export class AccountExportCollectionsDto {
  @ApiProperty(OBJECT_ARRAY)
  homeProfiles!: Record<string, unknown>[];

  @ApiProperty(OBJECT_ARRAY)
  heatingIntervalLearnings!: Record<string, unknown>[];

  @ApiProperty(OBJECT_ARRAY)
  thermostatDevices!: Record<string, unknown>[];

  @ApiProperty(OBJECT_ARRAY)
  thermostatPrograms!: Record<string, unknown>[];

  @ApiProperty(OBJECT_ARRAY)
  heatingEvents!: Record<string, unknown>[];

  @ApiProperty(OBJECT_ARRAY)
  recommendations!: Record<string, unknown>[];

  @ApiProperty(OBJECT_ARRAY)
  boilerHistories!: Record<string, unknown>[];

  @ApiProperty(OBJECT_ARRAY)
  gasReadings!: Record<string, unknown>[];

  @ApiProperty(OBJECT_ARRAY)
  gasPriceHistory!: Record<string, unknown>[];

  @ApiProperty(OBJECT_ARRAY)
  notifications!: Record<string, unknown>[];

  @ApiProperty(OBJECT_ARRAY)
  notificationPreferences!: Record<string, unknown>[];

  @ApiProperty(OBJECT_ARRAY)
  devices!: Record<string, unknown>[];

  @ApiProperty(OBJECT_ARRAY)
  sessions!: Record<string, unknown>[];
}

export class AccountExportResponseDto {
  @ApiProperty({ enum: ['boiler-control.account-export'] })
  format!: 'boiler-control.account-export';

  @ApiProperty({ type: Number, enum: [1] })
  version!: 1;

  @ApiProperty({ type: String, format: 'date-time' })
  generatedAt!: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description:
      'Explicitly selected account fields; passwordHash is excluded.',
  })
  account!: Record<string, unknown>;

  @ApiProperty({ type: () => AccountExportCollectionsDto })
  collections!: AccountExportCollectionsDto;
}
